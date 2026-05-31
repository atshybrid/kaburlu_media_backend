/**
 * ePaper Smart Design — Collect News
 *
 * GET /epaper/smart-design/collect-news
 *
 * Collects PUBLISHED reporter articles for the issue day (00:00 IST → newsCloseTime IST),
 * sized to the edition's page capacity, and distributes them FAIRLY:
 *   1. District-wise round-robin (each district gets a turn)
 *   2. Reporter-wise round-robin inside each district (equal share; empty reporters skipped)
 * If the tenant has fewer articles than capacity, it borrows other tenants' published
 * articles for the same day and re-attributes them to this tenant's reporters (flagged).
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { resolveAdminTenantContext } from './adminTenantContext';
import { nowIST, parseHHMM } from '../../lib/epaper/smartDesignCompute';

const DEFAULT_PER_PAGE = 12;       // max news per content page (≈300 words ≈ 10–12 / page)
const HARD_MAX_ARTICLES = 200;     // safety ceiling

type ArticleRow = {
  id: string;
  tenantId: string;
  authorId: string;
  districtId: string | null;
  title: string;
  heading: string;
  subTitle: string | null;
  dateline: string;
  content: string;
  placeName: string | null;
  status: string;
  isBreaking: boolean;
  priority: number;
  wordCount: number | null;
  charCount: number | null;
  featuredImageUrl: string | null;
  mediaUrls: string[];
  languageId: string | null;
  createdAt: Date;
  author: { id: string; mobileNumber: string | null; profile: { fullName: string | null } | null } | null;
};

function cleanText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s || null;
}

/** Build the issue-day news window [00:00 IST, newsCloseTime IST] as UTC Date bounds. */
function buildNewsWindow(issueDateInput: string | null, newsCloseTime: string) {
  let y: number, m: number, d: number;
  if (issueDateInput && /^\d{4}-\d{2}-\d{2}$/.test(issueDateInput)) {
    const [yy, mm, dd] = issueDateInput.split('-').map(Number);
    y = yy; m = mm; d = dd;
  } else {
    const t = nowIST();
    y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate();
  }
  const issueDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const { hours, minutes } = parseHHMM(newsCloseTime);
  const close = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const fromUtc = new Date(`${issueDate}T00:00:00+05:30`);
  const toUtc = new Date(`${issueDate}T${close}:00+05:30`);
  return { issueDate, close, fromUtc, toUtc };
}

const ARTICLE_SELECT = {
  id: true, tenantId: true, authorId: true, districtId: true,
  title: true, heading: true, subTitle: true, dateline: true, content: true, placeName: true,
  status: true, isBreaking: true, priority: true, wordCount: true, charCount: true,
  featuredImageUrl: true, mediaUrls: true, languageId: true, createdAt: true,
  author: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } },
} as const;

/**
 * Fair distribution: district-wise round-robin, reporter-wise round-robin within district.
 * One pick per district per outer round; reporters rotate inside each district.
 */
function fairDistribute(articles: ArticleRow[], capacity: number): ArticleRow[] {
  if (capacity <= 0 || articles.length === 0) return [];

  const districts = new Map<string, Map<string, ArticleRow[]>>();
  for (const a of articles) {
    const dk = a.districtId || '__none__';
    const rk = a.authorId;
    if (!districts.has(dk)) districts.set(dk, new Map());
    const rmap = districts.get(dk)!;
    if (!rmap.has(rk)) rmap.set(rk, []);
    rmap.get(rk)!.push(a);
  }

  // Sort each reporter queue: breaking first, then priority desc, then oldest first.
  const sortQueue = (q: ArticleRow[]) =>
    q.sort((a, b) =>
      Number(b.isBreaking) - Number(a.isBreaking) ||
      b.priority - a.priority ||
      a.createdAt.getTime() - b.createdAt.getTime(),
    );

  const districtState = [...districts.entries()].map(([dk, rmap]) => ({
    dk,
    reporters: [...rmap.entries()].map(([rk, q]) => ({ rk, q: sortQueue(q), idx: 0 })),
    rPtr: 0,
  }));

  const result: ArticleRow[] = [];
  let progress = true;
  while (result.length < capacity && progress) {
    progress = false;
    for (const ds of districtState) {
      if (result.length >= capacity) break;
      const n = ds.reporters.length;
      if (n === 0) continue;
      // Find next reporter (from rPtr, wrapping once) that still has an article.
      for (let step = 0; step < n; step++) {
        const r = ds.reporters[(ds.rPtr + step) % n];
        if (r.idx < r.q.length) {
          result.push(r.q[r.idx]);
          r.idx += 1;
          ds.rPtr = (ds.rPtr + step + 1) % n;
          progress = true;
          break;
        }
      }
    }
  }
  return result;
}

function shapeArticle(
  a: ArticleRow,
  districtNames: Map<string, string>,
  opts?: { borrowed?: boolean; originalTenantName?: string | null; assignedReporter?: { reporterId: string; userId: string | null; name: string } | null },
) {
  return {
    id: a.id,
    title: a.title,
    heading: a.heading,
    subTitle: a.subTitle,
    dateline: a.dateline,
    content: a.content,
    placeName: a.placeName,
    wordCount: a.wordCount ?? (a.content ? a.content.trim().split(/\s+/).length : 0),
    charCount: a.charCount ?? (a.content ? a.content.length : 0),
    status: a.status,
    isBreaking: a.isBreaking,
    priority: a.priority,
    featuredImageUrl: a.featuredImageUrl,
    mediaUrls: a.mediaUrls || [],
    languageId: a.languageId,
    createdAt: a.createdAt,
    districtId: a.districtId,
    districtName: a.districtId ? districtNames.get(a.districtId) || null : null,
    author: {
      id: a.author?.id || a.authorId,
      name: a.author?.profile?.fullName || null,
      mobile: a.author?.mobileNumber || null,
    },
    source: opts?.borrowed ? 'BORROWED' : 'TENANT',
    ...(opts?.borrowed
      ? {
          borrowedFrom: { tenantId: a.tenantId, tenantName: opts.originalTenantName || null },
          assignedReporter: opts.assignedReporter || null,
        }
      : {}),
  };
}

export async function collectEpaperNews(req: Request, res: Response) {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required (X-Tenant-Id)' });

    const q = req.query as any;
    const publicationEditionId = cleanText(q.publicationEditionId);
    if (!publicationEditionId) {
      return res.status(400).json({ error: 'publicationEditionId query param is required' });
    }
    const subEditionId = cleanText(q.subEditionId);
    const issueDateInput = cleanText(q.issueDate);
    const allowCrossTenant = String(q.allowCrossTenant ?? 'true').toLowerCase() !== 'false';
    const excludeMainPage = String(q.excludeMainPage ?? 'true').toLowerCase() !== 'false';
    const perPage = Math.min(50, Math.max(1, Number(q.perPage) || DEFAULT_PER_PAGE));

    const scopeKey = subEditionId || '';
    const design = await prisma.epaperSmartDesign.findFirst({
      where: { tenantId: ctx.tenantId, publicationEditionId, subEditionScopeKey: scopeKey, isDeleted: false },
      include: {
        publicationEdition: { select: { id: true, name: true, slug: true } },
        subEdition: { select: { id: true, name: true, slug: true, districtId: true } },
      },
    });
    if (!design) {
      return res.status(404).json({
        error: 'No smart design found for this edition/sub-edition. Create the design first.',
      });
    }

    const totalPages = design.totalPages;
    const contentPages = excludeMainPage ? Math.max(0, totalPages - 1) : totalPages;
    const maxArticles = Math.min(HARD_MAX_ARTICLES, contentPages * perPage);

    const districtScopeId = design.subEdition?.districtId || null;
    const { issueDate, close, fromUtc, toUtc } = buildNewsWindow(issueDateInput, design.newsCloseTime);

    const baseWhere = {
      status: 'PUBLISHED',
      createdAt: { gte: fromUtc, lte: toUtc },
      ...(districtScopeId ? { districtId: districtScopeId } : {}),
    };

    const tenantArticles = (await prisma.newspaperArticle.findMany({
      where: { tenantId: ctx.tenantId, ...baseWhere },
      select: ARTICLE_SELECT,
      orderBy: [{ isBreaking: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }],
    })) as unknown as ArticleRow[];

    const selectedTenant = fairDistribute(tenantArticles, maxArticles);

    // Cross-tenant fallback to fill remaining capacity.
    let selectedBorrowed: ArticleRow[] = [];
    let tenantReporterPool: Array<{ reporterId: string; userId: string | null; name: string }> = [];
    const originalTenantNames = new Map<string, string>();

    const remaining = maxArticles - selectedTenant.length;
    if (allowCrossTenant && remaining > 0) {
      const others = (await prisma.newspaperArticle.findMany({
        where: { tenantId: { not: ctx.tenantId }, ...baseWhere },
        select: ARTICLE_SELECT,
        orderBy: [{ isBreaking: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }],
        take: remaining * 5,
      })) as unknown as ArticleRow[];
      selectedBorrowed = fairDistribute(others, remaining);

      if (selectedBorrowed.length > 0) {
        // This tenant's reporters → used to re-attribute borrowed articles.
        const reporters = await prisma.reporter.findMany({
          where: { tenantId: ctx.tenantId, active: true },
          select: { id: true, userId: true, user: { select: { profile: { select: { fullName: true } } } } },
          orderBy: { createdAt: 'asc' },
        });
        tenantReporterPool = reporters
          .map((r) => ({ reporterId: r.id, userId: r.userId, name: r.user?.profile?.fullName || '' }))
          .filter((r) => r.name);

        const tenantIds = [...new Set(selectedBorrowed.map((a) => a.tenantId))];
        const tenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } });
        for (const t of tenants) originalTenantNames.set(t.id, t.name);
      }
    }

    // Resolve district names for everything selected.
    const districtIds = [
      ...new Set([...selectedTenant, ...selectedBorrowed].map((a) => a.districtId).filter(Boolean) as string[]),
    ];
    const districtNames = new Map<string, string>();
    if (districtIds.length) {
      const dists = await prisma.district.findMany({ where: { id: { in: districtIds } }, select: { id: true, name: true } });
      for (const di of dists) districtNames.set(di.id, di.name);
    }

    const shapedTenant = selectedTenant.map((a) => shapeArticle(a, districtNames));
    const shapedBorrowed = selectedBorrowed.map((a, i) => {
      const assigned = tenantReporterPool.length ? tenantReporterPool[i % tenantReporterPool.length] : null;
      return shapeArticle(a, districtNames, {
        borrowed: true,
        originalTenantName: originalTenantNames.get(a.tenantId) || null,
        assignedReporter: assigned,
      });
    });

    const allSelected = [...shapedTenant, ...shapedBorrowed];

    // Page buckets (page 1 = main page, excluded from collection when excludeMainPage).
    const startPage = excludeMainPage ? 2 : 1;
    const pageBuckets: Array<{ pageNumber: number; articles: typeof allSelected }> = [];
    for (let i = 0; i < contentPages; i++) {
      const chunk = allSelected.slice(i * perPage, (i + 1) * perPage);
      if (chunk.length === 0) break;
      pageBuckets.push({ pageNumber: startPage + i, articles: chunk });
    }

    // Distribution summary by reporter.
    const reporterStats = new Map<string, { authorId: string; name: string | null; districtId: string | null; count: number }>();
    for (const a of shapedTenant) {
      const key = a.author.id;
      const cur = reporterStats.get(key) || { authorId: key, name: a.author.name, districtId: a.districtId, count: 0 };
      cur.count += 1;
      reporterStats.set(key, cur);
    }

    return res.json({
      tenantId: ctx.tenantId,
      publicationEditionId,
      subEditionId: subEditionId || null,
      edition: design.publicationEdition,
      subEdition: design.subEdition || null,
      issueDate,
      newsCloseTime: close,
      languageCode: design.languageCode,
      districtScopeId,
      window: { fromUtc: fromUtc.toISOString(), toUtc: toUtc.toISOString(), fromIST: `${issueDate}T00:00:00+05:30`, toIST: `${issueDate}T${close}:00+05:30` },
      capacity: { totalPages, excludeMainPage, contentPages, perPage, maxArticles },
      stats: {
        tenantArticlesAvailable: tenantArticles.length,
        collectedFromTenant: shapedTenant.length,
        borrowedFromOtherTenants: shapedBorrowed.length,
        totalCollected: allSelected.length,
        shortBy: Math.max(0, maxArticles - allSelected.length),
        distinctReporters: reporterStats.size,
        distinctDistricts: districtIds.length,
      },
      reporterDistribution: [...reporterStats.values()].sort((a, b) => b.count - a.count),
      articles: allSelected,
      pageBuckets,
    });
  } catch (e: any) {
    console.error('collectEpaperNews error:', e);
    return res.status(500).json({ error: 'Failed to collect ePaper news', details: e?.message || String(e) });
  }
}
