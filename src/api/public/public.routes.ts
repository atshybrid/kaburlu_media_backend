import { Router } from 'express';
import { tenantResolver } from '../../middleware/tenantResolver';
import prisma from '../../lib/prisma';

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

  // Optional: apply translations if a language is effective and allowed for this domain
  let translationsByCategory: Map<string, string> | undefined;
  if (languageCode) {
    const lang = await p.language.findUnique({ where: { code: languageCode } });
    if (lang) {
      const domLang = await p.domainLanguage.findUnique({ where: { domainId_languageId: { domainId: domain.id, languageId: lang.id } } });
      if (domLang) {
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
  if (!domain) return res.status(500).json({ error: 'Domain context missing' });

  // Categories allocated to this domain only
  const domainCats = await p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } });
  const categories = domainCats.map((dc: any) => dc.category);

  // Respect DomainLanguage gating: if language not enabled for domain, return list with translated=null
  const langRow = await p.language.findUnique({ where: { code: languageCode } });
  let domainLanguageEnabled = false;
  if (langRow) {
    const domLang = await p.domainLanguage.findUnique({ where: { domainId_languageId: { domainId: domain.id, languageId: langRow.id } } });
    domainLanguageEnabled = !!domLang;
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
    domainLanguageEnabled
  }));
  res.json(shaped);
});

/**
 * @swagger
 * /public/articles:
 *   get:
 *     summary: List published articles for this domain
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
 *         description: Paginated articles
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   page: 1
 *                   pageSize: 20
 *                   total: 100
 *                   items:
 *                     - id: "art1"
 *                       title: "Headline"
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
  const [domainCats, domainLangs] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }),
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } })
  ]);
  const allowedCategoryIds = new Set(domainCats.map((d: any) => d.categoryId));
  const allowedLanguageIds = new Set(domainLangs.map((d: any) => d.languageId));

  let categoryFilterIds: string[] | undefined;
  if (categorySlug) {
    const match = domainCats.find((d: any) => d.category.slug === categorySlug);
    if (!match) return res.json({ page, pageSize, total: 0, items: [] });
    categoryFilterIds = [match.categoryId];
  }

  let languageIdFilter: string | undefined;
  if (languageCode) {
    const lang = domainLangs.find((d: any) => d.language.code === languageCode);
    if (!lang) return res.json({ page, pageSize, total: 0, items: [] });
    languageIdFilter = lang.languageId;
  }

  // Query articles belonging to tenant, published, within allowed filters
  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED'
  };
  if (languageIdFilter) where.languageId = languageIdFilter;
  if (categoryFilterIds) {
    where.categories = { some: { id: { in: categoryFilterIds } } };
  } else {
    // ensure only allowed categories (if no explicit filter) by restricting join
    where.categories = { some: { id: { in: Array.from(allowedCategoryIds) } } };
  }
  if (allowedLanguageIds.size) {
    where.languageId = where.languageId || { in: Array.from(allowedLanguageIds) };
  }

  const [total, items] = await Promise.all([
    p.article.count({ where }),
    p.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { categories: true, author: { select: { id: true, mobileNumber: true } }, tenant: { select: { id: true, slug: true } }, language: true }
    })
  ]);

  res.json({ page, pageSize, total, items });
});

/**
 * @swagger
 * /public/articles/home:
 *   get:
 *     summary: Latest articles for homepage
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
 *     responses:
 *       200:
 *         description: Latest items
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   items:
 *                     - id: "art1"
 *                       title: "Headline"
 *                       coverImage: { url: "https://cdn/img.jpg" }
 */
router.get('/articles/home', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10), 1), 100);
  const items = await p.article.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, title: true, images: true, createdAt: true }
  });
  const out = items.map((a: any) => ({ id: a.id, title: a.title, coverImage: a.images?.[0] ? { url: a.images[0] } : null, createdAt: a.createdAt }));
  res.json({ items: out });
});

/**
 * @swagger
 * /public/articles/by-category/{slug}:
 *   get:
 *     summary: Articles by category slug (domain-allowed)
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
 *                     - id: "art1"
 *                       title: "Category headline"
 */
router.get('/articles/by-category/:slug', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
  const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '20'), 10), 1), 100);
  const slug = String(req.params.slug);
  const domainCats = await p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } });
  const match = domainCats.find((d: any) => d.category.slug === slug);
  if (!match) return res.json({ page, pageSize, total: 0, items: [] });
  const where: any = { tenantId: tenant.id, status: 'PUBLISHED', categories: { some: { id: match.categoryId } } };
  const [total, items] = await Promise.all([
    p.article.count({ where }),
    p.article.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  res.json({ page, pageSize, total, items });
});

/**
 * @swagger
 * /public/articles/latest:
 *   get:
 *     summary: Latest article titles
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
 *         description: Latest short list
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   items:
 *                     - id: "art2"
 *                       slug: "art2"
 *                       title: "Latest headline"
 */
router.get('/articles/latest', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '8'), 10), 1), 50);
  const items = await p.article.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, title: true, images: true }
  });
  const out = items.map((a: any) => ({ id: a.id, slug: a.id, title: a.title, coverImage: a.images?.[0] ? { url: a.images[0] } : null }));
  res.json({ items: out });
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
 *     summary: Get a single published article by slug for this domain
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
 *     responses:
 *       200:
 *         description: Article or 404
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   id: "art1"
 *                   title: "Headline"
 *                   status: "PUBLISHED"
 */
router.get('/articles/:slug', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });
  const slug = req.params.slug;
  // Allowed categories & languages for domain (could be cached)
  const [domainCats, domainLangs] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id } }),
    p.domainLanguage.findMany({ where: { domainId: domain.id } })
  ]);
  const allowedCategoryIds = new Set(domainCats.map((d: any) => d.categoryId));
  const allowedLanguageIds = new Set(domainLangs.map((d: any) => d.languageId));

  const article = await p.article.findFirst({
    where: {
      tenantId: tenant.id,
      status: 'PUBLISHED',
      OR: [ { title: slug }, { id: slug } ] // fallback if slug stored externally – adapt when real slug field added
    },
    include: { categories: true, author: { select: { id: true, mobileNumber: true } }, tenant: { select: { id: true, slug: true } }, language: true }
  });
  if (!article) return res.status(404).json({ error: 'Not found' });
  // Filter by allowed categories & language
  if (!article.categories.some((c: any) => allowedCategoryIds.has(c.id))) return res.status(404).json({ error: 'Not found' });
  if (article.languageId && allowedLanguageIds.size && !allowedLanguageIds.has(article.languageId)) return res.status(404).json({ error: 'Not found' });
  res.json(article);
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
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
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