import { Router } from 'express';
import { tenantResolver } from '../../middleware/tenantResolver';
import prisma from '../../lib/prisma';
import { buildNewsArticleJsonLd, toWebArticleCardDto, toWebArticleDetailDto } from '../../lib/tenantWebArticleView';
import crypto from 'crypto';

// transient any-cast for newly added delegates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router();
router.use(tenantResolver);

// Helper: build default navigation config if none set
function buildDefaultNavigation(tenant: any) {
  return {
    brand: { logoText: tenant?.name || 'News', tagline: 'Latest updates', locale: 'en-IN' },
    sticky: { enabled: true, offsetPx: 0 },
    utilityLinks: [],
    primaryLinks: [ { label: 'Home', href: '/' } ],
    quickLinks: [],
    socialLinks: [],
    cta: { label: 'Subscribe', href: '/subscribe', variant: 'solid' },
    mobile: {
      featuredTag: null,
      quickActions: [],
      primaryLinks: [ { label: 'Home', href: '/', icon: 'home' } ],
      bottomNavLinks: [ { label: 'Home', href: '/', icon: 'home' } ],
      socialLinks: []
    }
  };
}

// Merge utility
const merge = (a: any, b: any) => ({ ...(a || {}), ...(b || {}) });

async function getEffectiveSettings(tenantId: string, domainId: string) {
  const [entity, tenantSet, domainSet] = await Promise.all([
    p.entitySettings.findFirst().catch(() => null),
    p.tenantSettings.findUnique({ where: { tenantId } }).catch(() => null),
    p.domainSettings.findUnique({ where: { domainId } }).catch(() => null)
  ]);
  return merge(merge(entity?.data, tenantSet?.data), domainSet?.data);
}

type HomepageSectionConfig = {
  key: string;
  title?: string;
  position?: number;
  style?: string;
  limit?: number;
  categorySlug?: string;
  tagsHas?: string;
};

/**
 * @swagger
 * /public/domain/settings:
 *   get:
 *     summary: Get effective Domain Settings for current Host
 *     description: Auto-detects tenant/domain using the Host header and returns effective website config.
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     responses:
 *       200:
 *         description: Effective settings
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   domain: "manachourasta.com"
 *                   tenantId: "cmidgq4v80004ugv8dtqv4ijk"
 *                   effective:
 *                     branding:
 *                       logoUrl: "https://cdn.kaburlu.com/logos/domain.png"
 *                       faviconUrl: "https://cdn.kaburlu.com/favicons/domain.ico"
 *                     theme:
 *                       theme: "dark"
 *                       colors:
 *                         primary: "#0D47A1"
 *                         secondary: "#FFC107"
 *                     navigation:
 *                       menu:
 *                         - { label: "Home", href: "/" }
 *                     seo:
 *                       defaultMetaTitle: "Kaburlu News"
 *                       defaultMetaDescription: "Latest breaking news and updates."
 *                     homepage:
 *                       heroCount: 1
 *                       topStoriesCount: 5
 *                       sections:
 *                         - key: "politics"
 *                           title: "Politics"
 *                           position: 10
 *                           style: "grid"
 *                           categorySlug: "politics"
 *                           limit: 6
 *                         - key: "liveDesk"
 *                           title: "Live Desk"
 *                           position: 15
 *                           style: "ticker"
 *                           tagsHas: "breaking"
 *                           limit: 12
  *                     style1:
  *                       palette:
  *                         mode: "light"
  *                         primary: "#0D47A1"
  *                         secondary: "#FFC107"
  *                         accent: "#FF5722"
  *                         background: "#FFFFFF"
  *                         surface: "#F7F9FC"
  *                       typography:
  *                         fontFamilyBase: "Inter, system-ui, sans-serif"
  *                         baseFontSizeRem: 1
  *                         lineHeightBase: 1.5
  *                         weights:
  *                           regular: 400
  *                           medium: 500
  *                           bold: 700
  *                         sizes:
  *                           xs: "0.75rem"
  *                           sm: "0.875rem"
  *                           base: "1rem"
  *                           md: "1.125rem"
  *                           lg: "1.25rem"
  *                           xl: "1.5rem"
  *                           display: "2.25rem"
  *                       spacing:
  *                         unitRem: 0.5
  *                         scale:
  *                           xs: 0.5
  *                           sm: 1
  *                           md: 2
  *                           lg: 3
  *                           xl: 4
  *                       breakpoints:
  *                         mobile: 480
  *                         tablet: 768
  *                         desktop: 1024
  *                         wide: 1440
  *                       components:
  *                         button:
  *                           radius: 6
  *                           paddingYRem: 0.5
  *                           paddingXRem: 1
  *                           variants:
  *                             solid:
  *                               background: "#0D47A1"
  *                               color: "#FFFFFF"
  *                             outline:
  *                               borderColor: "#0D47A1"
  *                               color: "#0D47A1"
  *                         card:
  *                           radius: 8
  *                           shadow: "0 2px 6px rgba(0,0,0,0.08)"
  *                           headerFontSize: "1.125rem"
  *                           hoverLift: true
  *                       article:
  *                         heroLayout: "standard"
  *                         showAuthorAvatar: true
  *                         showCategoryPill: true
  *                         readingProgressBar: true
  *                       listing:
  *                         cardVariant: "highlight-first"
  *                         showExcerpt: true
  *                         imageAspectRatio: "16:9"
 */
router.get('/domain/settings', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const effective = await getEffectiveSettings(tenant.id, domain.id);
  res.json({ domain: domain.domain, tenantId: tenant.id, effective });
});

/**
 * @swagger
 * /public/navigation:
 *   get:
 *     summary: Get tenant navigation config
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     responses:
  *       200:
  *         description: Navigation config JSON
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   brand:
  *                     logoText: "News"
  *                   primaryLinks:
  *                     - label: "Home"
  *                       href: "/"
  *       500:
  *         description: Domain context missing
  *         content:
  *           application/json:
  *             examples:
  *               error:
  *                 value:
  *                   error: "Domain context missing"
 */
router.get('/navigation', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const nav = await p.tenantNavigation.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);
  res.json(nav?.config || buildDefaultNavigation(tenant));
});

/**
 * @swagger
 * /public/features:
 *   get:
 *     summary: Get tenant feature flags
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     responses:
  *       200:
  *         description: Feature flags
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   enableMobileAppView: false
  *                   section2:
  *                     rows: 2
  *                     listCount: 4
  *                     forceCategoryName: null
  *       500:
  *         description: Domain context missing
  *         content:
  *           application/json:
  *             examples:
  *               error:
  *                 value:
  *                   error: "Domain context missing"
 */
router.get('/features', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const flags = await p.tenantFeatureFlags.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);
  const out = flags ? {
    enableMobileAppView: flags.enableMobileAppView,
    section2: {
      rows: flags.section2Rows,
      listCount: flags.section2ListCount,
      forceCategoryName: flags.section2ForceCategoryName || null
    }
  } : {
    enableMobileAppView: false,
    section2: { rows: 2, listCount: 4, forceCategoryName: null }
  };
  res.json(out);
});

// TenantWebArticle -> card shape for website consumption
function toCard(a: any) {
  const card = toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null });
  return {
    id: card.id,
    slug: card.slug,
    title: card.title,
    image: card.coverImageUrl,
    excerpt: card.excerpt,
    category: card.category ? { slug: card.category.slug, name: card.category.name } : null,
    publishedAt: card.publishedAt,
    tags: card.tags,
    languageCode: card.languageCode,
  };
}

function getOrCreateRequestId(req: any): string {
  const existing = (req.headers['x-request-id'] || req.headers['x-correlation-id']) as string | undefined;
  if (existing && String(existing).trim()) return String(existing).trim();
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

async function resolveLanguageId(langCodeRaw: any): Promise<string | null> {
  const code = (langCodeRaw ? String(langCodeRaw) : '').trim();
  if (!code) return null;
  const lang = await p.language.findUnique({ where: { code } }).catch(() => null);
  return lang?.id || null;
}

function toV1Article(a: any, imageTarget?: { w: number; h: number }) {
  const card = toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null });
  return {
    id: card.id,
    slug: card.slug,
    title: card.title,
    excerpt: card.excerpt,
    coverImage: card.coverImageUrl
      ? { url: card.coverImageUrl, w: imageTarget?.w || null, h: imageTarget?.h || null }
      : null,
    publishedAt: card.publishedAt,
  };
}

/**
 * @swagger
 * /public/homepage:
 *   get:
 *     summary: Aggregated homepage sections
 *     description: |
 *       Returns homepage content for the resolved tenant/domain.
 *
 *       - Default response (no query params): legacy shape `{ hero, topStories, sections, ... }`.
 *       - Style1 contract: pass `?v=1` (or `?shape=style1`) to get `{ version, tenant, theme, uiTokens, sections, data }`.
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: domain
 *         required: false
 *         description: Optional tenant/domain override (alternative to X-Tenant-Domain).
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: v
 *         required: false
 *         description: Set to 1 to return the Style1 homepage composition contract.
 *         schema:
 *           type: string
 *           enum: ['1']
 *           example: '1'
 *       - in: query
 *         name: shape
 *         required: false
 *         description: Alternative to `v=1`; set to `style1` for Style1 contract.
 *         schema:
 *           type: string
 *           enum: ['style1']
 *           example: style1
 *       - in: query
 *         name: themeKey
 *         required: false
 *         description: Theme key for homepage composition (currently only `style1`).
 *         schema:
 *           type: string
 *           example: style1
 *       - in: query
 *         name: lang
 *         required: false
 *         description: Optional language code filter for homepage articles.
 *         schema:
 *           type: string
 *           example: en
 *     responses:
  *       200:
  *         description: Homepage JSON sections
  *         content:
  *           application/json:
  *             examples:
  *               legacy:
  *                 summary: Legacy response (default)
  *                 value:
  *                   hero:
  *                     - id: "wa_1"
  *                       slug: "top-headline-1"
  *                       title: "Top headline"
  *                       image: "https://cdn.example.com/cover.webp"
  *                       excerpt: "..."
  *                       category: { slug: "politics", name: "Politics" }
  *                       publishedAt: "2025-12-28T10:00:00.000Z"
  *                   topStories:
  *                     - id: "wa_2"
  *                       slug: "story-2"
  *                       title: "Story"
  *                       image: null
  *                       excerpt: null
  *                       category: null
  *                       publishedAt: null
  *                   sections:
  *                     - key: "politics"
  *                       title: "Politics"
  *                       position: 10
  *                       style: "grid"
  *                       limit: 6
  *                       categorySlug: "politics"
  *                       items: []
  *                   config:
  *                     heroCount: 1
  *                     topStoriesCount: 5
  *               style1V1:
  *                 summary: Style1 contract (use ?v=1)
  *                 value:
  *                   version: "1.0"
  *                   tenant: { id: "t1", slug: "demo", name: "Kaburlu Demo" }
  *                   theme: { key: "style1" }
  *                   uiTokens:
  *                     titleMaxLines: { hero: 2, cardMedium: 2, listRow: 2, ticker: 1 }
  *                     imageTargets:
  *                       hero16x9: { w: 1200, h: 675 }
  *                       card16x9: { w: 900, h: 506 }
  *                       thumbWide: { w: 320, h: 180 }
  *                       thumbSmall: { w: 240, h: 160 }
  *                   sections:
  *                     - id: "flashTicker"
  *                       type: "ticker"
  *                       label: "Flash News"
  *                       ui: { itemCount: 12, titleMaxLines: 1 }
  *                       query: { kind: "latest", limit: 12 }
  *                   data:
  *                     flashTicker:
  *                       - id: "a1"
  *                         slug: "..."
  *                         title: "..."
  *                         excerpt: "..."
  *                         coverImage: { url: "https://cdn.example.com/cover.webp", w: 320, h: 180 }
  *                         publishedAt: "2025-12-28T10:00:00.000Z"
 *       500:
 *         description: Domain context missing
 */
router.get('/homepage', async (_req, res) => {
  const req: any = _req;
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });

  const requestId = getOrCreateRequestId(req);
  res.setHeader('X-Request-Id', requestId);

  const wantsV1 = String((req.query as any)?.v || '').trim() === '1' || String((req.query as any)?.shape || '').toLowerCase() === 'style1';
  const themeKey = String((req.query as any)?.themeKey || 'style1');
  const langCode = String((req.query as any)?.lang || '').trim() || null;
  if (wantsV1 && themeKey !== 'style1') {
    return res.status(400).json({ code: 'UNSUPPORTED_THEME', message: 'Only themeKey=style1 is supported currently' });
  }


  const [domainCats, activeDomainCount, effective, languageId, tenantTheme] = await Promise.all([
    domain?.id ? p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }) : Promise.resolve([]),
    p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0),
    domain?.id ? getEffectiveSettings(tenant.id, domain.id) : Promise.resolve({}),
    resolveLanguageId(langCode),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null)
  ]);

  if (wantsV1 && langCode && !languageId) {
    return res.status(400).json({ code: 'INVALID_LANG', message: 'Unknown lang code' });
  }

  const allowedCategoryIds = new Set((domainCats || []).map((d: any) => d.categoryId));
  const domainScope: any = domain?.id
    ? (activeDomainCount <= 1 ? { OR: [{ domainId: domain.id }, { domainId: null }] } : { domainId: domain.id })
    : {};

  const categoryBySlug = new Map<string, any>((domainCats || []).map((d: any) => [d.category?.slug, d.category]));

  const defaultSections: HomepageSectionConfig[] = [
    { key: 'politics', title: 'Politics', position: 10, style: 'grid', limit: 6, categorySlug: 'politics' },
    { key: 'technology', title: 'Technology', position: 20, style: 'grid', limit: 6, categorySlug: 'technology' },
    { key: 'sports', title: 'Sports', position: 30, style: 'grid', limit: 6, categorySlug: 'sports' },
  ];

  // Prefer homepage config stored in TenantTheme (per style) to avoid touching global settings JSON.
  const themeHome: any = (tenantTheme as any)?.homepageConfig || null;
  const themeHomeForStyle = themeHome && typeof themeHome === 'object'
    ? (themeHome[themeKey] ?? themeHome)
    : null;
  const cfg: any = themeHomeForStyle || (effective as any)?.homepage || {};
  const heroCount = Math.min(Math.max(parseInt(String(cfg.heroCount || '1'), 10) || 1, 1), 10);
  const topStoriesCount = Math.min(Math.max(parseInt(String(cfg.topStoriesCount || '5'), 10) || 5, 1), 20);
  const sectionsCfg: HomepageSectionConfig[] = Array.isArray(cfg.sections) && cfg.sections.length ? cfg.sections : defaultSections;

  // Base pool for hero/topStories (latest)
  const baseWhere: any = { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope };
  if (allowedCategoryIds.size) baseWhere.categoryId = { in: Array.from(allowedCategoryIds) };
  if (languageId) baseWhere.languageId = languageId;

  const baseRows = await p.tenantWebArticle.findMany({
    where: baseWhere,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: Math.max(20, heroCount + topStoriesCount + 10),
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  const baseCards = baseRows.map(toCard);
  const hero = baseCards.slice(0, heroCount);
  const topStories = baseCards.slice(heroCount, heroCount + topStoriesCount);

  // Style1 one-API response (opt-in)
  if (wantsV1) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');

    const uiTokens = {
      titleMaxLines: { hero: 2, cardMedium: 2, listRow: 2, ticker: 1 },
      imageTargets: {
        hero16x9: { w: 1200, h: 675 },
        card16x9: { w: 900, h: 506 },
        thumbWide: { w: 320, h: 180 },
        thumbSmall: { w: 240, h: 160 }
      }
    };

    type V1Section = {
      id: string;
      type: string;
      label: string;
      ui: any;
      query: any;
    };

    const sections: V1Section[] = [
      { id: 'flashTicker', type: 'ticker', label: 'Flash News', ui: { itemCount: 12, titleMaxLines: 1 }, query: { kind: 'latest', limit: 12 } },
      {
        id: 'heroStack',
        type: 'heroStack',
        label: 'Top Stories',
        ui: {
          hero: { count: 1, image: 'hero16x9', titleMaxLines: 2 },
          medium: { count: 2, image: 'card16x9', titleMaxLines: 2 },
          rows: { count: 3, image: 'thumbWide', titleMaxLines: 2 }
        },
        query: { kind: 'latest', limit: 12, dedupeKey: 'heroStack' }
      },
      { id: 'lastNews', type: 'listWithThumb', label: 'Last News', ui: { count: 7, image: 'thumbWide', titleMaxLines: 2 }, query: { kind: 'category', categorySlug: 'politics', limit: 8 } },
      { id: 'trendingCategory', type: 'twoColRows', label: 'Trending News', ui: { count: 6, image: 'thumbWide', titleMaxLines: 2 }, query: { kind: 'category', categorySlug: 'sports', limit: 6, sort: 'latest' } },
      { id: 'rightRailTrendingTitles', type: 'titlesOnly', label: 'Trending News', ui: { count: 8, titleMaxLines: 2 }, query: { kind: 'latest', limit: 8 } }
    ];

    // Allow tenant-configured overrides for Style1 sections.
    // Source: TenantTheme.homepageConfig.style1.sections[] where key maps to section id.
    const sectionOverrides: Record<string, any> = {};
    if (Array.isArray((cfg as any)?.sections)) {
      for (const s of (cfg as any).sections) {
        const k = String(s?.key || '').trim();
        if (!k) continue;
        sectionOverrides[k] = s;
      }
    }

    const clampInt = (value: any, min: number, max: number) => {
      const n = parseInt(String(value), 10);
      if (!Number.isFinite(n)) return null;
      return Math.min(Math.max(n, min), max);
    };

    for (const s of sections) {
      const ov = sectionOverrides[s.id];
      if (!ov) continue;

      const newLabel = (Object.prototype.hasOwnProperty.call(ov, 'label') ? ov.label : ov.title);
      if (typeof newLabel === 'string' && newLabel.trim()) s.label = newLabel.trim();

      if (typeof ov?.categorySlug === 'string' && ov.categorySlug.trim()) {
        if (s.query?.kind === 'category') s.query.categorySlug = ov.categorySlug.trim();
      }

      const limit = clampInt(ov?.limit, 1, 50);
      if (limit) {
        if (s.type === 'ticker') {
          s.ui.itemCount = limit;
          s.query.limit = limit;
        } else if (s.type === 'titlesOnly' || s.type === 'listWithThumb' || s.type === 'twoColRows') {
          s.ui.count = limit;
          s.query.limit = limit;
        }
      }
    }

    const seen = new Set<string>();
    const data: Record<string, any[]> = {};

    // Prime dedupe set using base hero/topStories (since legacy clients treat them as first sections)
    for (const c of [...hero, ...topStories]) {
      if (c?.id) seen.add(String(c.id));
    }

    const timers: Record<string, number> = {};

    async function fetchLatest(limit: number) {
      const t0 = Date.now();
      const rows = await p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(Math.max(limit, 1), 50),
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      timers.latest = (timers.latest || 0) + (Date.now() - t0);
      return rows;
    }

    async function fetchCategory(categorySlug: string, limit: number) {
      const t0 = Date.now();
      const resolvedCategory = categoryBySlug.get(categorySlug) || null;
      if (!resolvedCategory) {
        timers.category = (timers.category || 0) + (Date.now() - t0);
        return [];
      }
      const where: any = { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope, categoryId: resolvedCategory.id };
      if (languageId) where.languageId = languageId;
      const rows = await p.tenantWebArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(Math.max(limit, 1), 50),
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      timers.category = (timers.category || 0) + (Date.now() - t0);
      return rows;
    }

    async function buildSection(s: V1Section) {
      const t0 = Date.now();
      let rows: any[] = [];

      if (s.query?.kind === 'latest') {
        rows = await fetchLatest(Number(s.query.limit || 10) + 25);
      } else if (s.query?.kind === 'category') {
        rows = await fetchCategory(String(s.query.categorySlug || ''), Number(s.query.limit || 10) + 25);
      }

      const targetKey = String(s.ui?.image || s.ui?.hero?.image || s.ui?.rows?.image || s.ui?.medium?.image || '') as keyof typeof uiTokens.imageTargets;
      const target = (uiTokens.imageTargets as any)[targetKey] || null;

      const out: any[] = [];
      const want = Number(
        s.ui?.itemCount ||
          s.ui?.count ||
          s.ui?.rows?.count ||
          s.ui?.hero?.count ||
          s.query?.limit ||
          10
      );
      for (const r of rows) {
        if (!r?.id) continue;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(toV1Article(r, target || undefined));
        if (out.length >= want) break;
      }
      timers[s.id] = Date.now() - t0;
      data[s.id] = out;
    }

    await Promise.all(sections.map(buildSection));
    console.log('[homepage:v1]', { requestId, tenant: tenant.slug, domain: domain?.domain, langCode, timingsMs: timers });

    return res.json({
      version: '1.0',
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      theme: { key: 'style1' },
      uiTokens,
      sections,
      data
    });
  }

  const normalized = sectionsCfg
    .map((s: any) => ({
      key: String(s.key || ''),
      title: s.title ? String(s.title) : undefined,
      position: typeof s.position === 'number' ? s.position : (parseInt(String(s.position || '999'), 10) || 999),
      style: s.style ? String(s.style) : undefined,
      limit: Math.min(Math.max(parseInt(String(s.limit || '6'), 10) || 6, 1), 50),
      categorySlug: s.categorySlug ? String(s.categorySlug) : undefined,
      tagsHas: s.tagsHas ? String(s.tagsHas) : undefined,
    }))
    .filter((s: any) => s.key);

  const sectionRows = await Promise.all(normalized
    .sort((a: any, b: any) => a.position - b.position)
    .map(async (s: HomepageSectionConfig) => {
      const where: any = { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope };
      if (allowedCategoryIds.size) where.categoryId = { in: Array.from(allowedCategoryIds) };
      if (languageId) where.languageId = languageId;

      let resolvedCategory: any = null;
      if (s.categorySlug) {
        resolvedCategory = categoryBySlug.get(s.categorySlug) || null;
        if (!resolvedCategory) {
          return { ...s, title: s.title || s.key, items: [], categorySlug: s.categorySlug };
        }
        where.categoryId = resolvedCategory.id;
      }
      if (s.tagsHas) {
        where.tags = { has: s.tagsHas };
      }

      const rows = await p.tenantWebArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: s.limit || 6,
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      return {
        ...s,
        title: s.title || (resolvedCategory?.name || s.key),
        categorySlug: s.categorySlug || null,
        items: rows.map(toCard)
      };
    })
  );

  // Backward-compat: expose section items also at top-level by key
  const sectionsByKey: any = {};
  for (const s of sectionRows as any[]) {
    sectionsByKey[s.key] = s.items;
  }

  res.json({
    hero,
    topStories,
    sections: sectionRows,
    ...sectionsByKey,
    config: {
      heroCount,
      topStoriesCount,
      sections: normalized
    }
  });
});

/**
 * @swagger
 * /public/live-desk:
 *   get:
 *     summary: Latest brief/live desk items
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
  *       200:
  *         description: Live desk cards
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
   *                   - id: "wa_10"
   *                     slug: "breaking-10"
  *                     title: "Breaking"
   *                     image: "https://cdn.example.com/cover.webp"
   *                     excerpt: "Short summary..."
 */
router.get('/live-desk', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '12'), 10), 1), 50);

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = domain?.id
    ? (activeDomainCount <= 1 ? { OR: [{ domainId: domain.id }, { domainId: null }] } : { domainId: domain.id })
    : {};

  const rows = await p.tenantWebArticle.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', tags: { has: 'breaking' }, ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  res.json(rows.map(toCard));
});

/**
 * @swagger
 * /public/webstories:
 *   get:
 *     summary: Web story style articles
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
  *       200:
  *         description: Web story cards
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
   *                   - id: "wa_ws1"
   *                     slug: "webstory-1"
  *                     title: "Story"
   *                     image: "https://cdn.example.com/poster.webp"
 */
router.get('/webstories', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10), 1), 50);

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = domain?.id
    ? (activeDomainCount <= 1 ? { OR: [{ domainId: domain.id }, { domainId: null }] } : { domainId: domain.id })
    : {};

  const rows = await p.tenantWebArticle.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', tags: { has: 'web_story' }, ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  res.json(rows.map(toCard));
});

/**
 * @swagger
 * /public/tags/popular:
 *   get:
 *     summary: Popular tags for tenant
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
  *       200:
  *         description: Array of tag strings
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   - "politics"
  *                   - "sports"
  *                   - "technology"
 */
router.get('/tags/popular', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10), 1), 50);
  const articles = await p.article.findMany({ where: { tenantId: tenant.id, status: 'PUBLISHED' }, select: { tags: true } });
  const freq: Record<string, number> = {};
  articles.forEach((a: any) => (a.tags || []).forEach((t: string) => { freq[t] = (freq[t] || 0) + 1; }));
  const popular = Object.entries(freq).sort((a,b) => b[1]-a[1]).map(e => e[0]).slice(0, limit);
  res.json(popular);
});

/**
 * @swagger
 * /public/cities:
 *   get:
 *     summary: List of cities (placeholder derived from categories with slug prefix city-)
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     responses:
  *       200:
  *         description: Array of city names
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   - "Hyderabad"
  *                   - "Warangal"
 */
router.get('/cities', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  // Attempt to infer city categories (slug starts with city-)
  const categories = await p.category.findMany({ where: { slug: { startsWith: 'city-' } } });
  const cities = categories.map((c: any) => c.name);
  res.json(cities.slice(0, 50));
});

/**
 * @swagger
 * /public/newsletter:
 *   post:
 *     summary: Subscribe to newsletter
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               source: { type: string }
 *             required: [email]
 *     responses:
  *       200:
  *         description: Subscription result
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   success: true
 */
router.post('/newsletter', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const { email, source } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ success: false, error: 'Email required' });
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ success: false, error: 'Invalid email' });
  await p.newsletterSubscription.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { source },
    create: { tenantId: tenant.id, email, source }
  });
  res.json({ success: true });
});

/**
 * @swagger
 * /public/reporters:
 *   get:
 *     summary: Public reporter directory
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     responses:
  *       200:
  *         description: Reporter list
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   - id: "rep1"
  *                     name: "John"
  *                     level: "SENIOR"
 */
router.get('/reporters', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const reporters = await p.reporter.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true, level: true, role: true, createdAt: true } }).catch(()=>[]);
  res.json(reporters);
});

// ---------- SEO Endpoints ----------

/**
 * @swagger
 * /public/seo/site:
 *   get:
 *     summary: Site-level JSON-LD (WebSite + Organization)
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     responses:
  *       200:
  *         description: JSON-LD objects
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   website:
  *                     "@type": "WebSite"
  *                   organization:
  *                     "@type": "NewsMediaOrganization"
 */
router.get('/seo/site', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain?.domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const theme = await p.tenantTheme.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);
  const entity = await p.tenantEntity.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);
  const base = `https://${domain}`;
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: base,
    name: tenant.name,
    inLanguage: entity?.languageId ? entity.languageId : 'en-IN'
  };
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: tenant.name,
    url: base,
    logo: theme?.logoUrl || null,
    publisher: entity?.publisherName || null,
    foundingDate: tenant.createdAt,
  };
  res.json({ website, organization });
});

/**
 * @swagger
 * /public/seo/article/{slug}:
 *   get:
 *     summary: Article JSON-LD
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
  *       200:
  *         description: NewsArticle JSON-LD
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   "@type": "NewsArticle"
  *                   headline: "Title"
 *       404: { description: Not found }
 */
router.get('/seo/article/:slug', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain?.domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });

  const slug = String(req.params.slug);

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: (res.locals as any).domain?.id }, { domainId: null }] }
    : { domainId: (res.locals as any).domain?.id };

  const row = await p.tenantWebArticle.findFirst({
    where: { tenantId: tenant.id, status: 'PUBLISHED', slug, ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    include: { category: { select: { slug: true, name: true } }, language: { select: { code: true } } }
  });
  if (!row) return res.status(404).json({ error: 'Not found' });

  const detail = toWebArticleDetailDto(row);
  const imageUrls = [detail.coverImage?.url].filter(Boolean) as string[];
  const authorName = Array.isArray(detail.authors) && detail.authors.length ? (detail.authors[0]?.name || null) : null;
  const jsonLd = buildNewsArticleJsonLd({
    domain,
    tenantName: tenant.name,
    slug: detail.slug,
    title: detail.meta.seoTitle || detail.title,
    description: detail.meta.metaDescription || detail.excerpt || null,
    imageUrls,
    publishedAt: detail.publishedAt,
    modifiedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    authorName,
    section: row.category?.slug || null,
    inLanguage: row.language?.code || null
  });

  res.json(jsonLd);
});

/**
 * @swagger
 * /public/sitemap.xml:
 *   get:
 *     summary: Sitemap XML for this domain
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: XML sitemap
 *         content:
 *           application/xml:
 *             examples:
 *               sample:
 *                 value: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">..."
 */
router.get('/sitemap.xml', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domainRow = (res.locals as any).domain;
  if (!tenant || !domainRow) return res.status(500).send('Domain context missing');

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domainRow.id }, { domainId: null }] }
    : { domainId: domainRow.id };

  const rows = await p.tenantWebArticle.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 5000,
    select: { slug: true, updatedAt: true, publishedAt: true }
  });
  const base = `https://${domainRow.domain}`;
  const urls = rows.map((r: any) => {
    const lastMod = r.updatedAt ? new Date(r.updatedAt).toISOString() : (r.publishedAt ? new Date(r.publishedAt).toISOString() : null);
    return { loc: `${base}/articles/${encodeURIComponent(r.slug)}`, lastMod };
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${base}/</loc></url>\n` +
    urls.map((u: any) => `  <url><loc>${u.loc}</loc>${u.lastMod ? `<lastmod>${u.lastMod}</lastmod>` : ''}</url>`).join('\n') +
    `\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

/**
 * @swagger
 * /public/robots.txt:
 *   get:
 *     summary: Robots.txt for this domain
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: robots.txt
 *         content:
 *           text/plain:
 *             examples:
 *               sample:
 *                 value: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n"
 */
router.get('/robots.txt', async (_req, res) => {
  const domainRow = (res.locals as any).domain;
  if (!domainRow) return res.status(500).send('Domain context missing');
  const base = `https://${domainRow.domain}`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
});

export default router;

/**
 * @swagger
 * /api/public/idcard:
 *   get:
 *     summary: Public - Render Reporter ID Card (HTML)
 *     description: Renders HTML ID card by reporterId OR mobile OR fullName. One of these query params is required.
 *     tags: [ID Cards]
 *     parameters:
 *       - in: query
 *         name: reporterId
 *         schema: { type: string }
 *       - in: query
 *         name: mobile
 *         schema: { type: string }
 *       - in: query
 *         name: fullName
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: HTML view
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       400: { description: Validation error }
 *       404: { description: Reporter or ID card not found }
 */
router.get('/idcard', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).send('Domain context missing');
  const reporterId = req.query.reporterId ? String(req.query.reporterId) : undefined;
  const mobile = req.query.mobile ? String(req.query.mobile) : undefined;
  const fullName = req.query.fullName ? String(req.query.fullName) : undefined;
  if (!reporterId && !mobile && !fullName) {
    return res.status(400).send('Provide reporterId or mobile or fullName');
  }
  // Resolve reporter by given query within tenant
  const pAny: any = prisma;
  let reporter = null;
  if (reporterId) {
    reporter = await pAny.reporter.findFirst({ where: { id: reporterId, tenantId: tenant.id } });
  }
  if (!reporter && mobile) {
    const user = await pAny.user.findFirst({ where: { mobileNumber: mobile } });
    if (user) reporter = await pAny.reporter.findFirst({ where: { userId: user.id, tenantId: tenant.id } });
  }
  if (!reporter && fullName) {
    const profile = await pAny.userProfile.findFirst({ where: { fullName: { equals: String(fullName), mode: 'insensitive' } } });
    if (profile) reporter = await pAny.reporter.findFirst({ where: { userId: profile.userId, tenantId: tenant.id } });
  }
  if (!reporter) return res.status(404).send('Reporter not found');
  const reporterWithCard = await pAny.reporter.findUnique({ where: { id: reporter.id }, include: { idCard: true, designation: true, user: true } });
  if (!reporterWithCard?.idCard) return res.status(404).send('ID card not found for reporter');

  // Pull settings
  const settings = await pAny.tenantIdCardSettings.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);

  // Place of work
  const parts: string[] = [];
  if (reporterWithCard.stateId) {
    const s = await pAny.state.findUnique({ where: { id: reporterWithCard.stateId } }).catch(()=>null);
    if (s?.name) parts.push(s.name);
  }
  if (reporterWithCard.districtId) {
    const d = await pAny.district.findUnique({ where: { id: reporterWithCard.districtId } }).catch(()=>null);
    if (d?.name) parts.push(d.name);
  }
  if (reporterWithCard.mandalId) {
    const m = await pAny.mandal.findUnique({ where: { id: reporterWithCard.mandalId } }).catch(()=>null);
    if (m?.name) parts.push(m.name);
  }
  const placeOfWork = parts.length ? parts.join(', ') : null;

  // Photo
  let photoUrl: string | null = reporterWithCard.profilePhotoUrl || null;
  if (!photoUrl && reporterWithCard.userId) {
    const profile = await pAny.userProfile.findUnique({ where: { userId: reporterWithCard.userId } }).catch(() => null);
    photoUrl = profile?.profilePhotoUrl || null;
  }

  const issuedAtIso: string = new Date(reporterWithCard.idCard.issuedAt).toISOString();
  const expiresAtIso: string = new Date(reporterWithCard.idCard.expiresAt).toISOString();
  const exp = new Date(reporterWithCard.idCard.expiresAt);
  const validityLabel = `Valid up to ${String(exp.getUTCDate()).padStart(2, '0')}-${String(exp.getUTCMonth() + 1).padStart(2, '0')}-${exp.getUTCFullYear()}`;

  const primary = settings?.primaryColor || '#004f9f';
  const secondary = settings?.secondaryColor || '#ff0000';
  const logo = settings?.frontLogoUrl || '';
  const sign = settings?.signUrl || '';
  const stamp = settings?.roundStampUrl || '';
  const terms = Array.isArray(settings?.termsJson) ? (settings?.termsJson as string[]) : [];
  const office = settings?.officeAddress || '';
  const help1 = settings?.helpLine1 || '';
  const help2 = settings?.helpLine2 || '';

  const html = `<!DOCTYPE html>
  <html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reporter ID Card</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
    .card-wrap { display: flex; gap: 24px; }
    .card { width: 380px; height: 600px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; overflow: hidden; background: #fff; }
    .header { display: flex; align-items: center; padding: 12px; }
    .header img.logo { height: 32px; margin-right: 8px; }
    .title { font-weight: bold; color: #333; }
    .band { background: ${primary}; color: #fff; text-align: center; padding: 8px; font-weight: 700; letter-spacing: 1px; }
    .content { padding: 16px; }
    .row { display: flex; gap: 12px; }
    .photo { width: 140px; height: 180px; border: 2px solid ${primary}; }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .details { flex: 1; }
    .label { font-size: 12px; color: #666; }
    .value { font-size: 14px; color: #111; font-weight: 600; }
    .qr { width: 120px; height: 120px; background: #eee; border: 1px dashed #ccc; display:flex; align-items:center; justify-content:center; color:#999; }
    .footer { border-top: 4px solid ${secondary}; padding: 8px; }
    .press { font-size: 26px; font-weight: 800; color: ${secondary}; text-align: center; letter-spacing: 2px; }
    .terms { padding: 12px 16px; font-size: 12px; color: #333; }
    .terms li { margin-bottom: 6px; }
    .sign-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; }
    .sign-row img { height: 42px; }
    .stamp { position: absolute; right: 16px; bottom: 80px; width: 80px; height: 80px; opacity: 0.7; }
  </style></head>
  <body>
    <div class="card-wrap">
      <div class="card">
        <div class="header">${logo ? `<img class=\"logo\" src=\"${logo}\" alt=\"logo\" />` : ''}<div class="title">${tenant.name}</div></div>
        <div class="band">MEDIA</div>
        <div class="content">
          <div class="row">
            <div class="photo">${photoUrl ? `<img src=\"${photoUrl}\" alt=\"photo\" />` : ''}</div>
            <div class="details">
              <div class="value" style="font-size:18px;">${reporterWithCard.user?.name || ''}</div>
              <div class="label">Designation</div>
              <div class="value">${reporterWithCard.designation?.name || ''}</div>
              <div class="label">ID No</div>
              <div class="value">${reporterWithCard.idCard.cardNumber}</div>
              <div class="label">Mobile</div>
              <div class="value">${reporterWithCard.user?.mobileNumber || ''}</div>
              <div class="label">Place</div>
              <div class="value">${placeOfWork || ''}</div>
            </div>
          </div>
          <div class="row" style="margin-top:12px; align-items:center;">
            <div class="qr">QR</div>
            <div style="flex:1; text-align:right; font-size:12px; color:#666;">${validityLabel}</div>
          </div>
        </div>
        <div class="footer"></div>
      </div>

      <div class="card" style="position:relative;">
        <div class="header">${logo ? `<img class=\"logo\" src=\"${logo}\" alt=\"logo\" />` : ''}<div class="title">${tenant.name}</div></div>
        <div class="content">
          <div class="terms">${terms.length ? `<ul>${terms.map(t => `<li>${t}</li>`).join('')}</ul>` : '<div>No terms provided.</div>'}
            <div style="margin-top:10px; font-size:12px; color:#333;">${office}</div>
            <div style="margin-top:4px; font-size:12px; color:#333;">Help: ${help1} ${help2 ? ' / ' + help2 : ''}</div>
          </div>
        </div>
        <div class="sign-row"><div>Director</div>${sign ? `<img src=\"${sign}\" alt=\"sign\" />` : ''}</div>
        ${stamp ? `<img class=\"stamp\" src=\"${stamp}\" alt=\"stamp\" />` : ''}
        <div class="press">PRESS</div>
      </div>
    </div>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Allow cross-origin images (logo, stamp, sign) to load in browser
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  return res.send(html);
});