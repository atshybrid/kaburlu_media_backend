import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { ensureEpaperDomainSettings } from '../../lib/epaperDomainSettingsAuto';

function asObject(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as any) : {};
}

function isPlainObject(value: any): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base: any, patch: any): any {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergeDeep(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function getTenantContext(req: Request): Promise<{ tenantId: string | null; isAdmin: boolean; isSuperAdmin: boolean; userId: string }> {
  const user = (req as any).user;
  const userId = String(user?.id || '');
  const roleName = String(user?.role?.name || '').toUpperCase();

  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || roleName === 'TENANT_ADMIN' || roleName === 'ADMIN_EDITOR' || roleName === 'DESK_EDITOR';

  let tenantId: string | null = null;
  if (!isSuperAdmin && userId) {
    const reporter = await prisma.reporter.findFirst({ where: { userId }, select: { tenantId: true } });
    tenantId = reporter?.tenantId || null;
  }

  const requestedTenantId = (req.query as any).tenantId ? String((req.query as any).tenantId).trim() : '';
  if (requestedTenantId) {
    if (isSuperAdmin) tenantId = requestedTenantId;
    else if (isAdmin && !tenantId) tenantId = requestedTenantId;
  }

  return { tenantId, isAdmin, isSuperAdmin, userId };
}

async function resolveEpaperDomainId(tenantId: string, req: Request): Promise<string | null> {
  const requestedDomainId = (req.query as any).domainId ? String((req.query as any).domainId).trim() : '';
  if (requestedDomainId) {
    const dom = await prisma.domain.findUnique({ where: { id: requestedDomainId } }).catch(() => null);
    if (!dom) return null;
    if (String((dom as any).tenantId) !== String(tenantId)) return null;
    if (String((dom as any).kind || '').toUpperCase() !== 'EPAPER') return null;
    return String((dom as any).id);
  }

  const dom = await prisma.domain
    .findFirst({
      where: { tenantId, kind: 'EPAPER' as any },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true },
    })
    .catch(() => null);

  return dom?.id || null;
}

function pickAllowedPayload(input: any): Record<string, any> {
  const src = asObject(input);
  const out: Record<string, any> = {};

  // Public-visible sections
  if (src.branding !== undefined) out.branding = asObject(src.branding);
  if (src.theme !== undefined) out.theme = asObject(src.theme);
  if (src.seo !== undefined) out.seo = asObject(src.seo);
  if (src.layout !== undefined) out.layout = asObject(src.layout);
  if (typeof src.themeStyle === 'string') out.themeStyle = src.themeStyle;

  // Integrations can include both public IDs and secret keys.
  // Public endpoints MUST sanitize before returning.
  if (src.integrations !== undefined) out.integrations = asObject(src.integrations);
  if (src.secrets !== undefined) out.secrets = asObject(src.secrets);

  return out;
}

type EpaperType = 'PDF' | 'BLOCK';

function normalizeEpaperType(input: any): EpaperType | null {
  const v = String(input ?? '').trim().toUpperCase();
  if (v === 'PDF') return 'PDF';
  if (v === 'BLOCK' || v === 'BLOCK_BASED' || v === 'BLOCKBASED') return 'BLOCK';
  return null;
}

async function upsertEpaperPublicConfigIfProvided(tenantId: string, payload: any, mode: 'PUT' | 'PATCH') {
  const epaper = asObject(payload?.epaper);
  if (!Object.keys(epaper).length) return;

  const typeRaw = epaper.type;
  const multiEditionEnabledRaw = epaper.multiEditionEnabled;

  const hasType = typeRaw !== undefined;
  const hasMulti = multiEditionEnabledRaw !== undefined;

  if (!hasType && !hasMulti) return;

  const existing = await prisma.epaperSettings.findUnique({ where: { tenantId } }).catch(() => null);
  const settings = existing || (await prisma.epaperSettings.create({ data: { tenantId } }));

  const gen = asObject((settings as any).generationConfig);
  const pub = asObject((gen as any).publicEpaper);

  const nextPub: any = mode === 'PATCH' ? { ...pub } : {};

  if (hasType) {
    if (typeRaw === null || String(typeRaw).trim() === '') {
      // allow clearing type to default behavior (will fallback to PDF in public response)
      delete nextPub.type;
    } else {
      const t = normalizeEpaperType(typeRaw);
      if (!t) throw new Error('INVALID_EPAPER_TYPE');
      nextPub.type = t;
    }
  }

  if (hasMulti) {
    if (multiEditionEnabledRaw === null) {
      delete nextPub.multiEditionEnabled;
    } else {
      nextPub.multiEditionEnabled = Boolean(multiEditionEnabledRaw);
    }
  }

  const nextGen = {
    ...gen,
    publicEpaper: nextPub,
  };

  await prisma.epaperSettings.update({ where: { tenantId }, data: { generationConfig: nextGen } });
}

export const getEpaperDomainSettingsForAdmin = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can view ePaper domain settings' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const domainId = await resolveEpaperDomainId(ctx.tenantId, req);
    if (!domainId) return res.status(404).json({ error: 'EPAPER domain not found for tenant' });

    const [entitySettings, tenantSettings, domainSettings, domain] = await Promise.all([
      (prisma as any).entitySettings?.findFirst?.().catch(() => null),
      (prisma as any).tenantSettings?.findUnique?.({ where: { tenantId: ctx.tenantId } }).catch(() => null),
      (prisma as any).domainSettings?.findUnique?.({ where: { domainId } }).catch(() => null),
      (prisma as any).domain?.findUnique?.({ where: { id: domainId }, select: { id: true, domain: true, kind: true, status: true, verifiedAt: true } }).catch(() => null),
    ]);

    const mergeSettings = (a: any, b: any) => ({ ...(a || {}), ...(b || {}) });
    const effective = mergeSettings(mergeSettings(entitySettings?.data, tenantSettings?.data), domainSettings?.data);

    return res.json({
      tenantId: ctx.tenantId,
      domain,
      settings: domainSettings?.data || {},
      effective,
      updatedAt: domainSettings?.updatedAt || null,
    });
  } catch (e) {
    console.error('getEpaperDomainSettingsForAdmin error:', e);
    return res.status(500).json({ error: 'Failed to get ePaper domain settings' });
  }
};

async function upsertEpaperDomainSettings(req: Request, res: Response, mode: 'PUT' | 'PATCH') {
  const ctx = await getTenantContext(req);
  if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can update ePaper domain settings' });
  if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

  const domainId = await resolveEpaperDomainId(ctx.tenantId, req);
  if (!domainId) return res.status(404).json({ error: 'EPAPER domain not found for tenant' });

  const body = req.body || {};

  // Optional: also update epaper public config in the same call
  try {
    await upsertEpaperPublicConfigIfProvided(ctx.tenantId, body, mode);
  } catch (e: any) {
    if (String(e?.message) === 'INVALID_EPAPER_TYPE') {
      return res.status(400).json({ error: 'epaper.type must be PDF or BLOCK' });
    }
    throw e;
  }

  const payloadRaw = pickAllowedPayload(body);

  const existing = await (prisma as any).domainSettings?.findUnique?.({ where: { domainId } }).catch(() => null);
  const nextData = mode === 'PATCH' ? mergeDeep(existing?.data || {}, payloadRaw) : payloadRaw;

  const saved = existing
    ? await (prisma as any).domainSettings.update({ where: { id: existing.id }, data: { data: nextData } })
    : await (prisma as any).domainSettings.create({ data: { tenantId: ctx.tenantId, domainId, data: nextData } });

  // Auto-generate SEO if missing (default: true)
  const autoSeoParam = String((req.query as any).autoSeo ?? 'true').toLowerCase();
  const autoSeo = autoSeoParam === '1' || autoSeoParam === 'true' || autoSeoParam === 'yes' || autoSeoParam === 'y' || autoSeoParam === 'on';
  if (autoSeo) {
    await ensureEpaperDomainSettings(ctx.tenantId, domainId, { forceSeo: true }).catch(() => null);
  }

  const latest = await (prisma as any).domainSettings?.findUnique?.({ where: { domainId } }).catch(() => null);
  return res.json({ tenantId: ctx.tenantId, domainId, settings: latest?.data || saved.data, updatedAt: latest?.updatedAt || saved.updatedAt });
}

export const putEpaperDomainSettingsForAdmin = async (req: Request, res: Response) => {
  try {
    return await upsertEpaperDomainSettings(req, res, 'PUT');
  } catch (e) {
    console.error('putEpaperDomainSettingsForAdmin error:', e);
    return res.status(500).json({ error: 'Failed to update ePaper domain settings' });
  }
};

export const patchEpaperDomainSettingsForAdmin = async (req: Request, res: Response) => {
  try {
    return await upsertEpaperDomainSettings(req, res, 'PATCH');
  } catch (e) {
    console.error('patchEpaperDomainSettingsForAdmin error:', e);
    return res.status(500).json({ error: 'Failed to update ePaper domain settings' });
  }
};

export const autoGenerateEpaperDomainSeoForAdmin = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can generate ePaper SEO' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const domainId = await resolveEpaperDomainId(ctx.tenantId, req);
    if (!domainId) return res.status(404).json({ error: 'EPAPER domain not found for tenant' });

    // By design this fills missing SEO fields (does not overwrite admin-entered SEO).
    await ensureEpaperDomainSettings(ctx.tenantId, domainId, { forceSeo: true }).catch(() => null);

    const latest = await (prisma as any).domainSettings?.findUnique?.({ where: { domainId } }).catch(() => null);
    return res.json({ tenantId: ctx.tenantId, domainId, settings: latest?.data || {}, updatedAt: latest?.updatedAt || null });
  } catch (e) {
    console.error('autoGenerateEpaperDomainSeoForAdmin error:', e);
    return res.status(500).json({ error: 'Failed to auto-generate ePaper SEO' });
  }
};
