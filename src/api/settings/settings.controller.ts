import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { ensureEpaperDomainSettings } from '../../lib/epaperDomainSettingsAuto';
import { ensureNewsDomainSettings } from '../../lib/newsDomainSettingsAuto';

const mergeSettings = (base: any, override: any) => ({ ...(base || {}), ...(override || {}) });

export const getEntitySettings = async (_req: Request, res: Response) => {
  const row = await (prisma as any).entitySettings.findFirst();
  return res.status(200).json(row?.data || {});
};

export const upsertEntitySettings = async (req: Request, res: Response) => {
  const payload = req.body || {};
  const existing = await (prisma as any).entitySettings.findFirst();
  const data = req.method === 'PATCH' ? mergeSettings(existing?.data, payload) : payload;
  const saved = existing
    ? await (prisma as any).entitySettings.update({ where: { id: existing.id }, data: { data } })
    : await (prisma as any).entitySettings.create({ data: { data } });
  return res.status(200).json(saved.data);
};

export const getTenantSettings = async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const entity = await (prisma as any).entitySettings.findFirst();
  const tenant = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
  const effective = mergeSettings(entity?.data, tenant?.data);
  return res.status(200).json({ tenantId, settings: tenant?.data || {}, effective });
};

export const upsertTenantSettings = async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const payload = req.body || {};
  const existing = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
  const data = req.method === 'PATCH' ? mergeSettings(existing?.data, payload) : payload;
  const saved = existing
    ? await (prisma as any).tenantSettings.update({ where: { id: existing.id }, data: { data } })
    : await (prisma as any).tenantSettings.create({ data: { tenantId, data } });
  return res.status(200).json({ tenantId, settings: saved.data });
};

export const getDomainSettings = async (req: Request, res: Response) => {
  const { tenantId, domainId } = req.params;
  const entity = await (prisma as any).entitySettings.findFirst();
  const tenant = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
  const domain = await (prisma as any).domainSettings.findUnique({ where: { domainId } });
  const effective = mergeSettings(mergeSettings(entity?.data, tenant?.data), domain?.data);
  return res.status(200).json({ tenantId, domainId, settings: domain?.data || {}, effective });
};

export const upsertDomainSettings = async (req: Request, res: Response) => {
  const { tenantId, domainId } = req.params;
  const payload = req.body || {};
  const existing = await (prisma as any).domainSettings.findUnique({ where: { domainId } });
  const data = req.method === 'PATCH' ? mergeSettings(existing?.data, payload) : payload;
  const saved = existing
    ? await (prisma as any).domainSettings.update({ where: { id: existing.id }, data: { data } })
    : await (prisma as any).domainSettings.create({ data: { tenantId, domainId, data } });
  
  // Auto-generate SEO if requested (default: true)
  const autoSeoParam = String((req.query as any).autoSeo ?? 'true').toLowerCase();
  const autoSeo = autoSeoParam === '1' || autoSeoParam === 'true' || autoSeoParam === 'yes' || autoSeoParam === 'y' || autoSeoParam === 'on';
  
  if (autoSeo) {
    // Check domain kind to determine which auto-SEO to use
    const domain = await (prisma as any).domain.findUnique({ where: { id: domainId } }).catch(() => null);
    const kind = String(domain?.kind || '').toUpperCase();
    
    if (kind === 'EPAPER') {
      await ensureEpaperDomainSettings(tenantId, domainId, { forceSeo: true }).catch(() => null);
    } else {
      // NEWS or other domains
      await ensureNewsDomainSettings(tenantId, domainId, { forceSeo: true }).catch(() => null);
    }
  }
  
  // Return latest data after potential SEO generation
  const latest = await (prisma as any).domainSettings.findUnique({ where: { domainId } }).catch(() => null);
  return res.status(200).json({ tenantId, domainId, settings: latest?.data || saved.data });
};

export const listDomainSettings = async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const [items, total] = await Promise.all([
    (prisma as any).domainSettings.findMany({ where: { tenantId }, skip: (page - 1) * pageSize, take: pageSize }),
    (prisma as any).domainSettings.count({ where: { tenantId } }),
  ]);
  return res.status(200).json({ meta: { page, pageSize, total }, data: items });
};

export const bootstrapEpaperDomainSettings = async (req: Request, res: Response) => {
  try {
    const { tenantId, domainId } = req.params;

    const domain = await (prisma as any).domain.findUnique({ where: { id: domainId } }).catch(() => null);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });
    if (String(domain.tenantId) !== String(tenantId)) {
      return res.status(400).json({ error: 'Domain does not belong to tenant' });
    }
    if (String(domain.kind || '').toUpperCase() !== 'EPAPER') {
      return res.status(400).json({ error: 'Domain kind must be EPAPER' });
    }

    await ensureEpaperDomainSettings(tenantId, domainId, { forceFill: true, forceSeo: true });

    const entity = await (prisma as any).entitySettings.findFirst();
    const tenant = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
    const domainSettings = await (prisma as any).domainSettings.findUnique({ where: { domainId } });
    const effective = mergeSettings(mergeSettings(entity?.data, tenant?.data), domainSettings?.data);
    return res.status(200).json({ tenantId, domainId, settings: domainSettings?.data || {}, effective });
  } catch (e: any) {
    console.error('bootstrap epaper domain settings error', e);
    return res.status(500).json({ error: 'Failed to bootstrap epaper domain settings' });
  }
};
