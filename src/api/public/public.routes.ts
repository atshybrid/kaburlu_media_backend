import { Router } from 'express';
import { tenantResolver } from '../../middleware/tenantResolver';
import prisma from '../../lib/prisma';
import { toWebArticleCardDto, toWebArticleDetailDto } from '../../lib/tenantWebArticleView';
import { buildNewsArticleJsonLd } from '../../lib/seo';

// transient any-cast for newly added delegates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router();

// Apply resolver only to this public router
router.use(tenantResolver);

// Placeholder endpoints; real implementations added in next step
router.get('/_health', (_req, res) => {
  res.json({ ok: true, domain: (res.locals as any).domain?.domain, tenant: (res.locals as any).tenant?.slug });
});

/**
 * @swagger
 * /public/theme:
 *   get:
 *     summary: Get website theme for this domain's tenant
 *     description: Returns branding assets and colors configured for the tenant resolved from the request domain.
 *     tags: [Public - Website, Public - Tenant]
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
 *         description: Theme or null
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   logoUrl: "https://cdn.kaburlu.com/logo.png"
 *                   faviconUrl: "https://cdn.kaburlu.com/favicon.ico"
 *                   primaryColor: "#0D47A1"
 */
router.get('/theme', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const theme = await p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } });
  // If no theme found, return null so the frontend can fall back to defaults
  res.json(theme || null);
});

/**
 * @swagger
 * /public/languages:
 *   get:
 *     summary: List languages allowed for this domain
 *     description: Returns languages explicitly enabled for the resolved domain. Marks which one is the tenant default.
 *     tags: [Public - Website, Public - Tenant]
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
 *         description: Allowed languages
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   - code: 'en'
 *                     name: 'English'
 *                     nativeName: 'English'
 *                     direction: 'ltr'
 *                     defaultForTenant: true
 *                   - code: 'te'
 *                     name: 'Telugu'
 *                     nativeName: 'తెలుగు'
 *                     direction: 'ltr'
 *                     defaultForTenant: false
 */
router.get('/languages', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const [allowed, entity] = await Promise.all([
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.tenantEntity.findUnique({ where: { tenantId: tenant.id }, include: { language: true } })
  ]);
  const tenantDefaultCode = entity?.language?.code;
  const shaped = allowed.map((dl: any) => ({
    code: dl.language.code,
    name: dl.language.name,
    nativeName: dl.language.nativeName,
    direction: dl.language.direction,
    defaultForTenant: dl.language.code === tenantDefaultCode
  }));
  res.json(shaped);
});

/**
 * @swagger
 * /public/categories:
 *   get:
 *     summary: List categories allowed for this domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: includeChildren
 *         schema: { type: boolean }
 *         description: Include immediate children categories (filtered to allowed set)
 *       - in: query
 *         name: languageCode
 *         schema: { type: string }
  *         description: Optional ISO code (must be allowed for domain). If omitted, defaults to tenant's language when available.
 *     responses:
  *       200:
  *         description: Category list
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   - id: "cat1"
  *                     name: "రాజకీయాలు"
  *                     nameDefault: "Politics"
  *                     nameLocalized: "రాజకీయాలు"
  *                     slug: "politics"
 */
router.get('/categories', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const includeChildren = String(req.query.includeChildren).toLowerCase() === 'true';
  let languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  // Determine default language from tenant if not explicitly requested
  if (!languageCode) {
    const entity = await p.tenantEntity.findUnique({ where: { tenantId: tenant.id }, include: { language: true } }).catch(() => null);
    const tenantLangCode = entity?.language?.code || undefined;
    if (tenantLangCode) languageCode = tenantLangCode;
  }

  // Fetch allowed categories for this domain
  const domainCats = await p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } });
  const allowedIds = new Set(domainCats.map((dc: any) => dc.categoryId));
  let categories = domainCats.map((dc: any) => dc.category);

  if (includeChildren) {
    const parentIds: string[] = [];
    categories.forEach((c: any) => parentIds.push(c.id));
    const children = await p.category.findMany({ where: { parentId: { in: Array.from(parentIds) } } });
    // Only include children if explicitly allowed for the domain
    categories = categories.concat(children.filter((ch: any) => allowedIds.has(ch.id)));
  }

  // Optional: apply translations. Allow if domain explicitly enables language OR if it matches tenant default.
  let translationsByCategory: Map<string, string> | undefined;
  if (languageCode) {
    const lang = await p.language.findUnique({ where: { code: languageCode } });
    if (lang) {
      // Check domain gating
      const domLang = await p.domainLanguage.findUnique({ where: { domainId_languageId: { domainId: domain.id, languageId: lang.id } } });
      // Get tenant default language code (we might have loaded earlier; reload if needed)
      let tenantDefaultLangCode: string | undefined;
      try {
        const entity = await p.tenantEntity.findUnique({ where: { tenantId: tenant.id }, include: { language: true } });
        tenantDefaultLangCode = entity?.language?.code;
      } catch (_) { /* ignore */ }
      const languageAllowed = !!domLang || (tenantDefaultLangCode && tenantDefaultLangCode === languageCode);
      if (languageAllowed) {
        const ids = Array.from(new Set(categories.map((c: any) => c.id)));
        const translations = await p.categoryTranslation.findMany({ where: { categoryId: { in: ids }, language: languageCode } });
        translationsByCategory = new Map(translations.map((t: any) => [t.categoryId, t.name]));
      }
    }
  }

  // Deduplicate and shape response, include default and localized name
  const map = new Map<string, any>();
  categories.forEach((c: any) => {
    const localized = translationsByCategory?.get(c.id) || null;
    const name = localized || c.name;
    map.set(c.id, {
      id: c.id,
      name,
      nameDefault: c.name,
      nameLocalized: localized,
      slug: c.slug,
      parentId: c.parentId,
      iconUrl: c.iconUrl
    });
  });
  res.json(Array.from(map.values()));
});

/**
 * @swagger
 * /public/category-translations:
 *   get:
 *     summary: Debug listing of categories with raw translation (NOT for production use)
 *     description: Returns categories plus their translation for a requested language without domain-language gating. Use only for diagnostics.
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: app.kaburlumedia.com
 *       - in: query
 *         name: languageCode
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Categories with translation status
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   - id: 'cat1'
 *                     baseName: 'NATIONAL'
 *                     translated: 'జాతీయ'
 *                     hasTranslation: true
 */
router.get('/category-translations', async (req, res) => {
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;
  if (!languageCode) return res.status(400).json({ error: 'languageCode required' });
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const domainCats = await p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } });
  const categories = domainCats.map((dc: any) => dc.category);

  const langRow = await p.language.findUnique({ where: { code: languageCode } });
  let domainLanguageEnabled = false;
  let tenantDefaultLangCode: string | undefined;
  try {
    const entity = await p.tenantEntity.findUnique({ where: { tenantId: tenant.id }, include: { language: true } });
    tenantDefaultLangCode = entity?.language?.code;
  } catch (_) { /* ignore */ }
  if (langRow) {
    const domLang = await p.domainLanguage.findUnique({ where: { domainId_languageId: { domainId: domain.id, languageId: langRow.id } } });
    domainLanguageEnabled = !!domLang || (tenantDefaultLangCode === languageCode);
  }

  let translationsMap = new Map<string, string>();
  if (domainLanguageEnabled) {
    const translations = await p.categoryTranslation.findMany({ where: { language: languageCode, categoryId: { in: categories.map((c: any) => c.id) } } });
    translationsMap = new Map(translations.map((t: any) => [t.categoryId, t.name]));
  }

  const shaped = categories.map((c: any) => ({
    id: c.id,
    baseName: c.name,
    slug: c.slug,
    translated: domainLanguageEnabled ? (translationsMap.get(c.id) || null) : null,
    hasTranslation: domainLanguageEnabled && translationsMap.has(c.id),
    domainLanguageEnabled,
    tenantDefaultLanguage: tenantDefaultLangCode
  }));
  res.json(shaped);
});

/**
 * @swagger
 * /public/articles:
 *   get:
 *     summary: List published website articles (TenantWebArticle) for this domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: categorySlug
 *         schema: { type: string }
 *       - in: query
 *         name: languageCode
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated article cards
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   page: 1
 *                   pageSize: 20
 *                   total: 100
 *                   items:
 *                     - id: "wa_1"
 *                       slug: "sangareddy-patancheru-december-27"
 *                       title: "Headline"
 *                       excerpt: "Short summary..."
 *                       coverImageUrl: "https://cdn.example.com/cover.webp"
 *                       publishedAt: "2025-12-27T10:00:00.000Z"
 *                       category: { id: "cat_1", slug: "politics", name: "రాజకీయాలు" }
 *                       languageCode: "te"
 *                       tags: ["breaking", "telangana"]
 */
router.get('/articles', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
  const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '20'), 10), 1), 100);
  const categorySlug = req.query.categorySlug ? String(req.query.categorySlug) : undefined;
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  // Allowed categories & languages for domain
  const [domainCats, domainLangs, activeDomainCount] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }),
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0)
  ]);
  const allowedCategoryIds = new Set(domainCats.map((d: any) => d.categoryId));
  const allowedLanguageIds = new Set(domainLangs.map((d: any) => d.languageId));

  // Domain scoping: strict to current domain; optionally include orphaned (domainId null) only when tenant has a single active domain.
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domain.id }, { domainId: null }] }
    : { domainId: domain.id };

  let categoryIdFilter: string | undefined;
  if (categorySlug) {
    const match = domainCats.find((d: any) => d.category?.slug === categorySlug);
    if (!match) return res.json({ page, pageSize, total: 0, items: [] });
    categoryIdFilter = match.categoryId;
  }

  let languageIdFilter: string | undefined;
  if (languageCode) {
    const lang = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (!lang) return res.json({ page, pageSize, total: 0, items: [] });
    languageIdFilter = lang.languageId;
  }

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    ...domainScope,
  };
  if (categoryIdFilter) {
    where.categoryId = categoryIdFilter;
  } else if (allowedCategoryIds.size) {
    where.categoryId = { in: Array.from(allowedCategoryIds) };
  }
  if (languageIdFilter) {
    where.languageId = languageIdFilter;
  } else if (allowedLanguageIds.size) {
    where.languageId = { in: Array.from(allowedLanguageIds) };
  }

  const [total, rows] = await Promise.all([
    p.tenantWebArticle.count({ where }),
    p.tenantWebArticle.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, slug: true, name: true } },
        language: { select: { code: true } }
      }
    })
  ]);

  const items = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
  res.json({ page, pageSize, total, items });
});

/**
 * @swagger
 * /public/articles/home:
 *   get:
 *     summary: Latest website articles for homepage (TenantWebArticle)
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: manachourasta.com
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         example: 30
 *       - in: query
 *         name: shape
 *         required: false
 *         description: Optional response shape. `homepage` returns hero/topStories + section-wise data driven by tenant theme homepage settings.
 *         schema:
 *           type: string
 *           enum: ['flat', 'homepage']
 *         example: homepage
 *       - in: query
 *         name: themeKey
 *         required: false
 *         description: Theme key used to read TenantTheme.homepageConfig (e.g. style1). Defaults to style1.
 *         schema:
 *           type: string
 *           example: style1
 *       - in: query
 *         name: lang
 *         required: false
 *         description: Optional language code filter (must be allowed for domain).
 *         schema:
 *           type: string
 *           example: te
 *     responses:
 *       200:
 *         description: Latest card items
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   items:
 *                     - id: "wa_1"
 *                       slug: "sangareddy-patancheru-december-27"
 *                       title: "Headline"
 *                       excerpt: "Short summary..."
 *                       coverImageUrl: "https://cdn.example.com/cover.webp"
 *                       publishedAt: "2025-12-27T10:00:00.000Z"
 *                       category: { id: "cat_1", slug: "politics", name: "రాజకీయాలు" }
 *                       languageCode: "te"
 *                       tags: ["telangana"]
 *               homepage:
 *                 summary: Section-wise homepage response (use ?shape=homepage)
 *                 value:
 *                   hero: []
 *                   topStories: []
 *                   sections:
 *                     - key: "politics"
 *                       title: "Politics"
 *                       position: 10
 *                       limit: 6
 *                       categorySlug: "politics"
 *                       items: []
 *                   config:
 *                     heroCount: 1
 *                     topStoriesCount: 5
 *                     themeKey: "style1"
 */
router.get('/articles/home', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10), 1), 100);

  const shape = String(req.query.shape || 'flat').toLowerCase();
  const themeKey = String(req.query.themeKey || 'style1').trim() || 'style1';
  const langCode = (req.query.lang ? String(req.query.lang) : '').trim() || null;

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domain.id }, { domainId: null }] }
    : { domainId: domain.id };

  // Resolve optional language filter (must be allowed for domain)
  let languageId: string | null = null;
  if (langCode) {
    const domainLangs = await p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }).catch(() => []);
    const match = (domainLangs || []).find((dl: any) => dl.language?.code === langCode);
    if (!match) {
      // Unknown/disabled language => empty result (safe)
      return res.json(shape === 'homepage'
        ? { hero: [], topStories: [], sections: [], config: { heroCount: 1, topStoriesCount: 5, themeKey, lang: langCode } }
        : { items: [] }
      );
    }
    languageId = match.languageId;
  }

  // Default/legacy response: flat list
  if (shape !== 'homepage') {
    const rows = await p.tenantWebArticle.findMany({
      where: { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope, ...(languageId ? { languageId } : {}) },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
    });
    const items = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
    return res.json({ items });
  }

  // Homepage response: hero/topStories + configurable sections
  type HomepageSectionCfg = {
    key: string;
    title?: string;
    label?: string;
    position?: number;
    limit?: number;
    categorySlug?: string;
    tagsHas?: string;
  };

  const [domainCats, tenantTheme] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }).catch(() => []),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null)
  ]);
  const categoryBySlug = new Map<string, any>((domainCats || []).map((d: any) => [d.category?.slug, d.category]));
  const allowedCategoryIds = new Set((domainCats || []).map((d: any) => d.categoryId));

  const themeHomeAny: any = (tenantTheme as any)?.homepageConfig || null;
  const themeCfg: any = themeHomeAny && typeof themeHomeAny === 'object'
    ? (themeHomeAny[themeKey] ?? themeHomeAny)
    : null;

  const cfg: any = themeCfg || {};
  const clampInt = (value: any, min: number, max: number, fallback: number) => {
    const n = parseInt(String(value), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  };
  const heroCount = clampInt(cfg.heroCount, 1, 10, 1);
  const topStoriesCount = clampInt(cfg.topStoriesCount, 1, 20, 5);

  const defaultSections: HomepageSectionCfg[] = [
    { key: 'politics', title: 'Politics', position: 10, limit: 6, categorySlug: 'politics' },
    { key: 'technology', title: 'Technology', position: 20, limit: 6, categorySlug: 'technology' },
    { key: 'sports', title: 'Sports', position: 30, limit: 6, categorySlug: 'sports' }
  ];
  const rawSections: HomepageSectionCfg[] = Array.isArray(cfg.sections) && cfg.sections.length ? cfg.sections : defaultSections;
  const sectionsCfg: HomepageSectionCfg[] = rawSections
    .map((s: any) => ({
      key: String(s?.key || '').trim(),
      title: typeof s?.title === 'string' ? s.title : undefined,
      label: typeof s?.label === 'string' ? s.label : undefined,
      position: typeof s?.position === 'number' ? s.position : (parseInt(String(s?.position || '999'), 10) || 999),
      limit: clampInt(s?.limit, 1, 50, 6),
      categorySlug: typeof s?.categorySlug === 'string' ? s.categorySlug : undefined,
      tagsHas: typeof s?.tagsHas === 'string' ? s.tagsHas : undefined,
    }))
    .filter((s: any) => s.key)
    .sort((a: any, b: any) => a.position - b.position)
    .slice(0, 25);

  const baseWhere: any = { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope };
  if (allowedCategoryIds.size) baseWhere.categoryId = { in: Array.from(allowedCategoryIds) };
  if (languageId) baseWhere.languageId = languageId;

  // Pull a pool of latest articles once, to build hero/topStories + dedupe
  const poolTake = Math.min(
    100,
    Math.max(limit, heroCount + topStoriesCount + sectionsCfg.reduce((sum, s) => sum + (s.limit || 0), 0) + 25)
  );
  const latestPoolRows = await p.tenantWebArticle.findMany({
    where: baseWhere,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: poolTake,
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  const latestPool = latestPoolRows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));

  const hero = latestPool.slice(0, heroCount);
  const topStories = latestPool.slice(heroCount, heroCount + topStoriesCount);
  const seen = new Set<string>();
  for (const c of [...hero, ...topStories]) {
    if (c?.id) seen.add(String(c.id));
  }

  async function fetchSectionItems(s: HomepageSectionCfg) {
    const want = Math.min(Math.max(Number(s.limit || 6), 1), 50);

    // Prefer category-specific query when categorySlug is provided.
    if (s.categorySlug) {
      const resolvedCategory = categoryBySlug.get(s.categorySlug) || null;
      if (!resolvedCategory) {
        return {
          key: s.key,
          title: s.label || s.title || s.key,
          position: s.position,
          limit: want,
          categorySlug: s.categorySlug,
          items: []
        };
      }

      const where: any = { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope, categoryId: resolvedCategory.id };
      if (languageId) where.languageId = languageId;
      if (s.tagsHas) where.tags = { has: s.tagsHas };

      const rows = await p.tenantWebArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(want + 25, 75),
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      const cards = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
      const items: any[] = [];
      for (const c of cards) {
        if (!c?.id) continue;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        items.push(c);
        if (items.length >= want) break;
      }
      return {
        key: s.key,
        title: s.label || s.title || resolvedCategory.name || s.key,
        position: s.position,
        limit: want,
        categorySlug: s.categorySlug,
        items
      };
    }

    // Otherwise: latest pool (optionally filtered by tagsHas)
    const items: any[] = [];
    for (const c of latestPool) {
      if (!c?.id) continue;
      if (seen.has(c.id)) continue;
      if (s.tagsHas) {
        const tags = Array.isArray((c as any).tags) ? (c as any).tags : [];
        if (!tags.includes(s.tagsHas)) continue;
      }
      seen.add(c.id);
      items.push(c);
      if (items.length >= want) break;
    }
    return {
      key: s.key,
      title: s.label || s.title || s.key,
      position: s.position,
      limit: want,
      categorySlug: s.categorySlug || null,
      items
    };
  }

  const sections = await Promise.all(sectionsCfg.map(fetchSectionItems));

  // Frontend convenience: also expose a map keyed by section key.
  const data: Record<string, any[]> = {};
  for (const s of sections as any[]) {
    if (s?.key) data[String(s.key)] = Array.isArray(s.items) ? s.items : [];
  }

  const out: any = {
    hero,
    topStories,
    sections,
    data,
    config: {
      heroCount,
      topStoriesCount,
      themeKey,
      lang: langCode
    }
  };

  // Optional convenience fields if configured by section keys.
  if (data.latest) out.latest = data.latest;
  if (data.trending) out.trending = data.trending;
  if (data.breaking) out.breaking = data.breaking;

  return res.json(out);
});

/**
 * @swagger
 * /public/articles/by-category/{slug}:
 *   get:
 *     summary: Website articles by category slug (domain-allowed)
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated items
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   page: 1
 *                   pageSize: 20
 *                   total: 10
 *                   items:
 *                     - id: "wa_2"
 *                       slug: "politics-headline-1"
 *                       title: "Category headline"
 *                       excerpt: "Short summary..."
 *                       coverImageUrl: null
 *                       publishedAt: "2025-12-28T08:00:00.000Z"
 *                       category: { id: "cat_1", slug: "politics", name: "రాజకీయాలు" }
 *                       languageCode: "te"
 *                       tags: []
 */
router.get('/articles/by-category/:slug', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
  const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '20'), 10), 1), 100);
  const slug = String(req.params.slug);

  const [domainCats, activeDomainCount] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }),
    p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0)
  ]);
  const match = domainCats.find((d: any) => d.category?.slug === slug);
  if (!match) return res.json({ page, pageSize, total: 0, items: [] });

  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domain.id }, { domainId: null }] }
    : { domainId: domain.id };

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    categoryId: match.categoryId,
    ...domainScope
  };

  const [total, rows] = await Promise.all([
    p.tenantWebArticle.count({ where }),
    p.tenantWebArticle.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
    })
  ]);
  const items = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
  res.json({ page, pageSize, total, items });
});

/**
 * @swagger
 * /public/articles/latest:
 *   get:
 *     summary: Latest website article cards
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *         example: 8
 *     responses:
 *       200:
 *         description: Latest short list of cards
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   items:
 *                     - id: "wa_3"
 *                       slug: "latest-headline-1"
 *                       title: "Latest headline"
 *                       excerpt: "Short summary..."
 *                       coverImageUrl: "https://cdn.example.com/cover.webp"
 *                       publishedAt: "2025-12-28T10:00:00.000Z"
 *                       category: { id: "cat_9", slug: "national", name: "జాతీయ" }
 *                       languageCode: "te"
 *                       tags: ["breaking"]
 */
router.get('/articles/latest', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '8'), 10), 1), 50);

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domain.id }, { domainId: null }] }
    : { domainId: domain.id };

  const rows = await p.tenantWebArticle.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  const items = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
  res.json({ items });
});

/**
 * @swagger
 * /public/stories:
 *   get:
 *     summary: Web stories (alias of /public/webstories)
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *         example: 8
 *     responses:
 *       200:
 *         description: Story cards
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   items:
 *                     - id: "ws1"
 *                       title: "Story"
 */
router.get('/stories', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '8'), 10), 1), 50);
  const stories = await p.article.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', type: 'web_story' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, title: true, images: true }
  });
  const items = stories.map((s: any) => ({ id: s.id, title: s.title, posterUrl: s.images?.[0] || null }));
  res.json({ items });
});

/**
 * @swagger
 * /public/tenants/by-domain/{domain}:
 *   get:
 *     summary: Resolve tenant by domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant basic info
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   id: "tenant1"
 *                   slug: "manachourasta"
 *                   name: "Mana Chourasta"
 *       404:
 *         description: Not found
 */
router.get('/tenants/by-domain/:domain', async (req, res) => {
  const dom = await p.domain.findUnique({ where: { domain: String(req.params.domain) }, include: { tenant: true } });
  if (!dom || dom.status !== 'ACTIVE' || !dom.tenant) return res.status(404).json({ error: 'Not found' });
  const { id, slug, name } = dom.tenant;
  res.json({ id, slug, name });
});

/**
 * @swagger
 * /public/articles/{slug}:
 *   get:
 *     summary: Get a single published website article by slug for this domain
 *     tags: [Public - Website, Public - Tenant]
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
 *       - in: query
 *         name: languageCode
 *         required: false
 *         description: Optional language code (useful when multiple locales publish the same slug).
 *         schema: { type: string, example: te }
 *     responses:
 *       200:
 *         description: Website article detail
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   id: "wa_1"
 *                   tenantId: "t_abc"
 *                   slug: "sangareddy-patancheru-december-27"
 *                   title: "Headline"
 *                   subtitle: ""
 *                   excerpt: "Short summary..."
 *                   tags: ["telangana"]
 *                   status: "published"
 *                   publishedAt: "2025-12-27T10:00:00.000Z"
 *                   coverImage: { alt: "", url: "https://cdn.example.com/cover.webp", caption: "" }
 *                   categories: []
 *                   blocks: []
 *                   contentHtml: ""
 *                   plainText: ""
 *                   readingTimeMin: 2
 *                   languageCode: "te"
 *                   authors: []
 *                   meta: { seoTitle: "Headline", metaDescription: "Short summary..." }
 *                   jsonLd: {}
 */
router.get('/articles/:slug', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const slugRaw = String(req.params.slug);
  const slug = (() => {
    try {
      return decodeURIComponent(slugRaw);
    } catch {
      return slugRaw;
    }
  })();
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  const [domainCats, domainLangs, activeDomainCount] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id } }),
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0)
  ]);
  const allowedCategoryIds = new Set(domainCats.map((d: any) => d.categoryId));
  const allowedLanguageIds = new Set(domainLangs.map((d: any) => d.languageId));
  // Best practice: always include shared tenant website articles (domainId=null)
  // so multi-domain tenants still see the content they published as shared.
  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };

  let languageIdFilter: string | undefined;
  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (!match) return res.status(404).json({ error: 'Not found' });
    languageIdFilter = match.languageId;
  }

  const and: any[] = [domainScope];

  // Language filters:
  // - If languageCode is explicitly provided, match exactly that language.
  // - Otherwise, restrict to allowed languages, but also include legacy rows where languageId is null.
  if (languageIdFilter) {
    and.push({ languageId: languageIdFilter });
  } else if (allowedLanguageIds.size) {
    and.push({ OR: [{ languageId: { in: Array.from(allowedLanguageIds) } }, { languageId: null }] });
  }

  // Category filters: if domain has an allowed list, allow uncategorized rows too
  // (many ingested TenantWebArticle rows can have categoryId=null).
  if (allowedCategoryIds.size) {
    and.push({ OR: [{ categoryId: { in: Array.from(allowedCategoryIds) } }, { categoryId: null }] });
  }

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    AND: and,
    OR: [{ slug }, { id: slug }]
  };

  const [a, tenantTheme] = await Promise.all([
    p.tenantWebArticle.findFirst({
    where,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      tenantId: true,
      domainId: true,
      languageId: true,
      language: { select: { code: true } },
      title: true,
      slug: true,
      status: true,
      coverImageUrl: true,
      contentJson: true,
      seoTitle: true,
      metaDescription: true,
      jsonLd: true,
      tags: true,
      publishedAt: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { slug: true, name: true } }
    }
  }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null)
  ]);

  if (!a) return res.status(404).json({ error: 'Not found' });

  // Best-effort view tracking for website analytics.
  // This is intentionally fire-and-forget to avoid slowing down article detail responses.
  void p.tenantWebArticle
    .update({ where: { id: a.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => null);

  const detail: any = toWebArticleDetailDto(a);

  const canonicalUrl = `https://${domain.domain}/articles/${encodeURIComponent(detail.slug)}`;
  const imageUrls = [detail?.coverImage?.url].filter(Boolean) as string[];
  const authorNameRaw = Array.isArray(detail.authors) && detail.authors.length ? (detail.authors[0]?.name || null) : null;
  const tenantDisplayName = (tenant as any)?.displayName || tenant.name;
  const authorName = (authorNameRaw && String(authorNameRaw).trim()) ? String(authorNameRaw).trim() : `${tenantDisplayName} Reporter`;
  const sectionName = (a as any)?.category?.name || (a as any)?.category?.slug || null;
  const resolvedLanguageCode = (a as any)?.language?.code || detail?.languageCode || undefined;
  const keywords = Array.isArray(detail?.tags) ? detail.tags.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 15) : undefined;
  const publisherLogoUrl = (tenantTheme as any)?.logoUrl || null;
  const cover = (a as any)?.contentJson?.coverImage || (detail as any)?.coverImage || null;
  const imageWidth = cover && Number.isFinite(Number(cover.w)) ? Number(cover.w) : undefined;
  const imageHeight = cover && Number.isFinite(Number(cover.h)) ? Number(cover.h) : undefined;

  const generated = buildNewsArticleJsonLd({
    // Use the full article title for JSON-LD headline (avoid shortened SEO title).
    headline: detail.title,
    description: detail.meta?.metaDescription || detail.excerpt || undefined,
    canonicalUrl,
    imageUrls,
    imageWidth,
    imageHeight,
    languageCode: resolvedLanguageCode || undefined,
    datePublished: detail.publishedAt || undefined,
    dateModified: (a as any)?.updatedAt ? new Date((a as any).updatedAt).toISOString() : (detail.publishedAt || undefined),
    authorName: authorName || undefined,
    publisherName: tenantDisplayName,
    publisherLogoUrl: publisherLogoUrl || undefined,
    keywords,
    articleSection: sectionName || undefined,
    isAccessibleForFree: true,
  });

  // Merge: keep stored jsonLd values when they are meaningful, but fill missing bits from generated.
  const existing = detail.jsonLd && typeof detail.jsonLd === 'object' ? detail.jsonLd : {};
  const merged: any = { ...generated };
  const preferGenerated = new Set(['headline', 'image', 'author', 'articleSection']);
  const looksLikeInternalId = (value: any) => {
    const s = String(value || '').trim();
    if (!s) return false;
    // cuid/uuid-like or long opaque ids
    if (/^c[a-z0-9]{20,}$/i.test(s)) return true;
    if (/^[a-f0-9]{24,}$/i.test(s)) return true;
    if (/^[a-f0-9-]{32,}$/i.test(s) && s.includes('-')) return true;
    return false;
  };

  for (const [k, v] of Object.entries(existing)) {
    if (preferGenerated.has(k)) continue;
    if (k === 'articleSection' && looksLikeInternalId(v)) continue;
    const isEmpty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as any).length === 0);
    if (!isEmpty) merged[k] = v;
  }
  // Nested fill: publisher.logo
  if (merged.publisher && typeof merged.publisher === 'object') {
    const existingPublisher = (existing as any).publisher;
    if (existingPublisher && typeof existingPublisher === 'object') {
      merged.publisher = { ...merged.publisher, ...existingPublisher };
      if ((existingPublisher as any).logo && typeof (existingPublisher as any).logo === 'object') {
        merged.publisher.logo = { ...(merged.publisher.logo || {}), ...(existingPublisher as any).logo };
      }
    }
  }

  detail.jsonLd = merged;
  res.json(detail);
});

/**
 * @swagger
 * /public/entity:
 *   get:
 *     summary: Get public PRGI/entity details for this domain's tenant
 *     tags: [Public - Website, Public - Tenant]
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
 *         description: Entity details
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   prgiNumber: "PRGI-1234"
 *                   registrationTitle: "Kaburlu News"
 *       404: { description: Not found }
 */
router.get('/entity', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const tenantDisplayName = (tenant as any)?.displayName || tenant.name;
  const row = await p.tenantEntity.findUnique({
    where: { tenantId: tenant.id },
    include: {
      language: true,
      publicationCountry: true,
      publicationState: true,
      publicationDistrict: true,
      publicationMandal: true,
      printingDistrict: true,
      printingMandal: true,
    }
  });
  if (!row) return res.status(404).json({ error: 'Not found' });
  // Only expose safe public fields
  const { prgiNumber, registrationTitle, periodicity, registrationDate, language, ownerName, publisherName, editorName,
    publicationCountry, publicationState, publicationDistrict, publicationMandal, printingPressName, printingDistrict, printingMandal, printingCityName, address } = row;
  res.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      displayName: tenantDisplayName,
      language: (tenant as any).primaryLanguage || null,
    },
    prgiNumber, registrationTitle, periodicity, registrationDate,
    language,
    ownerName, publisherName, editorName,
    publicationCountry, publicationState, publicationDistrict, publicationMandal,
    printingPressName, printingDistrict, printingMandal, printingCityName,
    address,
  });
});

export default router;
/**
 * @swagger
 * /public/tenant:
 *   get:
 *     summary: Resolve current tenant by Host/X-Tenant-Domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override to resolve tenant when testing locally.
 *         schema:
 *           type: string
 *           example: manachourasta.com
 *     responses:
 *       200:
 *         description: Current tenant basic info
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   id: "tenant1"
 *                   slug: "manachourasta"
 *                   name: "Mana Chourasta"
 *                   domain: "manachourasta.com"
 *       500:
 *         description: Domain context missing
 */
router.get('/tenant', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const { id, slug, name } = tenant;
  res.json({ id, slug, name, domain: domain.domain });
});