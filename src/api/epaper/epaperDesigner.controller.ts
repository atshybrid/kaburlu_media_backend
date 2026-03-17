/**
 * Epaper Designer Controller
 *
 * Provides block-wise article data for the Epaper Designer tool and lets
 * editors assign/update the template block ID on each NewspaperArticle.
 *
 * All endpoints require JWT auth + admin/editor scope (resolved via
 * resolveAdminTenantContext – same pattern as the rest of the epaper module).
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { resolveAdminTenantContext } from './adminTenantContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

type SmartDesignerAccess =
  | { ok: true; tenantId: string; roleName: string; userId: string }
  | { ok: false; status: number; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseIntOrNull(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function parseDateOnly(value: unknown): { y: number; m: number; d: number } | null {
  const s = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function currentIstDateOnly(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function istLocalToUtc(dateStr: string, hh: number, mm: number, ss = 0, ms = 0): Date {
  const parts = parseDateOnly(dateStr);
  if (!parts) return new Date(NaN);
  const utcMs = Date.UTC(parts.y, parts.m - 1, parts.d, hh, mm, ss, ms) - IST_OFFSET_MS;
  return new Date(utcMs);
}

function parseBool(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const s = String(value).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return fallback;
}

async function resolveSmartDesignerAccess(req: Request): Promise<SmartDesignerAccess> {
  const user: any = (req as any).user;
  const userId = String(user?.id || '').trim();
  const roleName = String(user?.role?.name || '').trim().toUpperCase();

  if (!userId || !roleName) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const allowedRoles = new Set([
    'SUPER_ADMIN',
    'SUPERADMIN',
    'ADMIN',
    'TENANT_ADMIN',
    'REPORTER',
    'DESK_EDITOR',
    // Backward-compatible aliases seen in codebase
    'ADMIN_EDITOR',
    'TENANT_EDITOR',
  ]);

  if (!allowedRoles.has(roleName)) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: role not allowed. Allowed roles: SUPER_ADMIN, ADMIN, TENANT_ADMIN, REPORTER, DESK_EDITOR',
    };
  }

  const requestedTenantId = String((req.query as any)?.tenantId || req.headers['x-tenant-id'] || '').trim();

  if (roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN') {
    if (!requestedTenantId) {
      return { ok: false, status: 400, error: 'tenantId is required for SUPER_ADMIN' };
    }
    return { ok: true, tenantId: requestedTenantId, roleName, userId };
  }

  // Prefer tenant mapping from reporter profile where available.
  const reporterProfile = await p.reporter
    .findFirst({ where: { userId }, select: { tenantId: true } })
    .catch(() => null);
  const mappedTenantId = String(reporterProfile?.tenantId || '').trim();

  if (mappedTenantId) {
    if (requestedTenantId && requestedTenantId !== mappedTenantId) {
      return { ok: false, status: 403, error: 'Tenant scope mismatch for this token' };
    }
    return { ok: true, tenantId: mappedTenantId, roleName, userId };
  }

  // Admin-like users without reporter mapping can pass explicit tenantId.
  if (requestedTenantId && ['ADMIN', 'TENANT_ADMIN', 'DESK_EDITOR', 'ADMIN_EDITOR', 'TENANT_EDITOR'].includes(roleName)) {
    return { ok: true, tenantId: requestedTenantId, roleName, userId };
  }

  if (roleName === 'REPORTER') {
    return { ok: false, status: 403, error: 'Reporter profile tenant linkage not found' };
  }

  return { ok: false, status: 400, error: 'tenantId is required for this role' };
}

function priorityRank(priority: number | null | undefined): number {
  if (priority === 1) return 1;
  if (priority === 2) return 2;
  if (priority === 3) return 3;
  return 99;
}

function resolveSmartSection(block: any): { key: string; title: string; reason: string } {
  const categoryName = String(block?.category?.name || '').trim().toLowerCase();

  if (block?.isBreaking || Number(block?.priority) === 1) {
    return { key: 'FRONT_PAGE', title: 'Front Page', reason: 'Breaking and high-priority stories' };
  }

  if (categoryName.includes('politic')) {
    return { key: 'POLITICS', title: 'Politics', reason: 'Category-driven grouping' };
  }
  if (categoryName.includes('sport')) {
    return { key: 'SPORTS', title: 'Sports', reason: 'Category-driven grouping' };
  }
  if (categoryName.includes('business') || categoryName.includes('econom')) {
    return { key: 'BUSINESS', title: 'Business', reason: 'Category-driven grouping' };
  }

  if (block?.location?.districtId || block?.location?.mandalId || block?.location?.villageId) {
    return { key: 'DISTRICT_NEWS', title: 'District News', reason: 'Location-driven grouping' };
  }

  return { key: 'GENERAL_NEWS', title: 'General News', reason: 'Fallback section' };
}

function sanitizeSmartSectionArticle(block: any): any {
  const location = block?.location && typeof block.location === 'object' ? { ...block.location } : {};
  delete location.mandalId;
  delete location.mandalName;
  delete location.villageId;
  delete location.villageName;

  const next = { ...block, location };
  delete next.lead;
  return next;
}

async function enrichArticlesWithLocationNames(articles: any[]) {
  if (!Array.isArray(articles) || articles.length === 0) return articles;

  const uniqueIds = (values: any[]) => Array.from(new Set(values.filter(Boolean).map((v) => String(v))));

  const stateIds = uniqueIds(articles.map((a) => a.stateId));
  const districtIds = uniqueIds(articles.map((a) => a.districtId));
  const mandalIds = uniqueIds(articles.map((a) => a.mandalId));
  const villageIds = uniqueIds(articles.map((a) => a.villageId));

  const [states, districts, mandals, villages] = await Promise.all([
    stateIds.length ? p.state.findMany({ where: { id: { in: stateIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    districtIds.length ? p.district.findMany({ where: { id: { in: districtIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    mandalIds.length ? p.mandal.findMany({ where: { id: { in: mandalIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    villageIds.length ? p.village.findMany({ where: { id: { in: villageIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const stateMap = new Map(states.map((s: any) => [String(s.id), s.name]));
  const districtMap = new Map(districts.map((d: any) => [String(d.id), d.name]));
  const mandalMap = new Map(mandals.map((m: any) => [String(m.id), m.name]));
  const villageMap = new Map(villages.map((v: any) => [String(v.id), v.name]));

  return articles.map((article) => ({
    ...article,
    _resolvedLocationNames: {
      stateName: article.stateId ? stateMap.get(String(article.stateId)) ?? null : null,
      districtName: article.districtId ? districtMap.get(String(article.districtId)) ?? null : null,
      mandalName: article.mandalId ? mandalMap.get(String(article.mandalId)) ?? null : null,
      villageName: article.villageId ? villageMap.get(String(article.villageId)) ?? null : null,
    },
  }));
}

/**
 * Map a raw NewspaperArticle DB row into a designer block payload.
 * Keeps the response structure stable regardless of nullable fields.
 */
function toDesignerBlock(article: any) {
  // Build media array: [ { url, caption, alt, afterParagraph } ]
  const mediaMeta: any[] = Array.isArray(article.mediaMeta) ? article.mediaMeta : [];
  const mediaUrls: string[] = Array.isArray(article.mediaUrls) ? article.mediaUrls : [];
  const mediaCaptions: string[] = Array.isArray(article.mediaCaptions) ? article.mediaCaptions : [];

  const media = mediaUrls.map((url: string, idx: number) => {
    const meta = mediaMeta.find((m: any) => String(m?.url || '') === url);
    const caption = meta?.caption ?? (mediaCaptions[idx] || null);
    return {
      url,
      caption,
      alt: meta?.alt ?? null,
      afterParagraph: meta?.afterParagraph ?? null,
    };
  });

  return {
    // ── Core identity ────────────────────────────────────────────────────────
    id: article.id,
    status: article.status,
    isBreaking: article.isBreaking ?? false,
    priority: article.priority ?? 0,

    // ── Article content fields ───────────────────────────────────────────────
    title: article.title ?? null,
    subTitle: article.subTitle ?? null,
    heading: article.heading ?? null,
    dateline: article.dateline ?? null,
    points: Array.isArray(article.points) ? article.points : [],
    lead: article.lead ?? null,
    contentParagraphs: Array.isArray(article.contentParagraphs) ? article.contentParagraphs : [],
    content: article.content ?? null,

    // ── Character / word counts ──────────────────────────────────────────────
    charCount: article.charCount ?? null,
    wordCount: article.wordCount ?? null,

    // ── Media ────────────────────────────────────────────────────────────────
    featuredImageUrl: article.featuredImageUrl ?? null,
    media,

    // ── Category ─────────────────────────────────────────────────────────────
    category: article.category
      ? { id: article.category.id, name: article.category.name, slug: article.category.slug ?? null }
      : null,

    // ── Location details ──────────────────────────────────────────────────────
    location: {
      stateId: article.stateId ?? null,
      stateName: article._resolvedLocationNames?.stateName ?? null,
      districtId: article.districtId ?? null,
      districtName: article._resolvedLocationNames?.districtName ?? null,
      mandalId: article.mandalId ?? null,
      mandalName: article._resolvedLocationNames?.mandalName ?? null,
      villageId: article.villageId ?? null,
      villageName: article._resolvedLocationNames?.villageName ?? null,
      placeName: article.placeName ?? null,
    },

    // ── Language ─────────────────────────────────────────────────────────────
    languageId: article.languageId ?? null,
    languageName: article.language?.name ?? null,

    // ── Template block ───────────────────────────────────────────────────────
    assignedBlockTemplateId: article.assignedBlockTemplateId ?? null,
    assignedBlockTemplate: article.assignedBlockTemplate
      ? {
          id: article.assignedBlockTemplate.id,
          code: article.assignedBlockTemplate.code,
          name: article.assignedBlockTemplate.name,
          category: article.assignedBlockTemplate.category,
          subCategory: article.assignedBlockTemplate.subCategory,
          columns: article.assignedBlockTemplate.columns,
          widthInches: article.assignedBlockTemplate.widthInches,
          minHeightInches: article.assignedBlockTemplate.minHeightInches,
          maxHeightInches: article.assignedBlockTemplate.maxHeightInches,
        }
      : null,
    suggestedBlockTemplateId: article.suggestedBlockTemplateId ?? null,
    suggestedBlockTemplate: article.suggestedBlockTemplate
      ? {
          id: article.suggestedBlockTemplate.id,
          code: article.suggestedBlockTemplate.code,
          name: article.suggestedBlockTemplate.name,
          category: article.suggestedBlockTemplate.category,
          subCategory: article.suggestedBlockTemplate.subCategory,
          columns: article.suggestedBlockTemplate.columns,
          widthInches: article.suggestedBlockTemplate.widthInches,
          minHeightInches: article.suggestedBlockTemplate.minHeightInches,
          maxHeightInches: article.suggestedBlockTemplate.maxHeightInches,
        }
      : null,
    layoutSuggestion: article.layoutSuggestion ?? null,

    // ── Author ───────────────────────────────────────────────────────────────
    authorId: article.authorId,
    authorName:
      article.author?.profile?.fullName ??
      ([article.author?.profile?.surname, article.author?.profile?.lastName].filter(Boolean).join(' ').trim() || null) ??
      article.author?.email ??
      article.author?.mobileNumber ??
      null,

    // ── Timestamps ───────────────────────────────────────────────────────────
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}

// Common Prisma include for all designer queries
const DESIGNER_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  language: { select: { id: true, name: true } },
  author: {
    select: {
      id: true,
      email: true,
      mobileNumber: true,
      profile: { select: { fullName: true, surname: true, lastName: true } },
    },
  },
  assignedBlockTemplate: {
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      subCategory: true,
      columns: true,
      widthInches: true,
      minHeightInches: true,
      maxHeightInches: true,
    },
  },
  suggestedBlockTemplate: {
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      subCategory: true,
      columns: true,
      widthInches: true,
      minHeightInches: true,
      maxHeightInches: true,
    },
  },
} as const;

// ============================================================================
// GET /epaper/designer/articles
// ============================================================================

/**
 * List NewspaperArticles formatted as designer blocks.
 *
 * Filters (all optional):
 *   tenantId          – required for SUPER_ADMIN; inferred for others
 *   status            – DRAFT | PUBLISHED | APPROVED | …
 *   categoryId        – category filter
 *   stateId           – location filter
 *   districtId        – location filter
 *   mandalId          – location filter
 *   fromDate / toDate – createdAt range (ISO 8601)
 *   search            – substring in title / content
 *   hasTemplate       – "true"/"false" – filter articles that already have an assigned block template
 *   page / pageSize   – pagination (default: page=1, pageSize=50, max=200)
 */
export const getDesignerArticles = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Tenant context required – pass tenantId query param or authenticate with a tenant-scoped account' });
    }

    const q = req.query as Record<string, string | undefined>;

    // Pagination
    const pageRaw = parseIntOrNull(q.page);
    const pageSizeRaw = parseIntOrNull(q.pageSize ?? q.limit);
    const page = pageRaw && pageRaw > 0 ? pageRaw : 1;
    const pageSize = pageSizeRaw && pageSizeRaw > 0 ? Math.min(pageSizeRaw, 200) : 50;
    const skip = (page - 1) * pageSize;

    // Build where
    const where: Record<string, unknown> = { tenantId: ctx.tenantId };

    if (q.status) where.status = q.status;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.stateId) where.stateId = q.stateId;
    if (q.districtId) where.districtId = q.districtId;
    if (q.mandalId) where.mandalId = q.mandalId;
    if (q.languageId) where.languageId = q.languageId;

    // Date range on createdAt
    const fromDate = parseDateOrNull(q.fromDate);
    const toDate = parseDateOrNull(q.toDate);
    if (fromDate || toDate) {
      const createdAt: Record<string, Date> = {};
      if (fromDate) createdAt.gte = fromDate;
      if (toDate) createdAt.lte = toDate;
      where.createdAt = createdAt;
    }

    // Full-text search on title or content
    if (q.search) {
      const term = q.search.trim();
      if (term) {
        where.OR = [
          { title: { contains: term, mode: 'insensitive' } },
          { content: { contains: term, mode: 'insensitive' } },
          { heading: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    // Template filter
    if (q.hasTemplate === 'true') {
      where.assignedBlockTemplateId = { not: null };
    } else if (q.hasTemplate === 'false') {
      where.assignedBlockTemplateId = null;
    }

    const [total, articles] = await Promise.all([
      p.newspaperArticle.count({ where }),
      p.newspaperArticle.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: DESIGNER_INCLUDE,
      }),
    ]);

    const articlesWithLocations = await enrichArticlesWithLocationNames(articles);
    const blocks = articlesWithLocations.map(toDesignerBlock);

    return res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      blocks,
    });
  } catch (e: any) {
    console.error('[epaperDesigner] getDesignerArticles:', e);
    return res.status(500).json({ error: 'Failed to fetch designer articles', details: String(e?.message ?? e) });
  }
};

// ============================================================================
// GET /epaper/designer/articles/:articleId
// ============================================================================

/**
 * Get a single NewspaperArticle formatted as a designer block.
 */
export const getDesignerArticle = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const articleId = String(req.params.articleId || '').trim();
    if (!articleId) return res.status(400).json({ error: 'articleId is required' });

    const article = await p.newspaperArticle.findFirst({
      where: { id: articleId, tenantId: ctx.tenantId },
      include: DESIGNER_INCLUDE,
    });

    if (!article) return res.status(404).json({ error: 'Article not found' });

    const [articleWithLocations] = await enrichArticlesWithLocationNames([article]);

    return res.json({ block: toDesignerBlock(articleWithLocations) });
  } catch (e: any) {
    console.error('[epaperDesigner] getDesignerArticle:', e);
    return res.status(500).json({ error: 'Failed to fetch designer article', details: String(e?.message ?? e) });
  }
};

// ============================================================================
// PATCH /epaper/designer/articles/:articleId/block-template
// ============================================================================

/**
 * Assign (or clear) the template block ID on a NewspaperArticle.
 *
 * Body:
 *   { templateBlockId: string | null }
 *
 * Pass null to clear the assignment.
 */
export const assignBlockTemplate = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const articleId = String(req.params.articleId || '').trim();
    if (!articleId) return res.status(400).json({ error: 'articleId is required' });

    const raw = req.body as any;
    const templateBlockId = raw.templateBlockId !== undefined ? raw.templateBlockId : null;

    // Validate templateBlockId if provided
    if (templateBlockId !== null) {
      const tplId = String(templateBlockId).trim();
      if (!tplId) {
        return res.status(400).json({ error: 'templateBlockId must be a non-empty string or null' });
      }

      // Verify the template exists and is accessible
      const template = await p.epaperBlockTemplate.findFirst({
        where: {
          id: tplId,
          OR: [{ isGlobal: true }, { tenantId: ctx.tenantId }],
        },
        select: { id: true, code: true, name: true, category: true, subCategory: true, columns: true, widthInches: true, minHeightInches: true, maxHeightInches: true },
      });
      if (!template) {
        return res.status(404).json({ error: 'Block template not found or not accessible for this tenant' });
      }
    }

    // Verify article belongs to tenant
    const existing = await p.newspaperArticle.findFirst({
      where: { id: articleId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Article not found' });

    const updated = await p.newspaperArticle.update({
      where: { id: articleId },
      data: {
        assignedBlockTemplateId: templateBlockId ? String(templateBlockId).trim() : null,
      },
      include: DESIGNER_INCLUDE,
    });

    const [updatedWithLocations] = await enrichArticlesWithLocationNames([updated]);

    return res.json({
      ok: true,
      message: templateBlockId ? 'Block template assigned successfully' : 'Block template cleared',
      block: toDesignerBlock(updatedWithLocations),
    });
  } catch (e: any) {
    console.error('[epaperDesigner] assignBlockTemplate:', e);
    return res.status(500).json({ error: 'Failed to assign block template', details: String(e?.message ?? e) });
  }
};

// ============================================================================
// GET /epaper/designer/templates
// ============================================================================

/**
 * List available block templates for the designer palette.
 * Returns global + tenant-specific active templates.
 */
export const getDesignerTemplates = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const q = req.query as Record<string, string | undefined>;

    const where: any = {
      OR: [{ isGlobal: true, status: 'ACTIVE' }, { tenantId: ctx.tenantId }],
    };

    if (q.category) where.category = q.category;
    if (q.subCategory) where.subCategory = q.subCategory;
    if (q.columns) where.columns = parseInt(q.columns, 10);
    if (q.status) where.status = q.status;

    const templates = await p.epaperBlockTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { columns: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        category: true,
        subCategory: true,
        columns: true,
        widthInches: true,
        minHeightInches: true,
        maxHeightInches: true,
        previewImageUrl: true,
        status: true,
        isGlobal: true,
        tenantId: true,
        components: true,
      },
    });

    return res.json({ count: templates.length, templates });
  } catch (e: any) {
    console.error('[epaperDesigner] getDesignerTemplates:', e);
    return res.status(500).json({ error: 'Failed to fetch designer templates', details: String(e?.message ?? e) });
  }
};

// ============================================================================
// GET /epaper/designer/sections/smart
// ============================================================================

/**
 * Smart section builder for Digital Paper Design.
 *
 * Returns grouped article blocks that can be directly used by the designer UI
 * for section-wise rendering (Front Page, District, Category sections).
 */
export const getSmartDesignSections = async (req: Request, res: Response) => {
  try {
    const access = await resolveSmartDesignerAccess(req);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const q = req.query as Record<string, string | undefined>;
    const status = String(q.status || 'PUBLISHED').trim();
    const issueDate = q.issueDate && String(q.issueDate).trim() ? String(q.issueDate).trim() : currentIstDateOnly();
    const limitRaw = parseIntOrNull(q.limit);
    const limit = limitRaw && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;
    const includeArticles = parseBool(q.includeArticles, true);
    const maxArticlesPerSectionRaw = parseIntOrNull(q.maxArticlesPerSection);
    const maxArticlesPerSection = maxArticlesPerSectionRaw && maxArticlesPerSectionRaw > 0
      ? Math.min(maxArticlesPerSectionRaw, 100)
      : null;

    if (!parseDateOnly(issueDate)) {
      return res.status(400).json({ error: 'issueDate must be YYYY-MM-DD (IST date)' });
    }

    const dayStartUtc = istLocalToUtc(issueDate, 0, 0, 0, 0);
    const dayEndUtc = istLocalToUtc(issueDate, 23, 59, 59, 999);

    const where: any = {
      tenantId: access.tenantId,
      createdAt: { gte: dayStartUtc, lte: dayEndUtc },
    };

    if (status && status.toUpperCase() !== 'ALL') {
      where.status = status;
    }

    const rawArticles = await p.newspaperArticle.findMany({
      where,
      orderBy: [{ isBreaking: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: DESIGNER_INCLUDE,
    });

    const enriched = await enrichArticlesWithLocationNames(rawArticles);
    const blocks = enriched.map(toDesignerBlock);

    const sectionMap = new Map<string, any>();

    for (const block of blocks) {
      const sec = resolveSmartSection(block);
      if (!sectionMap.has(sec.key)) {
        sectionMap.set(sec.key, {
          key: sec.key,
          title: sec.title,
          reason: sec.reason,
          totalArticles: 0,
          totalWordCount: 0,
          totalCharCount: 0,
          templateUsage: new Map<string, number>(),
          articles: [] as any[],
        });
      }

      const node = sectionMap.get(sec.key);
      node.totalArticles += 1;
      node.totalWordCount += Number(block.wordCount || 0);
      node.totalCharCount += Number(block.charCount || 0);

      const templateCode = String(block.assignedBlockTemplate?.code || 'UNASSIGNED');
      node.templateUsage.set(templateCode, (node.templateUsage.get(templateCode) || 0) + 1);

      if (includeArticles) {
        node.articles.push(sanitizeSmartSectionArticle(block));
      }
    }

    const sectionOrder = ['FRONT_PAGE', 'POLITICS', 'BUSINESS', 'SPORTS', 'DISTRICT_NEWS', 'GENERAL_NEWS'];

    const sections = Array.from(sectionMap.values())
      .map((node: any) => {
        const templateEntries = Array.from((node.templateUsage as Map<string, number>).entries()) as Array<[string, number]>;
        const templateUsage = templateEntries
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count);

        let articles = Array.isArray(node.articles) ? node.articles : [];
        articles = articles.sort((a: any, b: any) => {
          if (Boolean(a?.isBreaking) !== Boolean(b?.isBreaking)) {
            return a?.isBreaking ? -1 : 1;
          }
          const pr = priorityRank(a?.priority) - priorityRank(b?.priority);
          if (pr !== 0) return pr;
          return new Date(String(b?.createdAt || 0)).getTime() - new Date(String(a?.createdAt || 0)).getTime();
        });

        if (maxArticlesPerSection) {
          articles = articles.slice(0, maxArticlesPerSection);
        }

        return {
          key: node.key,
          title: node.title,
          reason: node.reason,
          totalArticles: node.totalArticles,
          totalWordCount: node.totalWordCount,
          totalCharCount: node.totalCharCount,
          templateUsage,
          articles,
        };
      })
      .sort((a: any, b: any) => {
        const ai = sectionOrder.indexOf(a.key);
        const bi = sectionOrder.indexOf(b.key);
        if (ai !== -1 || bi !== -1) {
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        }
        return b.totalArticles - a.totalArticles;
      });

    const totals = sections.reduce(
      (acc: any, s: any) => {
        acc.totalSections += 1;
        acc.totalArticles += Number(s.totalArticles || 0);
        acc.totalWordCount += Number(s.totalWordCount || 0);
        acc.totalCharCount += Number(s.totalCharCount || 0);
        return acc;
      },
      { totalSections: 0, totalArticles: 0, totalWordCount: 0, totalCharCount: 0 }
    );

    return res.json({
      tenantId: access.tenantId,
      role: access.roleName,
      issueDate,
      filters: {
        status: status.toUpperCase(),
        limit,
        includeArticles,
        maxArticlesPerSection,
      },
      totals,
      sections,
    });
  } catch (e: any) {
    console.error('[epaperDesigner] getSmartDesignSections:', e);
    return res.status(500).json({ error: 'Failed to build smart design sections', details: String(e?.message ?? e) });
  }
};
