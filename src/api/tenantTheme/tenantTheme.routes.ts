import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdminScoped } from '../middlewares/authz';
import { style2ConfigRoutes } from './style2Config.routes';

const router = Router();

/**
 * TENANT THEME API STRUCTURE
 * ==========================
 * 
 * CURRENT ACTIVE ENDPOINTS:
 * - Style1: Use generic style endpoints (/{tenantId}/homepage/style1/...)
 * - Style2: Use dedicated Style2 config API (/{tenantId}/style2-config/...)
 * 
 * DEPRECATED ENDPOINTS REMOVED:
 * - /homepage/style2/v2/* (replaced by unified Style2 config API)
 * 
 * For new Style2 implementations, use the dedicated Style2 config API which provides:
 * - GET /{tenantId}/style2-config (get configuration)
 * - PUT /{tenantId}/style2-config (update configuration)  
 * - POST /{tenantId}/style2-config/apply-default (apply default configuration)
 * - GET /section-types (get available section types)
 */

/**
 * @swagger
 * tags:
 *   - name: Tenant Theme
 *     description: Branding assets & colors per tenant
 */

/**
 * @swagger
 * /tenant-theme/{tenantId}:
 *   get:
 *     summary: Get tenant theme (demo)
 *     tags: [Tenant Theme]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Theme or null }
 */
router.get('/:tenantId', async (req, res) => {
  const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId: req.params.tenantId } });
  res.json(theme || null);
});

function isPlainObject(value: any) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStyleKey(styleRaw: string) {
  const style = String(styleRaw || '').trim();
  if (!style) return null;
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(style)) return null;
  return style;
}

function buildDefaultHomepageConfigForStyle(style: string) {
  // Keep this aligned with `/public/homepage?v=1` style1 defaults.
  if (style === 'style1') {
    return {
      heroCount: 1,
      topStoriesCount: 5,
      // `key` values here map to Style1 section ids.
      // The public homepage handler applies overrides by matching `key` -> `section.id`.
      sections: [
        { key: 'flashTicker', label: 'Flash News', limit: 12 },
        { key: 'heroStack', label: 'Top Stories' },
        // Style1 category blocks: by default, the public API will pick categories from domain navigation.
        // Admins can override by providing `categorySlugs: string[]` via PATCH /homepage/style1/sections.
        { key: 'categoryHub', label: 'Categories', limit: 5 },
        { key: 'hgBlock', label: 'Highlights', limit: 5 },
        { key: 'lastNews', label: 'Last News', categorySlug: 'politics', limit: 8 },
        { key: 'trendingCategory', label: 'Trending News', categorySlug: 'sports', limit: 6 },
        { key: 'rightRailTrendingTitles', label: 'Trending News', limit: 8 }
      ]
    };
  }
  if (style === 'style2') {
    // Style2 is the "legacy" /public/homepage shape with category-linked sections.
    // Admins can link each section to a categorySlug and control per-section limits.
    return {
      heroCount: 1,
      topStoriesCount: 5,
      sections: [],
      // Style2 v2: richer homepage composition contract (opt-in via /public/homepage?shape=style2&v=2)
      // Stored under homepageConfig.style2.v2
      v2: {
        // `key` values map to v2 section ids.
        sections: [
          { key: 'flashTicker', label: 'Flash News', limit: 10 },
          {
            key: 'toiGrid3',
            label: 'Top Stories',
            // Left rail category (optional). If unset, backend will pick from tenant navigation.
            leftCategorySlug: null,
            // Center always latest.
            centerLimit: 6,
            // Right rail blocks (latest slices). This is not true "most read".
            rightLatestLimit: 8,
            rightMostReadLimit: 8,
            rightLatestLabel: 'Latest News',
            rightMostReadLabel: 'Most Read'
          },
          { key: 'topStoriesGrid', label: 'Top Stories', limit: 9 },
          {
            key: 'section3',
            label: 'More News',
            // 3 category columns.
            categorySlugs: ['technology', 'education', 'also-in-news'],
            perCategoryLimit: 5
          },
          {
            key: 'section4',
            label: 'Categories',
            rows: 3,
            cols: 3,
            perCategoryLimit: 5
          }
        ]
      }
    };
  }
  return { heroCount: 1, topStoriesCount: 5, sections: [] };
}

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/{style}:
 *   get:
 *     summary: Get tenant homepage config for a style (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: |
 *       Returns TenantTheme.homepageConfig[style] (or null if unset).
 *
 *       Style2 note: style=style2 powers /public/homepage?shape=style2 section composition.
 *     tags: [Tenant Theme]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: style
 *         required: true
 *         schema: { type: string, example: "style1" }
 *     responses:
 *       200: { description: Style homepage config or null }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  '/:tenantId/homepage/:style',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const style = normalizeStyleKey(req.params.style);
    if (!style) return res.status(400).json({ error: 'Invalid style' });
    const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
    const homepageConfig = (theme as any)?.homepageConfig;
    const styleConfig = isPlainObject(homepageConfig) ? (homepageConfig as any)[style] : null;
    return res.json(styleConfig || null);
  }
);

/* REMOVED: Old Style2 v2 endpoints - replaced by new unified Style2 config API */
/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/{style}/default:
 *   get:
 *     summary: Get default homepage config for a style (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: Returns a server-defined default config for the requested style.
 *     tags: [Tenant Theme]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: style
 *         required: true
 *         schema: { type: string, example: "style1" }
 *     responses:
 *       200: { description: Default style config }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  '/:tenantId/homepage/:style/default',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const style = normalizeStyleKey(req.params.style);
    if (!style) return res.status(400).json({ error: 'Invalid style' });
    return res.json(buildDefaultHomepageConfigForStyle(style));
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/{style}/apply-default:
 *   post:
 *     summary: Apply default homepage config for a style to a tenant (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: |
 *       Overwrites TenantTheme.homepageConfig[style] with the server default for that style.
 *       
 *       **DEPRECATED for Style2**: Use `/style2/config/{tenantId}/apply-default` instead for new Style2 configurations.
 *       This endpoint remains available for backward compatibility and Style1 usage only.
 *
 *       Style2 note: For new Style2 configurations, use the dedicated Style2 config API endpoints.
 *     tags: [Tenant Theme]
 *     deprecated: false
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: style
 *         required: true
 *         schema: { type: string, example: "style1", enum: ["style1"] }
 *         description: "Currently only 'style1' is supported. For Style2, use the dedicated Style2 config API."
 *     responses:
 *       200: { description: Updated tenant theme }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.post(
  '/:tenantId/homepage/:style/apply-default',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const style = normalizeStyleKey(req.params.style);
    if (!style) return res.status(400).json({ error: 'Invalid style' });

    const existingTheme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
    const existingHomepageConfig = isPlainObject((existingTheme as any)?.homepageConfig)
      ? { ...(existingTheme as any).homepageConfig }
      : {};
    (existingHomepageConfig as any)[style] = buildDefaultHomepageConfigForStyle(style);

    const saved = existingTheme
      ? await (prisma as any).tenantTheme.update({ where: { tenantId }, data: { homepageConfig: existingHomepageConfig } })
      : await (prisma as any).tenantTheme.create({ data: { tenantId, homepageConfig: existingHomepageConfig } });
    return res.json(saved);
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/{style}/sections:
 *   patch:
 *     summary: Update homepage section labels + category links (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: |
 *       Partial merge by section `key`. Updates only provided fields; creates missing section keys.
 *       
 *       **DEPRECATED for Style2**: Use `/style2/config/{tenantId}/sections` instead for new Style2 configurations.
 *       This endpoint remains available for backward compatibility and Style1 usage only.
 *     tags: [Tenant Theme]
 *     deprecated: false
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: style
 *         required: true
 *         schema: { type: string, example: "style1", enum: ["style1"] }
 *         description: "Currently only 'style1' is supported. For Style2, use the dedicated Style2 config API."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sections]
 *             properties:
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [key]
 *                   properties:
 *                     key: { type: string, example: "politics" }
 *                     title: { type: string, example: "Politics" }
 *                     label: { type: string, example: "Politics" }
 *                     categorySlug: { type: string, example: "politics" }
 *                     categorySlugs:
 *                       type: array
 *                       items: { type: string }
 *                       example: ["national","international","environment","technology"]
 *                     limit: { type: number, example: 6 }
 *                     position: { type: number, example: 10 }
 *                     style: { type: string, example: "grid" }
 *           examples:
 *             updateTwoSections:
 *               value:
 *                 sections:
 *                   - key: politics
 *                     title: "Politics News"
 *                     categorySlug: politics
 *                     limit: 9
 *                   - key: sports
 *                     title: "Sports"
 *                     categorySlug: sports
 *                     limit: 6
 *             style1CategoryHub:
 *               summary: Style1 categoryHub + HG block (drives /public/homepage?v=1)
 *               value:
 *                 sections:
 *                   - key: categoryHub
 *                     label: "Categories"
 *                     categorySlugs: ["national","international","environment","technology"]
 *                     limit: 5
 *                   - key: hgBlock
 *                     label: "Highlights"
 *                     categorySlugs: ["national","international"]
 *                     limit: 5
 *     responses:
 *       200: { description: Updated tenant theme }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.patch(
  '/:tenantId/homepage/:style/sections',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const style = normalizeStyleKey(req.params.style);
    if (!style) return res.status(400).json({ error: 'Invalid style' });

    const sections = (req.body || {}).sections;
    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ error: 'sections[] required' });
    }

    const cleaned = sections
      .map((s: any) => {
        const key = String(s?.key || '').trim();
        if (!key) return null;
        const patch: any = { key };
        if (Object.prototype.hasOwnProperty.call(s, 'title')) patch.title = s.title;
        if (Object.prototype.hasOwnProperty.call(s, 'label')) patch.label = s.label;
        if (Object.prototype.hasOwnProperty.call(s, 'categorySlug')) patch.categorySlug = s.categorySlug;
        if (Object.prototype.hasOwnProperty.call(s, 'categorySlugs')) patch.categorySlugs = s.categorySlugs;
        if (Object.prototype.hasOwnProperty.call(s, 'limit')) patch.limit = s.limit;
        if (Object.prototype.hasOwnProperty.call(s, 'position')) patch.position = s.position;
        if (Object.prototype.hasOwnProperty.call(s, 'style')) patch.style = s.style;
        return patch;
      })
      .filter(Boolean);

    if (cleaned.length === 0) return res.status(400).json({ error: 'No valid sections provided' });

    const existingTheme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
    const existingHomepageConfig = isPlainObject((existingTheme as any)?.homepageConfig)
      ? { ...(existingTheme as any).homepageConfig }
      : {};
    const styleConfig = isPlainObject((existingHomepageConfig as any)[style])
      ? { ...(existingHomepageConfig as any)[style] }
      : {};
    const existingSections = Array.isArray((styleConfig as any).sections) ? [...(styleConfig as any).sections] : [];

    const byKey = new Map<string, any>();
    for (const s of existingSections) {
      const k = String(s?.key || '').trim();
      if (k) byKey.set(k, { ...s, key: k });
    }
    for (const patch of cleaned) {
      const prev = byKey.get(patch.key) || { key: patch.key };
      byKey.set(patch.key, { ...prev, ...patch });
    }

    (styleConfig as any).sections = Array.from(byKey.values());
    (existingHomepageConfig as any)[style] = styleConfig;

    const saved = existingTheme
      ? await (prisma as any).tenantTheme.update({ where: { tenantId }, data: { homepageConfig: existingHomepageConfig } })
      : await (prisma as any).tenantTheme.create({ data: { tenantId, homepageConfig: existingHomepageConfig } });

    return res.json(saved);
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}:
 *   patch:
 *     summary: Update tenant theme + homepageConfig (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: Updates TenantTheme row. Backward-compatible; only provided fields are updated.
 *     tags: [Tenant Theme]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             sample:
 *               value:
 *                 primaryColor: "#0D47A1"
 *                 homepageConfig:
 *                   style1:
 *                     heroCount: 1
 *                     topStoriesCount: 5
 *                     sections:
 *                       - key: politics
 *                         title: Politics
 *                         position: 10
 *                         style: grid
 *                         categorySlug: politics
 *                         limit: 6
 *     responses:
 *       200: { description: Updated tenant theme }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.patch(
  '/:tenantId',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const payload = req.body || {};

    const data: any = {};
    if (Object.prototype.hasOwnProperty.call(payload, 'logoUrl')) data.logoUrl = payload.logoUrl;
    if (Object.prototype.hasOwnProperty.call(payload, 'faviconUrl')) data.faviconUrl = payload.faviconUrl;
    if (Object.prototype.hasOwnProperty.call(payload, 'primaryColor')) data.primaryColor = payload.primaryColor;
    if (Object.prototype.hasOwnProperty.call(payload, 'secondaryColor')) data.secondaryColor = payload.secondaryColor;
    if (Object.prototype.hasOwnProperty.call(payload, 'headerBgColor')) data.headerBgColor = payload.headerBgColor;
    if (Object.prototype.hasOwnProperty.call(payload, 'footerBgColor')) data.footerBgColor = payload.footerBgColor;
    if (Object.prototype.hasOwnProperty.call(payload, 'headerHtml')) data.headerHtml = payload.headerHtml;
    if (Object.prototype.hasOwnProperty.call(payload, 'footerHtml')) data.footerHtml = payload.footerHtml;
    if (Object.prototype.hasOwnProperty.call(payload, 'fontFamily')) data.fontFamily = payload.fontFamily;
    if (Object.prototype.hasOwnProperty.call(payload, 'homepageConfig')) data.homepageConfig = payload.homepageConfig;

    const existing = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
    const saved = existing
      ? await (prisma as any).tenantTheme.update({ where: { tenantId }, data })
      : await (prisma as any).tenantTheme.create({ data: { tenantId, ...data } });
    return res.json(saved);
  }
);

// ==================== SEO ENDPOINTS ====================

const DEFAULT_SEO_CONFIG = {
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  twitterCard: 'summary_large_image',
  twitterHandle: '',
  googleAnalyticsId: '',
  facebookPixelId: '',
  robotsTxt: 'User-agent: *\nAllow: /',
  sitemapEnabled: true,
};

/**
 * @swagger
 * /tenant-theme/{tenantId}/seo:
 *   get:
 *     summary: Get tenant SEO configuration
 *     tags: [Tenant Theme, SEO]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: SEO configuration
 */
router.get(
  '/:tenantId/seo',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
      const seoConfig = isPlainObject((theme as any)?.seoConfig) ? (theme as any).seoConfig : {};
      // Merge with defaults
      const merged = { ...DEFAULT_SEO_CONFIG, ...seoConfig };
      return res.json(merged);
    } catch (e: any) {
      console.error('get tenant seo error', e);
      return res.status(500).json({ error: 'Failed to get SEO config' });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/seo:
 *   patch:
 *     summary: Update tenant SEO configuration
 *     tags: [Tenant Theme, SEO]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metaTitle: { type: string }
 *               metaDescription: { type: string }
 *               metaKeywords: { type: string }
 *               ogTitle: { type: string }
 *               ogDescription: { type: string }
 *               ogImage: { type: string }
 *               twitterCard: { type: string }
 *               twitterHandle: { type: string }
 *               googleAnalyticsId: { type: string }
 *               facebookPixelId: { type: string }
 *               robotsTxt: { type: string }
 *               sitemapEnabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated SEO configuration
 */
router.patch(
  '/:tenantId/seo',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const body = req.body || {};

      // Get existing theme and seoConfig
      const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
      const existingSeoConfig = isPlainObject((theme as any)?.seoConfig) ? { ...(theme as any).seoConfig } : {};

      // Build updated seoConfig (merge incoming with existing)
      const stringFields = [
        'metaTitle', 'metaDescription', 'metaKeywords',
        'ogTitle', 'ogDescription', 'ogImage',
        'twitterCard', 'twitterHandle',
        'googleAnalyticsId', 'facebookPixelId', 'robotsTxt'
      ];
      for (const field of stringFields) {
        if (typeof body[field] === 'string') {
          existingSeoConfig[field] = body[field];
        }
      }
      if (typeof body.sitemapEnabled === 'boolean') {
        existingSeoConfig.sitemapEnabled = body.sitemapEnabled;
      }

      const saved = theme
        ? await (prisma as any).tenantTheme.update({
            where: { tenantId },
            data: { seoConfig: existingSeoConfig }
          })
        : await (prisma as any).tenantTheme.create({
            data: { tenantId, seoConfig: existingSeoConfig }
          });

      const merged = { ...DEFAULT_SEO_CONFIG, ...(saved.seoConfig || {}) };
      return res.json(merged);
    } catch (e: any) {
      console.error('patch tenant seo error', e);
      return res.status(500).json({ error: 'Failed to update SEO config' });
    }
  }
);

// Mount Style2 configuration routes
router.use('/', style2ConfigRoutes);

export default router;
