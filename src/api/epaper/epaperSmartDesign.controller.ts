/**
 * ePaper Smart Design — edition-wise CRUD (replaces legacy design-config for new UI).
 *
 * Base: /epaper/smart-design
 * Catalog: GET /epaper/smart-design/header-styles (also /admin/epaper/header-styles)
 * Context: GET /epaper/smart-design/context (tenant domain, PRGI, editions)
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { randomUUID } from 'crypto';
import { resolveAdminTenantContext } from './adminTenantContext';
import { putPublicObject } from '../../lib/objectStorage';
import {
  findMainStyleByNumber,
  findSubStyleByNumber,
  getHeaderStyleCatalog,
  resolveStyleNumbers,
  MAX_ISSUE_NUMBER_PER_YEAR,
} from '../../lib/epaper/headerStyleCatalog';
import { computeSmartDesignDaily } from '../../lib/epaper/smartDesignCompute';
import { getPageDimensions, getPageSizeCatalog } from '../../lib/epaper/pageSizeCatalog';

const MAX_IMAGE_BYTES = Math.max(1, Number(process.env.MEDIA_MAX_IMAGE_MB || 10)) * 1024 * 1024;

function cleanText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s || null;
}

function normalizeInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeFloat(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function subEditionScopeKey(subEditionId: string | null | undefined): string {
  return subEditionId ? String(subEditionId).trim() : '';
}

function getMulterFile(req: Request, fieldName: string): { buffer?: Buffer; mimetype?: string; size?: number; fieldname?: string } | null {
  const files: any = (req as any)?.files;
  if (!files) return null;
  if (Array.isArray(files)) {
    return files.find((f: any) => String(f?.fieldname || '') === fieldName) || null;
  }
  const group = files[fieldName];
  if (Array.isArray(group) && group[0]) return group[0];
  return null;
}

async function uploadDesignImage(tenantId: string, file: { buffer?: Buffer; mimetype?: string; size?: number }, slot: string): Promise<string> {
  const mime = String(file?.mimetype || '').toLowerCase();
  if (!mime.startsWith('image/')) throw new Error(`${slot} must be an image`);
  const size = Number(file?.size || 0);
  if (!file?.buffer || size <= 0) throw new Error(`${slot} is empty`);
  if (size > MAX_IMAGE_BYTES) {
    throw new Error(`${slot} too large (max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB)`);
  }
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const d = new Date();
  const datePath = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const key = `epaper/smart-design/${tenantId}/${slot}/${datePath}/${Date.now()}-${randomUUID()}.${ext}`;
  const uploaded = await putPublicObject({ key, body: file.buffer, contentType: mime });
  return uploaded.publicUrl;
}

async function mergeUploads(req: Request, tenantId: string, body: Record<string, any>) {
  const out = { ...body };
  const slots: Array<[string, string]> = [
    ['headerLeftImage', 'header-left'],
    ['headerRightImage', 'header-right'],
    ['headerLogo', 'header-logo'],
    ['subHeaderLogo', 'sub-header-logo'],
    ['paperNameImage', 'paper-name'],
  ];
  for (const [field, slot] of slots) {
    const file = getMulterFile(req, field);
    if (file) {
      const urlKey = field === 'headerLogo' ? 'headerLogoUrl'
        : field === 'subHeaderLogo' ? 'subHeaderLogoUrl'
        : field === 'paperNameImage' ? 'paperNameImageUrl'
        : field === 'headerLeftImage' ? 'headerLeftImageUrl'
        : 'headerRightImageUrl';
      out[urlKey] = await uploadDesignImage(tenantId, file, slot);
    }
  }
  return out;
}

function mapStyleCapabilities(headerStyleNumber: number, subHeaderStyleNumber: number) {
  const main = findMainStyleByNumber(headerStyleNumber);
  const sub = findSubStyleByNumber(subHeaderStyleNumber);
  return {
    mainHeader: main,
    subHeader: sub,
    allowedFields: {
      headerLogoUrl: !!main?.supportsCenterLogo,
      headerLeftImageUrl: !!main?.supportsLeftImage,
      headerRightImageUrl: !!main?.supportsRightImage,
      paperNameImageUrl: !!main?.supportsPaperNameImage,
      subHeaderLogoUrl: !!sub?.supportsSubHeaderCenterImage,
    },
  };
}

function shapeDesignRow(row: any, today?: ReturnType<typeof computeSmartDesignDaily>) {
  const caps = mapStyleCapabilities(row.headerStyleNumber, row.subHeaderStyleNumber);
  return {
    id: row.id,
    tenantId: row.tenantId,
    publicationEditionId: row.publicationEditionId,
    subEditionId: row.subEditionId,
    subEditionScopeKey: row.subEditionScopeKey,
    paperType: row.paperType,
    pageDimensions: getPageDimensions(row.paperType),
    totalPages: row.totalPages,
    perPageCostMonthly: row.perPageCostMonthly,
    paperSellCost: row.paperSellCost,
    headerStyleNumber: row.headerStyleNumber,
    subHeaderStyleNumber: row.subHeaderStyleNumber,
    headerStyleKey: row.headerStyleKey,
    subHeaderStyleKey: row.subHeaderStyleKey,
    headerData: row.headerData,
    headerLogoUrl: row.headerLogoUrl,
    subHeaderLogoUrl: row.subHeaderLogoUrl,
    paperNameImageUrl: row.paperNameImageUrl,
    headerLeftImageUrl: row.headerLeftImageUrl,
    headerRightImageUrl: row.headerRightImageUrl,
    publishedAreaText: row.publishedAreaText,
    tagline: row.tagline,
    websiteUrl: row.websiteUrl,
    runningCommentText: row.runningCommentText,
    runningCommentAuthor: row.runningCommentAuthor,
    rightArticleTitle: row.rightArticleTitle,
    rightArticlePoints: row.rightArticlePoints,
    lastPageFooterText: row.lastPageFooterText,
    volumeStartNumber: row.volumeStartNumber,
    volumeStartYear: row.volumeStartYear,
    issueStartNumber: row.issueStartNumber,
    issueStartDate: row.issueStartDate,
    issueCounterMode: row.issueCounterMode,
    newsCloseTime: row.newsCloseTime,
    languageCode: row.languageCode,
    isActive: row.isActive,
    styleCapabilities: caps,
    publicationEdition: row.publicationEdition,
    subEdition: row.subEdition,
    today: today || computeSmartDesignDaily({
      volumeStartNumber: row.volumeStartNumber,
      volumeStartYear: row.volumeStartYear,
      issueStartNumber: row.issueStartNumber,
      issueStartDate: row.issueStartDate,
      issueCounterMode: row.issueCounterMode,
      newsCloseTime: row.newsCloseTime,
    }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildUpdateData(body: Record<string, any>, isCreate: boolean) {
  const styles = resolveStyleNumbers(body);
  const data: Record<string, any> = {};

  if (isCreate || body.paperType !== undefined) data.paperType = cleanText(body.paperType) || 'TABLOID';
  if (isCreate || body.totalPages !== undefined) data.totalPages = Math.max(1, normalizeInt(body.totalPages ?? body.pageCount, 8));
  if (isCreate || body.perPageCostMonthly !== undefined) {
    data.perPageCostMonthly = normalizeFloat(body.perPageCostMonthly ?? body.perPageCost);
  }
  if (isCreate || body.paperSellCost !== undefined) data.paperSellCost = normalizeFloat(body.paperSellCost);

  if (isCreate || body.headerStyleNumber !== undefined || body.headerStyleKey !== undefined) {
    data.headerStyleNumber = styles.headerStyleNumber;
    data.headerStyleKey = styles.headerStyleKey;
  }
  if (isCreate || body.subHeaderStyleNumber !== undefined || body.subHeaderStyleKey !== undefined) {
    data.subHeaderStyleNumber = styles.subHeaderStyleNumber;
    data.subHeaderStyleKey = styles.subHeaderStyleKey;
  }

  const textFields = [
    'headerData', 'headerLogoUrl', 'subHeaderLogoUrl', 'paperNameImageUrl',
    'headerLeftImageUrl', 'headerRightImageUrl', 'publishedAreaText', 'tagline',
    'websiteUrl', 'runningCommentText', 'runningCommentAuthor',
    'rightArticleTitle', 'rightArticlePoints', 'lastPageFooterText', 'languageCode',
  ] as const;
  for (const f of textFields) {
    if (isCreate || body[f] !== undefined) data[f] = cleanText(body[f]);
  }

  if (isCreate || body.volumeStartNumber !== undefined) {
    data.volumeStartNumber = Math.max(1, normalizeInt(body.volumeStartNumber, 1));
  }
  if (isCreate || body.volumeStartYear !== undefined) {
    data.volumeStartYear = normalizeInt(body.volumeStartYear, new Date().getUTCFullYear());
  }
  if (isCreate || body.issueStartNumber !== undefined) {
    const n = normalizeInt(body.issueStartNumber, 1);
    if (n < 1 || n > MAX_ISSUE_NUMBER_PER_YEAR) {
      throw new Error(`issueStartNumber must be between 1 and ${MAX_ISSUE_NUMBER_PER_YEAR}`);
    }
    data.issueStartNumber = n;
  }
  if (isCreate || body.issueStartDate !== undefined) {
    data.issueStartDate = new Date(String(body.issueStartDate));
  }
  if (isCreate || body.issueCounterMode !== undefined) {
    const mode = String(body.issueCounterMode || 'SEQUENTIAL').toUpperCase();
    data.issueCounterMode = mode === 'DAY_OF_YEAR' ? 'DAY_OF_YEAR' : 'SEQUENTIAL';
  }
  if (isCreate || body.newsCloseTime !== undefined) {
    const t = cleanText(body.newsCloseTime) || '23:00';
    if (!/^\d{2}:\d{2}$/.test(t)) throw new Error('newsCloseTime must be HH:MM');
    data.newsCloseTime = t;
  }
  if (isCreate || body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  return data;
}

async function requireCtx(req: Request, res: Response) {
  const ctx = await resolveAdminTenantContext(req);
  if (!ctx.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  if (!ctx.tenantId) {
    res.status(400).json({ error: 'Tenant context required (X-Tenant-Id)' });
    return null;
  }
  return ctx;
}

export async function getHeaderStylesCatalog(_req: Request, res: Response) {
  try {
    const dbRows = await prisma.epaperHeaderStyle.findMany({ orderBy: [{ type: 'asc' }, { number: 'asc' }] });
    if (dbRows.length) {
      const mainHeaders = dbRows.filter((r) => r.type === 'MAIN');
      const subHeaders = dbRows.filter((r) => r.type === 'SUB');
      return res.json({ source: 'database', mainHeaders, subHeaders, all: dbRows, pageSizes: getPageSizeCatalog() });
    }
    const catalog = getHeaderStyleCatalog();
    return res.json({ source: 'catalog', ...catalog, pageSizes: getPageSizeCatalog() });
  } catch (e: any) {
    console.error('getHeaderStylesCatalog error:', e);
    return res.status(500).json({ error: 'Failed to load header styles' });
  }
}

export async function getSmartDesignContext(req: Request, res: Response) {
  try {
    const ctx = await requireCtx(req, res);
    if (!ctx) return;

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId! },
      select: {
        id: true,
        name: true,
        slug: true,
        prgiNumber: true,
        prgiStatus: true,
        domains: {
          where: { kind: 'EPAPER', status: 'ACTIVE' },
          select: { id: true, domain: true, status: true, kind: true },
          take: 1,
        },
      },
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const editions = await prisma.epaperPublicationEdition.findMany({
      where: { tenantId: ctx.tenantId!, isDeleted: false },
      include: {
        state: { select: { id: true, name: true } },
        subEditions: {
          where: { isDeleted: false },
          select: { id: true, name: true, slug: true, districtId: true },
          orderBy: { name: 'asc' },
        },
        smartDesigns: {
          where: { isDeleted: false },
          select: {
            id: true,
            subEditionScopeKey: true,
            subEditionId: true,
            totalPages: true,
            isActive: true,
            headerStyleNumber: true,
            headerStyleKey: true,
            subHeaderStyleNumber: true,
            subHeaderStyleKey: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const catalog = getHeaderStyleCatalog();
    let totalDesigns = 0;
    const linkedMain = new Set<number>();
    const linkedSub = new Set<number>();

    const shapedEditions = editions.map((e) => {
      totalDesigns += e.smartDesigns.length;
      const linkedHeaderStyles = e.smartDesigns.map((d) => {
        linkedMain.add(d.headerStyleNumber);
        linkedSub.add(d.subHeaderStyleNumber);
        return {
          designId: d.id,
          scope: d.subEditionScopeKey ? 'SUB_EDITION' : 'EDITION',
          subEditionId: d.subEditionId,
          headerStyleNumber: d.headerStyleNumber,
          headerStyleKey: d.headerStyleKey,
          subHeaderStyleNumber: d.subHeaderStyleNumber,
          subHeaderStyleKey: d.subHeaderStyleKey,
        };
      });
      return {
        id: e.id,
        name: e.name,
        slug: e.slug,
        state: e.state,
        subEditions: e.subEditions,
        hasDesign: e.smartDesigns.length > 0,
        designIds: e.smartDesigns.map((d) => d.id),
        linkedHeaderStyles,
      };
    });

    return res.json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      prgiNumber: tenant.prgiNumber,
      prgiStatus: tenant.prgiStatus,
      epaperDomain: tenant.domains[0]?.domain || null,
      epaperDomainId: tenant.domains[0]?.id || null,
      totalEditions: editions.length,
      totalDesigns,
      editions: shapedEditions,
      // Only counts + which styles are actually linked. Full catalog (all 10+10)
      // is served separately at GET /epaper/smart-design/header-styles.
      headerStyleSummary: {
        availableMainHeaders: catalog.mainHeaders.length,
        availableSubHeaders: catalog.subHeaders.length,
        linkedMainHeaderNumbers: [...linkedMain].sort((a, b) => a - b),
        linkedSubHeaderNumbers: [...linkedSub].sort((a, b) => a - b),
        catalogEndpoint: '/epaper/smart-design/header-styles',
      },
      pageSizes: getPageSizeCatalog(),
    });
  } catch (e: any) {
    console.error('getSmartDesignContext error:', e);
    return res.status(500).json({ error: 'Failed to load smart design context' });
  }
}

export async function listSmartDesigns(req: Request, res: Response) {
  try {
    const ctx = await requireCtx(req, res);
    if (!ctx) return;

    const editionId = cleanText((req.query as any).publicationEditionId);
    const subEditionIdFilter = cleanText((req.query as any).subEditionId);
    // editionScope=edition -> only edition-level designs (no sub-edition)
    const editionScope = cleanText((req.query as any).scope);

    const items = await prisma.epaperSmartDesign.findMany({
      where: {
        tenantId: ctx.tenantId!,
        isDeleted: false,
        ...(editionId ? { publicationEditionId: editionId } : {}),
        ...(subEditionIdFilter ? { subEditionId: subEditionIdFilter } : {}),
        ...(editionScope === 'edition' ? { subEditionScopeKey: '' } : {}),
        ...(editionScope === 'sub' ? { subEditionScopeKey: { not: '' } } : {}),
      },
      include: {
        publicationEdition: { select: { id: true, name: true, slug: true } },
        subEdition: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ publicationEditionId: 'asc' }, { subEditionScopeKey: 'asc' }],
    });

    return res.json({
      tenantId: ctx.tenantId,
      filters: { publicationEditionId: editionId, subEditionId: subEditionIdFilter, scope: editionScope },
      total: items.length,
      items: items.map((row) => shapeDesignRow(row)),
    });
  } catch (e: any) {
    console.error('listSmartDesigns error:', e);
    return res.status(500).json({ error: 'Failed to list smart designs' });
  }
}

/**
 * GET /epaper/smart-design/editions
 * One call by tenant -> all editions (+ sub-editions) with their design status & summary.
 * This is the canonical "list everything for this tenant" screen loader.
 */
export async function listEditionsWithDesigns(req: Request, res: Response) {
  try {
    const ctx = await requireCtx(req, res);
    if (!ctx) return;

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId! },
      select: {
        id: true,
        name: true,
        slug: true,
        prgiNumber: true,
        prgiStatus: true,
        domains: {
          where: { kind: 'EPAPER', status: 'ACTIVE' },
          select: { id: true, domain: true, status: true },
          take: 1,
        },
      },
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const editions = await prisma.epaperPublicationEdition.findMany({
      where: { tenantId: ctx.tenantId!, isDeleted: false },
      include: {
        state: { select: { id: true, name: true } },
        subEditions: {
          where: { isDeleted: false },
          select: { id: true, name: true, slug: true, districtId: true },
          orderBy: { name: 'asc' },
        },
        smartDesigns: {
          where: { isDeleted: false },
          include: {
            publicationEdition: { select: { id: true, name: true, slug: true } },
            subEdition: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    let totalDesigns = 0;
    const shaped = editions.map((e) => {
      const designs = e.smartDesigns.map((d) => shapeDesignRow(d));
      totalDesigns += designs.length;
      const editionDesign = designs.find((d) => d.subEditionScopeKey === '') || null;
      const subDesignsById: Record<string, any> = {};
      for (const d of designs) {
        if (d.subEditionId) subDesignsById[d.subEditionId] = d;
      }
      return {
        id: e.id,
        name: e.name,
        slug: e.slug,
        state: e.state,
        editionDesign,
        hasEditionDesign: !!editionDesign,
        subEditions: e.subEditions.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          districtId: s.districtId,
          design: subDesignsById[s.id] || null,
          hasDesign: !!subDesignsById[s.id],
        })),
        designCount: designs.length,
      };
    });

    return res.json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      prgiNumber: tenant.prgiNumber,
      prgiStatus: tenant.prgiStatus,
      epaperDomain: tenant.domains[0]?.domain || null,
      epaperDomainId: tenant.domains[0]?.id || null,
      totalEditions: editions.length,
      totalDesigns,
      editions: shaped,
    });
  } catch (e: any) {
    console.error('listEditionsWithDesigns error:', e);
    return res.status(500).json({ error: 'Failed to load editions' });
  }
}

/**
 * GET /epaper/smart-design/by-edition?publicationEditionId=&subEditionId=
 * Filter by tenant + edition (+ optional sub-edition) -> returns the single matching design or null.
 * Useful to decide whether to show "Create" (POST) or "Edit" (PUT/PATCH) on the UI.
 */
export async function resolveSmartDesignByEdition(req: Request, res: Response) {
  try {
    const ctx = await requireCtx(req, res);
    if (!ctx) return;

    const publicationEditionId = cleanText((req.query as any).publicationEditionId);
    if (!publicationEditionId) {
      return res.status(400).json({ error: 'publicationEditionId query param is required' });
    }
    const subEditionId = cleanText((req.query as any).subEditionId);
    const scopeKey = subEditionScopeKey(subEditionId);

    const edition = await prisma.epaperPublicationEdition.findFirst({
      where: { id: publicationEditionId, tenantId: ctx.tenantId!, isDeleted: false },
      select: { id: true, name: true, slug: true },
    });
    if (!edition) return res.status(404).json({ error: 'Edition not found for this tenant' });

    const row = await prisma.epaperSmartDesign.findFirst({
      where: {
        tenantId: ctx.tenantId!,
        publicationEditionId,
        subEditionScopeKey: scopeKey,
        isDeleted: false,
      },
      include: {
        publicationEdition: { select: { id: true, name: true, slug: true } },
        subEdition: { select: { id: true, name: true, slug: true } },
      },
    });

    return res.json({
      tenantId: ctx.tenantId,
      publicationEditionId,
      subEditionId: subEditionId || null,
      scope: subEditionId ? 'SUB_EDITION' : 'EDITION',
      exists: !!row,
      // tells the UI which action is allowed (POST allowed only once)
      nextAction: row ? 'UPDATE' : 'CREATE',
      design: row ? shapeDesignRow(row) : null,
    });
  } catch (e: any) {
    console.error('resolveSmartDesignByEdition error:', e);
    return res.status(500).json({ error: 'Failed to resolve smart design' });
  }
}

export async function getSmartDesignById(req: Request, res: Response) {
  try {
    const ctx = await requireCtx(req, res);
    if (!ctx) return;

    const row = await prisma.epaperSmartDesign.findFirst({
      where: { id: String(req.params.id), tenantId: ctx.tenantId!, isDeleted: false },
      include: {
        publicationEdition: { select: { id: true, name: true, slug: true, stateId: true } },
        subEdition: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!row) return res.status(404).json({ error: 'Smart design not found' });

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId! },
      select: { prgiNumber: true, domains: { where: { kind: 'EPAPER' }, select: { domain: true }, take: 1 } },
    });

    return res.json({
      design: shapeDesignRow(row),
      prgiNumber: tenant?.prgiNumber,
      epaperDomain: tenant?.domains[0]?.domain || null,
    });
  } catch (e: any) {
    console.error('getSmartDesignById error:', e);
    return res.status(500).json({ error: 'Failed to get smart design' });
  }
}

export async function createSmartDesign(req: Request, res: Response) {
  try {
    const ctx = await requireCtx(req, res);
    if (!ctx) return;

    const body = await mergeUploads(req, ctx.tenantId!, req.body || {});
    const publicationEditionId = cleanText(body.publicationEditionId);
    if (!publicationEditionId) {
      return res.status(400).json({ error: 'publicationEditionId is required' });
    }

    const edition = await prisma.epaperPublicationEdition.findFirst({
      where: { id: publicationEditionId, tenantId: ctx.tenantId!, isDeleted: false },
    });
    if (!edition) return res.status(400).json({ error: 'Invalid publicationEditionId' });

    const subEditionId = cleanText(body.subEditionId);
    if (subEditionId) {
      const sub = await prisma.epaperPublicationSubEdition.findFirst({
        where: { id: subEditionId, tenantId: ctx.tenantId!, editionId: publicationEditionId, isDeleted: false },
      });
      if (!sub) return res.status(400).json({ error: 'Invalid subEditionId for this edition' });
    }

    const scopeKey = subEditionScopeKey(subEditionId);
    const existing = await prisma.epaperSmartDesign.findFirst({
      where: { tenantId: ctx.tenantId!, publicationEditionId, subEditionScopeKey: scopeKey, isDeleted: false },
    });
    if (existing) {
      return res.status(409).json({
        error: 'Design already exists for this edition/sub-edition. Use PUT or PATCH to update.',
        existingId: existing.id,
      });
    }

    if (!body.issueStartDate) {
      return res.status(400).json({ error: 'issueStartDate is required (YYYY-MM-DD)' });
    }

    const data = buildUpdateData(body, true);
    const styles = resolveStyleNumbers(body);
    const currentYear = new Date().getUTCFullYear();

    const row = await prisma.epaperSmartDesign.create({
      data: {
        tenantId: ctx.tenantId!,
        publicationEditionId,
        subEditionScopeKey: scopeKey,
        subEditionId: subEditionId || null,
        volumeStartYear: data.volumeStartYear ?? currentYear,
        issueStartDate: data.issueStartDate ?? new Date(),
        issueStartNumber: data.issueStartNumber ?? 1,
        volumeStartNumber: data.volumeStartNumber ?? 1,
        issueCounterMode: data.issueCounterMode ?? 'SEQUENTIAL',
        newsCloseTime: data.newsCloseTime ?? '23:00',
        languageCode: data.languageCode ?? 'te',
        headerStyleNumber: styles.headerStyleNumber,
        headerStyleKey: styles.headerStyleKey,
        subHeaderStyleNumber: styles.subHeaderStyleNumber,
        subHeaderStyleKey: styles.subHeaderStyleKey,
        ...data,
      },
      include: {
        publicationEdition: { select: { id: true, name: true, slug: true } },
        subEdition: { select: { id: true, name: true, slug: true } },
      },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId! },
      select: { prgiNumber: true, domains: { where: { kind: 'EPAPER' }, select: { domain: true }, take: 1 } },
    });

    return res.status(201).json({
      success: true,
      design: shapeDesignRow(row),
      prgiNumber: tenant?.prgiNumber,
      epaperDomain: tenant?.domains[0]?.domain || null,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('issueStartNumber') || msg.includes('newsCloseTime') || msg.includes('image')) {
      return res.status(400).json({ error: msg });
    }
    console.error('createSmartDesign error:', e);
    return res.status(500).json({ error: 'Failed to create smart design', details: msg });
  }
}

export async function updateSmartDesign(req: Request, res: Response) {
  try {
    const ctx = await requireCtx(req, res);
    if (!ctx) return;

    const existing = await prisma.epaperSmartDesign.findFirst({
      where: { id: String(req.params.id), tenantId: ctx.tenantId!, isDeleted: false },
    });
    if (!existing) return res.status(404).json({ error: 'Smart design not found' });

    const body = await mergeUploads(req, ctx.tenantId!, req.body || {});
    const data = buildUpdateData(body, false);

    const row = await prisma.epaperSmartDesign.update({
      where: { id: existing.id },
      data,
      include: {
        publicationEdition: { select: { id: true, name: true, slug: true } },
        subEdition: { select: { id: true, name: true, slug: true } },
      },
    });

    return res.json({ success: true, design: shapeDesignRow(row) });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('issueStartNumber') || msg.includes('newsCloseTime') || msg.includes('image')) {
      return res.status(400).json({ error: msg });
    }
    console.error('updateSmartDesign error:', e);
    return res.status(500).json({ error: 'Failed to update smart design', details: msg });
  }
}

export async function patchSmartDesign(req: Request, res: Response) {
  return updateSmartDesign(req, res);
}

export async function deleteSmartDesign(req: Request, res: Response) {
  try {
    const ctx = await requireCtx(req, res);
    if (!ctx) return;

    const existing = await prisma.epaperSmartDesign.findFirst({
      where: { id: String(req.params.id), tenantId: ctx.tenantId!, isDeleted: false },
    });
    if (!existing) return res.status(404).json({ error: 'Smart design not found' });

    await prisma.epaperSmartDesign.update({
      where: { id: existing.id },
      data: { isDeleted: true, isActive: false },
    });

    return res.json({ success: true, id: existing.id, message: 'Smart design deleted' });
  } catch (e: any) {
    console.error('deleteSmartDesign error:', e);
    return res.status(500).json({ error: 'Failed to delete smart design' });
  }
}
