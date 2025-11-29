import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

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
  return res.status(200).json({ tenantId, domainId, settings: saved.data });
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
