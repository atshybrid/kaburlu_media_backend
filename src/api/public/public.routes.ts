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
 * /api/public/theme:
 *   get:
 *     summary: Get website theme for this domain's tenant
 *     description: Returns branding assets and colors configured for the tenant resolved from the request domain.
 *     tags: [Public - Website, Public - Tenant]
 *     responses:
 *       200:
 *         description: Theme or null
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
 * /api/public/categories:
 *   get:
 *     summary: List categories allowed for this domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: query
 *         name: includeChildren
 *         schema: { type: boolean }
 *         description: Include immediate children categories (filtered to allowed set)
 *     responses:
 *       200:
 *         description: Category list
 */
router.get('/categories', async (req, res) => {
  const domain = (res.locals as any).domain;
  if (!domain) return res.status(500).json({ error: 'Domain context missing' });

  const includeChildren = String(req.query.includeChildren).toLowerCase() === 'true';
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

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

  // Optional: apply translations if a language is requested and allowed for this domain
  let translationsByCategory: Map<string, string> | undefined;
  if (languageCode) {
    // Check language is allowed for this domain
    const lang = await p.language.findUnique({ where: { code: languageCode } });
    if (lang) {
      const domLang = await p.domainLanguage.findUnique({
        where: { domainId_languageId: { domainId: domain.id, languageId: lang.id } }
      });
      if (domLang) {
        const ids = Array.from(new Set(categories.map((c: any) => c.id)));
        const translations = await p.categoryTranslation.findMany({
          where: { categoryId: { in: ids }, language: languageCode }
        });
        translationsByCategory = new Map(translations.map((t: any) => [t.categoryId, t.name]));
      }
    }
  }

  // Deduplicate and shape response, substituting translation when available
  const map = new Map<string, any>();
  categories.forEach((c: any) => {
    const displayName = translationsByCategory?.get(c.id) || c.name;
    map.set(c.id, { id: c.id, name: displayName, slug: c.slug, parentId: c.parentId, iconUrl: c.iconUrl });
  });
  res.json(Array.from(map.values()));
});

/**
 * @swagger
 * /api/public/articles:
 *   get:
 *     summary: List published articles for this domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
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
 *       200: { description: Paginated articles }
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
 * /api/public/articles/{slug}:
 *   get:
 *     summary: Get a single published article by slug for this domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Article or 404 }
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
 * /api/public/entity:
 *   get:
 *     summary: Get public PRGI/entity details for this domain's tenant
 *     tags: [Public - Tenant]
 *     responses:
 *       200: { description: Entity details }
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