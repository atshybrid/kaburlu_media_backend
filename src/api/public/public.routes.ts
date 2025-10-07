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
 * /api/public/categories:
 *   get:
 *     summary: List categories allowed for this domain
 *     tags: [Public - Tenant]
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
  const domainCats = await p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } });
  const allowedIds = new Set(domainCats.map((dc: any) => dc.categoryId));
  let categories = domainCats.map((dc: any) => dc.category);

  if (includeChildren) {
    const childIds: string[] = [];
    categories.forEach((c: any) => {
      // fetch children lazily (could be optimized by single query)
      childIds.push(c.id);
    });
    const children = await p.category.findMany({ where: { parentId: { in: Array.from(childIds) } } });
    // Filter children to allowed set if they are explicitly allowed
    categories = categories.concat(children.filter((ch: any) => allowedIds.has(ch.id)));
  }
  // Deduplicate by id
  const map = new Map<string, any>();
  categories.forEach((c: any) => map.set(c.id, { id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, iconUrl: c.iconUrl }));
  res.json(Array.from(map.values()));
});

/**
 * @swagger
 * /api/public/articles:
 *   get:
 *     summary: List published articles for this domain
 *     tags: [Public - Tenant]
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
 *     tags: [Public - Tenant]
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

export default router;