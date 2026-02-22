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
  // Build media array: [ { url, caption } ]
  // mediaUrls is stored as String[]. Captions are not separately persisted yet,
  // so we default caption to null for now (can be extended via mediaCaptions field).
  const mediaUrls: string[] = Array.isArray(article.mediaUrls) ? article.mediaUrls : [];
  const media = mediaUrls.map((url: string, idx: number) => ({
    url,
    caption: Array.isArray(article.mediaCaptions) ? (article.mediaCaptions[idx] ?? null) : null,
  }));

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
