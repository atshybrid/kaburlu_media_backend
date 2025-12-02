import { Router } from 'express';
import { tenantResolver } from '../../middleware/tenantResolver';
import prisma from '../../lib/prisma';

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
  const entity = await p.entitySettings.findFirst().catch(()=>null);
  const tenantSet = await p.tenantSettings.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);
  const domainSet = await p.domainSettings.findUnique({ where: { domainId: domain.id } }).catch(()=>null);
  const effective = merge(merge(entity?.data, tenantSet?.data), domainSet?.data);
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

// Map article to card shape
function toCard(a: any) {
  return {
    id: a.id,
    title: a.title,
    slug: a.id, // placeholder until real slug field exists
    image: a.images?.[0] || null,
    excerpt: a.shortNews || null,
    category: a.categories?.[0] ? { slug: a.categories[0].slug, name: a.categories[0].name } : null,
    publishedAt: a.createdAt,
    isBreakingNews: a.isBreakingNews,
    isTrending: a.isTrending
  };
}

/**
 * @swagger
 * /public/homepage:
 *   get:
 *     summary: Aggregated homepage sections
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
  *         description: Homepage JSON sections
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   hero:
  *                     - id: "art123"
  *                       title: "Top headline"
  *                       image: "https://cdn/img.jpg"
  *                   topStories:
  *                     - id: "art124"
  *                       title: "Story"
  *                       image: null
  *                   politics: []
  *                   technology: []
  *                   sports: []
 *       500:
 *         description: Domain context missing
 */
router.get('/homepage', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  // Fetch latest published articles for tenant
  const articles = await p.article.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { categories: true }
  });
  const cards = articles.map(toCard);
  const hero = cards.slice(0, 1);
  const topStories = cards.slice(1, 6);
  const politics = cards.filter((c: any) => c.category?.slug === 'politics').slice(0, 6);
  const technology = cards.filter((c: any) => c.category?.slug === 'technology').slice(0, 6);
  const sports = cards.filter((c: any) => c.category?.slug === 'sports').slice(0, 6);
  res.json({ hero, topStories, politics, technology, sports });
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
  *                   - id: "art100"
  *                     title: "Breaking"
  *                     isBreakingNews: true
 */
router.get('/live-desk', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '12'), 10), 1), 50);
  const liveArticles = await p.article.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', isBreakingNews: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { categories: true }
  });
  res.json(liveArticles.map(toCard));
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
  *                   - id: "ws1"
  *                     title: "Story"
  *                     image: "https://cdn/img.jpg"
 */
router.get('/webstories', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10), 1), 50);
  const stories = await p.article.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', type: 'web_story' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { categories: true }
  });
  res.json(stories.map(toCard));
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
  const slug = req.params.slug;
  const article = await p.article.findFirst({
    where: { tenantId: tenant.id, status: 'PUBLISHED', OR: [ { id: slug }, { title: slug } ] },
    include: { categories: true, author: true }
  });
  if (!article) return res.status(404).json({ error: 'Not found' });
  const base = `https://${domain}`;
  const url = `${base}/articles/${article.id}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: article.title,
    image: (article.images || []).slice(0, 3),
    datePublished: article.createdAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Person', name: article.author?.name || 'Reporter' },
    publisher: { '@type': 'Organization', name: tenant.name },
    articleSection: article.categories?.[0]?.slug || null,
    description: article.shortNews || null,
    inLanguage: article.languageId || 'en-IN'
  };
  res.json(jsonld);
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