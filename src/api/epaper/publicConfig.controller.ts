import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

type EpaperType = 'PDF' | 'BLOCK';

function normalizeEpaperType(input: any): EpaperType | null {
  const v = String(input ?? '').trim().toUpperCase();
  if (v === 'PDF') return 'PDF';
  if (v === 'BLOCK' || v === 'BLOCK_BASED' || v === 'BLOCKBASED') return 'BLOCK';
  return null;
}

function asObject(value: any): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as any;
  return {};
}

async function getTenantContext(req: Request): Promise<{ tenantId: string | null; isAdmin: boolean; isSuperAdmin: boolean; userId: string }> {
  const user = (req as any).user;
  const userId = String(user?.id || '');
  const roleName = String(user?.role?.name || '').toUpperCase();

  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || roleName === 'TENANT_ADMIN' || roleName === 'ADMIN_EDITOR' || roleName === 'DESK_EDITOR';

  let tenantId: string | null = null;
  if (!isSuperAdmin && userId) {
    const reporter = await prisma.reporter.findFirst({
      where: { userId },
      select: { tenantId: true },
    });
    tenantId = reporter?.tenantId || null;
  }

  const requestedTenantId = (req.query as any).tenantId ? String((req.query as any).tenantId).trim() : '';
  if (requestedTenantId) {
    if (isSuperAdmin) {
      tenantId = requestedTenantId;
    } else if (isAdmin && !tenantId) {
      tenantId = requestedTenantId;
    }
  }

  return { tenantId, isAdmin, isSuperAdmin, userId };
}

async function getOrCreateSettings(tenantId: string) {
  const existing = await prisma.epaperSettings.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.epaperSettings.create({
    data: { tenantId },
  });
}

function readPublicEpaperConfig(settings: any): { type: EpaperType; multiEditionEnabled: boolean } {
  const gen = asObject(settings?.generationConfig);
  const pub = asObject(gen.publicEpaper);
  const type = normalizeEpaperType(pub.type) || 'PDF';
  const multiEditionEnabled = pub.multiEditionEnabled === undefined ? true : Boolean(pub.multiEditionEnabled);
  return { type, multiEditionEnabled };
}

export const getEpaperPublicConfig = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can view ePaper public config' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const settings = await getOrCreateSettings(ctx.tenantId);
    const cfg = readPublicEpaperConfig(settings);
    return res.json({ tenantId: ctx.tenantId, ...cfg, source: 'epaperSettings.generationConfig.publicEpaper' });
  } catch (e) {
    console.error('getEpaperPublicConfig error:', e);
    return res.status(500).json({ error: 'Failed to get ePaper public config' });
  }
};

export const putEpaperPublicConfigType = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can update ePaper public config' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const type = normalizeEpaperType((req.body as any)?.type);
    if (!type) return res.status(400).json({ error: 'type must be PDF or BLOCK' });

    const settings = await getOrCreateSettings(ctx.tenantId);
    const gen = asObject(settings.generationConfig);
    const pub = asObject(gen.publicEpaper);

    const nextGen = {
      ...gen,
      publicEpaper: {
        ...pub,
        type,
      },
    };

    const updated = await prisma.epaperSettings.update({
      where: { tenantId: ctx.tenantId },
      data: { generationConfig: nextGen },
    });

    return res.json({ tenantId: ctx.tenantId, ...readPublicEpaperConfig(updated) });
  } catch (e) {
    console.error('putEpaperPublicConfigType error:', e);
    return res.status(500).json({ error: 'Failed to update ePaper type' });
  }
};

export const putEpaperPublicConfigMultiEdition = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can update ePaper public config' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const multiEditionEnabledRaw = (req.body as any)?.multiEditionEnabled;
    if (multiEditionEnabledRaw === undefined) return res.status(400).json({ error: 'multiEditionEnabled is required' });
    const multiEditionEnabled = Boolean(multiEditionEnabledRaw);

    const settings = await getOrCreateSettings(ctx.tenantId);
    const gen = asObject(settings.generationConfig);
    const pub = asObject(gen.publicEpaper);

    const nextGen = {
      ...gen,
      publicEpaper: {
        ...pub,
        multiEditionEnabled,
      },
    };

    const updated = await prisma.epaperSettings.update({
      where: { tenantId: ctx.tenantId },
      data: { generationConfig: nextGen },
    });

    return res.json({ tenantId: ctx.tenantId, ...readPublicEpaperConfig(updated) });
  } catch (e) {
    console.error('putEpaperPublicConfigMultiEdition error:', e);
    return res.status(500).json({ error: 'Failed to update multi-edition config' });
  }
};
