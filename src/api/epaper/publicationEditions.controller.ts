import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { slugFromAnyLanguage } from '../../lib/sanitize';

type TenantCtx = {
  tenantId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userId: string;
};

async function getTenantContext(req: Request): Promise<TenantCtx> {
  const user = (req as any).user;
  const userId = String(user?.id || '');
  const roleName = String(user?.role?.name || '').toUpperCase();

  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || roleName === 'TENANT_ADMIN' || roleName === 'ADMIN_EDITOR';

  let tenantId: string | null = null;

  // Non-super admins infer tenant from reporter profile.
  if (!isSuperAdmin && userId) {
    const reporter = await prisma.reporter.findFirst({
      where: { userId },
      select: { tenantId: true },
    });
    tenantId = reporter?.tenantId || null;
  }

  // Superadmin may specify tenantId explicitly.
  if (isSuperAdmin && (req.query as any).tenantId) {
    tenantId = String((req.query as any).tenantId);
  }

  return { tenantId, isAdmin, isSuperAdmin, userId };
}

function requireTenantOr400(res: Response, tenantId: string | null) {
  if (!tenantId) {
    res.status(400).json({ error: 'Tenant context required' });
    return false;
  }
  return true;
}

function normalizeSlug(raw: unknown, fallbackName: string) {
  const base = String(raw || '').trim();
  const chosen = base ? base : fallbackName;
  return slugFromAnyLanguage(chosen, 80);
}

// ============================================================================
// PUBLICATION EDITIONS (State-level)
// ============================================================================

export const listPublicationEditions = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const includeSubEditions = String((req.query as any).includeSubEditions || '').toLowerCase() === 'true';
    const includeDeleted = String((req.query as any).includeDeleted || '').toLowerCase() === 'true';

    const items = await prisma.epaperPublicationEdition.findMany({
      where: {
        tenantId: ctx.tenantId!,
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      include: includeSubEditions
        ? {
            subEditions: {
              where: includeDeleted ? {} : { isDeleted: false },
              orderBy: { name: 'asc' },
            },
            state: { select: { id: true, name: true } },
          }
        : {
            state: { select: { id: true, name: true } },
          },
      orderBy: [{ name: 'asc' }],
    });

    return res.json({ items });
  } catch (error) {
    console.error('listPublicationEditions error:', error);
    return res.status(500).json({ error: 'Failed to list ePaper publication editions' });
  }
};

export const getPublicationEdition = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const id = String(req.params.id || '');
    const edition = await prisma.epaperPublicationEdition.findFirst({
      where: { id, tenantId: ctx.tenantId!, isDeleted: false },
      include: {
        state: { select: { id: true, name: true } },
        subEditions: {
          where: { isDeleted: false },
          include: { district: { select: { id: true, name: true, stateId: true } } },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!edition) return res.status(404).json({ error: 'Edition not found' });
    return res.json(edition);
  } catch (error) {
    console.error('getPublicationEdition error:', error);
    return res.status(500).json({ error: 'Failed to get ePaper publication edition' });
  }
};

export const createPublicationEdition = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const name = String(req.body?.name || '').trim();
    const stateIdRaw = req.body?.stateId;
    const stateId = stateIdRaw === undefined || stateIdRaw === null ? null : String(stateIdRaw).trim();

    if (!name) return res.status(400).json({ error: 'name is required' });

    if (stateId) {
      const exists = await prisma.state.findFirst({ where: { id: stateId, isDeleted: false }, select: { id: true } });
      if (!exists) return res.status(400).json({ error: 'Invalid stateId' });
    }

    const slug = normalizeSlug(req.body?.slug, name);
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const prismaAny = prisma as any;
    const created = await prismaAny.epaperPublicationEdition.create({
      data: {
        tenantId: ctx.tenantId!,
        name,
        slug,
        stateId: stateId || null,
        coverImageUrl: req.body?.coverImageUrl ? String(req.body.coverImageUrl) : null,
        seoTitle: req.body?.seoTitle ? String(req.body.seoTitle) : null,
        seoDescription: req.body?.seoDescription ? String(req.body.seoDescription) : null,
        seoKeywords: req.body?.seoKeywords ? String(req.body.seoKeywords) : null,
        isActive: req.body?.isActive === undefined ? true : Boolean(req.body.isActive),
      },
      include: { state: { select: { id: true, name: true } } },
    });

    return res.status(201).json(created);
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
      return res.status(409).json({ error: 'Edition slug already exists for this tenant' });
    }
    console.error('createPublicationEdition error:', error);
    return res.status(500).json({ error: 'Failed to create ePaper publication edition' });
  }
};

export const updatePublicationEdition = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const id = String(req.params.id || '');
    const existing = await prisma.epaperPublicationEdition.findFirst({
      where: { id, tenantId: ctx.tenantId!, isDeleted: false },
      select: { id: true, name: true },
    });
    if (!existing) return res.status(404).json({ error: 'Edition not found' });

    const nextName = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
    const nextSlug = req.body?.slug !== undefined ? normalizeSlug(req.body.slug, nextName || existing.name) : undefined;

    let nextStateId: string | null | undefined = undefined;
    if (req.body?.stateId !== undefined) {
      const raw = req.body.stateId;
      const v = raw === null ? null : String(raw || '').trim();
      if (v) {
        const exists = await prisma.state.findFirst({ where: { id: v, isDeleted: false }, select: { id: true } });
        if (!exists) return res.status(400).json({ error: 'Invalid stateId' });
        nextStateId = v;
      } else {
        nextStateId = null;
      }
    }

    const prismaAny = prisma as any;
    const updated = await prismaAny.epaperPublicationEdition.update({
      where: { id },
      data: {
        name: nextName,
        slug: nextSlug,
        stateId: nextStateId,
        coverImageUrl: req.body?.coverImageUrl !== undefined ? (req.body.coverImageUrl ? String(req.body.coverImageUrl) : null) : undefined,
        seoTitle: req.body?.seoTitle !== undefined ? (req.body.seoTitle ? String(req.body.seoTitle) : null) : undefined,
        seoDescription: req.body?.seoDescription !== undefined ? (req.body.seoDescription ? String(req.body.seoDescription) : null) : undefined,
        seoKeywords: req.body?.seoKeywords !== undefined ? (req.body.seoKeywords ? String(req.body.seoKeywords) : null) : undefined,
        isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : undefined,
      },
      include: { state: { select: { id: true, name: true } } },
    });

    return res.json(updated);
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
      return res.status(409).json({ error: 'Edition slug already exists for this tenant' });
    }
    console.error('updatePublicationEdition error:', error);
    return res.status(500).json({ error: 'Failed to update ePaper publication edition' });
  }
};

export const deletePublicationEdition = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const id = String(req.params.id || '');
    const existing = await prisma.epaperPublicationEdition.findFirst({
      where: { id, tenantId: ctx.tenantId!, isDeleted: false },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Edition not found' });

    await prisma.epaperPublicationEdition.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('deletePublicationEdition error:', error);
    return res.status(500).json({ error: 'Failed to delete ePaper publication edition' });
  }
};

// ============================================================================
// PUBLICATION SUB-EDITIONS (District-level)
// ============================================================================

export const listPublicationSubEditions = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const editionId = String(req.params.editionId || '');
    const includeDeleted = String((req.query as any).includeDeleted || '').toLowerCase() === 'true';

    const parent = await prisma.epaperPublicationEdition.findFirst({
      where: { id: editionId, tenantId: ctx.tenantId!, isDeleted: false },
      select: { id: true },
    });
    if (!parent) return res.status(404).json({ error: 'Edition not found' });

    const items = await prisma.epaperPublicationSubEdition.findMany({
      where: {
        tenantId: ctx.tenantId!,
        editionId,
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      include: {
        district: { select: { id: true, name: true, stateId: true } },
      },
      orderBy: [{ name: 'asc' }],
    });

    return res.json({ items });
  } catch (error) {
    console.error('listPublicationSubEditions error:', error);
    return res.status(500).json({ error: 'Failed to list ePaper publication sub-editions' });
  }
};

export const createPublicationSubEdition = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const editionId = String(req.params.editionId || '').trim();
    const name = String(req.body?.name || '').trim();
    const districtIdRaw = req.body?.districtId;
    const districtId = districtIdRaw === undefined || districtIdRaw === null ? null : String(districtIdRaw).trim();

    if (!editionId) return res.status(400).json({ error: 'editionId is required' });
    if (!name) return res.status(400).json({ error: 'name is required' });

    const parent = await prisma.epaperPublicationEdition.findFirst({
      where: { id: editionId, tenantId: ctx.tenantId!, isDeleted: false },
      select: { id: true, stateId: true },
    });
    if (!parent) return res.status(404).json({ error: 'Edition not found' });

    if (districtId) {
      // If districtId is provided, ensure it exists.
      const district = await prisma.district.findUnique({
        where: { id: districtId },
        select: { id: true, stateId: true },
      });
      if (!district) return res.status(400).json({ error: 'Invalid districtId' });
      // If parent has a stateId, enforce district belongs to same state.
      if (parent.stateId && district.stateId !== parent.stateId) {
        return res.status(400).json({ error: 'District must belong to the edition state' });
      }
    }

    const slug = normalizeSlug(req.body?.slug, name);
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const prismaAny = prisma as any;
    const created = await prismaAny.epaperPublicationSubEdition.create({
      data: {
        tenantId: ctx.tenantId!,
        editionId,
        name,
        slug,
        districtId: districtId || null,
        coverImageUrl: req.body?.coverImageUrl ? String(req.body.coverImageUrl) : null,
        seoTitle: req.body?.seoTitle ? String(req.body.seoTitle) : null,
        seoDescription: req.body?.seoDescription ? String(req.body.seoDescription) : null,
        seoKeywords: req.body?.seoKeywords ? String(req.body.seoKeywords) : null,
        isActive: req.body?.isActive === undefined ? true : Boolean(req.body.isActive),
      },
      include: {
        district: { select: { id: true, name: true, stateId: true } },
      },
    });

    return res.status(201).json(created);
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
      return res.status(409).json({ error: 'Sub-edition slug already exists for this edition' });
    }
    console.error('createPublicationSubEdition error:', error);
    return res.status(500).json({ error: 'Failed to create ePaper publication sub-edition' });
  }
};

export const getPublicationSubEdition = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const id = String(req.params.id || '');
    const item = await prisma.epaperPublicationSubEdition.findFirst({
      where: { id, tenantId: ctx.tenantId!, isDeleted: false },
      include: {
        district: { select: { id: true, name: true, stateId: true } },
        edition: { select: { id: true, name: true, slug: true, stateId: true } },
      },
    });
    if (!item) return res.status(404).json({ error: 'Sub-edition not found' });
    return res.json(item);
  } catch (error) {
    console.error('getPublicationSubEdition error:', error);
    return res.status(500).json({ error: 'Failed to get ePaper publication sub-edition' });
  }
};

export const updatePublicationSubEdition = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const id = String(req.params.id || '');
    const existing = await prisma.epaperPublicationSubEdition.findFirst({
      where: { id, tenantId: ctx.tenantId!, isDeleted: false },
      include: { edition: { select: { id: true, stateId: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Sub-edition not found' });

    const nextName = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
    const nextSlug = req.body?.slug !== undefined ? normalizeSlug(req.body.slug, nextName || existing.name) : undefined;

    // districtId is optional. If provided, validate it; allow clearing by sending null.
    let nextDistrictId: string | null | undefined = undefined;
    if (req.body?.districtId !== undefined) {
      const raw = req.body.districtId;
      if (raw === null) {
        nextDistrictId = null;
      } else {
        const v = String(raw || '').trim();
        if (!v) return res.status(400).json({ error: 'districtId cannot be empty' });
        const district = await prisma.district.findUnique({ where: { id: v }, select: { id: true, stateId: true } });
        if (!district) return res.status(400).json({ error: 'Invalid districtId' });
        if (existing.edition.stateId && district.stateId !== existing.edition.stateId) {
          return res.status(400).json({ error: 'District must belong to the edition state' });
        }
        nextDistrictId = v;
      }
    }

    const prismaAny = prisma as any;
    const updated = await prismaAny.epaperPublicationSubEdition.update({
      where: { id },
      data: {
        name: nextName,
        slug: nextSlug,
        districtId: nextDistrictId,
        coverImageUrl: req.body?.coverImageUrl !== undefined ? (req.body.coverImageUrl ? String(req.body.coverImageUrl) : null) : undefined,
        seoTitle: req.body?.seoTitle !== undefined ? (req.body.seoTitle ? String(req.body.seoTitle) : null) : undefined,
        seoDescription: req.body?.seoDescription !== undefined ? (req.body.seoDescription ? String(req.body.seoDescription) : null) : undefined,
        seoKeywords: req.body?.seoKeywords !== undefined ? (req.body.seoKeywords ? String(req.body.seoKeywords) : null) : undefined,
        isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : undefined,
      },
      include: {
        district: { select: { id: true, name: true, stateId: true } },
        edition: { select: { id: true, name: true, slug: true, stateId: true } },
      },
    });

    return res.json(updated);
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
      return res.status(409).json({ error: 'Sub-edition slug already exists for this edition' });
    }
    console.error('updatePublicationSubEdition error:', error);
    return res.status(500).json({ error: 'Failed to update ePaper publication sub-edition' });
  }
};

export const deletePublicationSubEdition = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can manage ePaper editions' });
    if (!requireTenantOr400(res, ctx.tenantId)) return;

    const id = String(req.params.id || '');
    const existing = await prisma.epaperPublicationSubEdition.findFirst({
      where: { id, tenantId: ctx.tenantId!, isDeleted: false },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Sub-edition not found' });

    await prisma.epaperPublicationSubEdition.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('deletePublicationSubEdition error:', error);
    return res.status(500).json({ error: 'Failed to delete ePaper publication sub-edition' });
  }
};
