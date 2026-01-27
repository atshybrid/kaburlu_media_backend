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

// ==================== SMART STYLE1 HOMEPAGE MANAGEMENT ====================

/**
 * Style1 Homepage - Complete Section Structure
 * =============================================
 * 
 * SECTIONS:
 * 1. flashTicker      - 12 articles (auto-filled latest)
 * 2. heroSection      - 26 articles (4 columns: 6+8+8+4)
 * 3. heroAd1          - Ad after hero (728x90 / 970x250)
 * 4. categorySection  - 20 articles (4 categories × 5)
 * 5. categoryAd1      - Ad after categories (728x90 / 970x250)
 * 6. webStories       - 10 stories (optional, isActive: false)
 * 
 * TOTAL: 58 articles
 * 
 * HERO SECTION COLUMNS:
 * - col-1: Latest Hero (6 articles: 1 hero + 2 medium + 3 small)
 * - col-2: Latest List (8 articles: continues from latest)
 * - col-3: Must Read (8 articles: label "Must Read")
 * - col-4: Top Articles (4 articles: label "Top Articles")
 */

// Default Style1 layout structure
function getDefaultStyle1Layout() {
  return {
    themeKey: 'style1',
    sections: [
      {
        id: 'section-1',
        key: 'flashTicker',
        name: 'Flash News Ticker',
        isActive: true,
        position: 1,
        config: {
          articlesLimit: 12,
          autoScroll: true,
          scrollSpeed: 5000
        }
      },
      {
        id: 'section-2',
        key: 'heroSection',
        name: 'Hero Grid',
        isActive: true,
        position: 2,
        layout: {
          type: 'grid',
          columns: [
            { key: 'col-1', position: 1, name: 'Latest Hero', articlesLimit: 6 },
            { key: 'col-2', position: 2, name: 'Latest List', articlesLimit: 8 },
            { key: 'col-3', position: 3, name: 'Must Read', articlesLimit: 8, label: 'Must Read' },
            { key: 'col-4', position: 4, name: 'Top Articles', articlesLimit: 4, label: 'Top Articles' }
          ]
        },
        blocks: [
          { id: 'block-1', type: 'heroLead', columnKey: 'col-1', isActive: true, position: 1 },
          { id: 'block-2', type: 'mediumCards', columnKey: 'col-1', isActive: true, position: 2 },
          { id: 'block-3', type: 'smallList', columnKey: 'col-1', isActive: true, position: 3 },
          { id: 'block-4', type: 'smallList', columnKey: 'col-2', isActive: true, position: 1 },
          { id: 'block-5', type: 'smallList', columnKey: 'col-3', isActive: true, position: 1 },
          { id: 'block-6', type: 'smallList', columnKey: 'col-4', isActive: true, position: 1 }
        ]
      },
      {
        id: 'section-3',
        key: 'heroAd1',
        name: 'Ad After Hero',
        isActive: true,
        position: 3,
        type: 'ad',
        config: {
          adType: 'horizontal',
          sizes: ['728x90', '970x250'],
          slot: 'homepage-after-hero',
          provider: 'google',
          google: { slot: null, format: 'auto', responsive: true },
          local: { enabled: false, imageUrl: null, clickUrl: null, alt: null }
        }
      },
      {
        id: 'section-4',
        key: 'categorySection',
        name: '4-Column Categories',
        isActive: true,
        position: 4,
        config: {
          categoriesCount: 4,
          articlesPerCategory: 5,
          categories: ['national', 'entertainment', 'politics', 'sports']
        }
      },
      {
        id: 'section-5',
        key: 'categoryAd1',
        name: 'Ad After Categories',
        isActive: true,
        position: 5,
        type: 'ad',
        config: {
          adType: 'horizontal',
          sizes: ['728x90', '970x250'],
          slot: 'homepage-after-categories',
          provider: 'google',
          google: { slot: null, format: 'auto', responsive: true },
          local: { enabled: false, imageUrl: null, clickUrl: null, alt: null }
        }
      },
      {
        id: 'section-6',
        key: 'webStories',
        name: 'Web Stories',
        isActive: false,
        position: 6,
        config: {
          storiesLimit: 10
        }
      }
    ]
  };
}

// Ad sizes reference
const STYLE1_AD_SIZES = {
  horizontal: { desktop: '970x250', mobile: '728x90' },
  sidebar: { desktop: '300x600', mobile: 'hidden' },
  inArticle: { desktop: '728x90', mobile: '320x100' }
};

/**
 * @swagger
 * tags:
 *   - name: Smart Theme Management
 *     description: |
 *       Style1 homepage configuration with sections, categories, and ads.
 *       
 *       ## Summary
 *       | Component | Count | Articles |
 *       |-----------|-------|----------|
 *       | Flash Ticker | 1 | 12 |
 *       | Hero Section | 4 columns | 26 (6+8+8+4) |
 *       | Category Section | 4 categories | 20 (5×4) |
 *       | Ads | 2 horizontal | - |
 *       | **TOTAL** | - | **58 articles** |
 */

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style1/smart:
 *   get:
 *     summary: Get Style1 homepage layout configuration
 *     description: |
 *       Returns the complete Style1 homepage layout with sections, ads, and category config.
 *       
 *       ## Sections Summary
 *       | # | Section | Articles | Description |
 *       |---|---------|----------|-------------|
 *       | 1 | flashTicker | 12 | Breaking news ticker |
 *       | 2 | heroSection | 26 | 4-column hero grid |
 *       | 3 | heroAd1 | - | Horizontal ad (728×90/970×250) |
 *       | 4 | categorySection | 20 | 4 categories × 5 articles |
 *       | 5 | categoryAd1 | - | Horizontal ad (728×90/970×250) |
 *       | 6 | webStories | 10 | Web stories (optional) |
 *       
 *       ## Hero Section Columns (26 articles)
 *       | Column | Name | Articles | Layout |
 *       |--------|------|----------|--------|
 *       | col-1 | Latest Hero | 6 | 1 hero + 2 medium + 3 small |
 *       | col-2 | Latest List | 8 | Vertical list |
 *       | col-3 | Must Read | 8 | Labeled section |
 *       | col-4 | Top Articles | 4 | Compact list |
 *     tags: [Smart Theme Management]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         example: cmk7e7tg401ezlp22wkz5rxky
 *     responses:
 *       200:
 *         description: Style1 layout configuration
 *         content:
 *           application/json:
 *             example:
 *               layout:
 *                 themeKey: style1
 *                 sections:
 *                   - id: section-1
 *                     key: flashTicker
 *                     name: Flash News Ticker
 *                     isActive: true
 *                     position: 1
 *                     config:
 *                       articlesLimit: 12
 *                       autoScroll: true
 *                       scrollSpeed: 5000
 *                   - id: section-2
 *                     key: heroSection
 *                     name: Hero Grid
 *                     isActive: true
 *                     position: 2
 *                     layout:
 *                       type: grid
 *                       columns:
 *                         - key: col-1
 *                           position: 1
 *                           name: Latest Hero
 *                           articlesLimit: 6
 *                         - key: col-2
 *                           position: 2
 *                           name: Latest List
 *                           articlesLimit: 8
 *                         - key: col-3
 *                           position: 3
 *                           name: Must Read
 *                           articlesLimit: 8
 *                           label: Must Read
 *                         - key: col-4
 *                           position: 4
 *                           name: Top Articles
 *                           articlesLimit: 4
 *                           label: Top Articles
 *                   - id: section-3
 *                     key: heroAd1
 *                     name: Ad After Hero
 *                     isActive: true
 *                     position: 3
 *                     type: ad
 *                     config:
 *                       adType: horizontal
 *                       sizes: ["728x90", "970x250"]
 *                       provider: google
 *                       google:
 *                         slot: null
 *                         format: auto
 *                         responsive: true
 *                       local:
 *                         enabled: false
 *                         imageUrl: null
 *                         clickUrl: null
 *                   - id: section-4
 *                     key: categorySection
 *                     name: 4-Column Categories
 *                     isActive: true
 *                     position: 4
 *                     config:
 *                       categoriesCount: 4
 *                       articlesPerCategory: 5
 *                       categories: ["national", "entertainment", "politics", "sports"]
 *                   - id: section-5
 *                     key: categoryAd1
 *                     name: Ad After Categories
 *                     isActive: true
 *                     position: 5
 *                     type: ad
 *                     config:
 *                       adType: horizontal
 *                       sizes: ["728x90", "970x250"]
 *                       provider: google
 *                   - id: section-6
 *                     key: webStories
 *                     name: Web Stories
 *                     isActive: false
 *                     position: 6
 *                     config:
 *                       storiesLimit: 10
 *               summary:
 *                 totalArticles: 58
 *                 sections: 6
 *                 ads: 2
 *                 breakdown:
 *                   flashTicker: 12
 *                   heroSection: 26
 *                   categorySection: 20
 *               adSizes:
 *                 horizontal:
 *                   desktop: "970x250"
 *                   mobile: "728x90"
 *                 sidebar:
 *                   desktop: "300x600"
 *                   mobile: hidden
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  '/:tenantId/homepage/style1/smart',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
      const homepageConfig = isPlainObject((theme as any)?.homepageConfig) ? (theme as any).homepageConfig : {};
      
      // Get stored style1 config or use defaults
      const storedStyle1 = isPlainObject(homepageConfig.style1Layout) ? homepageConfig.style1Layout : null;
      const layout = storedStyle1 || getDefaultStyle1Layout();

      return res.json({
        layout,
        summary: {
          totalArticles: 58,
          sections: 6,
          ads: 2,
          breakdown: {
            flashTicker: 12,
            heroSection: 26,
            categorySection: 20
          }
        },
        adSizes: STYLE1_AD_SIZES
      });
    } catch (e: any) {
      console.error('get style1 layout error', e);
      return res.status(500).json({ error: 'Failed to get style1 layout' });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style1/smart:
 *   put:
 *     summary: Update Style1 homepage layout
 *     description: |
 *       Update Style1 homepage sections configuration.
 *       
 *       ## Updatable Sections
 *       | Section | Updatable Fields |
 *       |---------|------------------|
 *       | flashTicker | isActive, autoScroll, scrollSpeed |
 *       | heroSection | isActive |
 *       | heroAd1 | isActive, provider, google, local |
 *       | categorySection | isActive, categories (exactly 4) |
 *       | categoryAd1 | isActive, provider, google, local |
 *       | webStories | isActive, storiesLimit |
 *       
 *       ## Category Section Rules
 *       - Exactly 4 category slugs required
 *       - 5 articles displayed per category = 20 total
 *       - Use Telugu slugs like: జాతీయం, వినోదం, రాజకీయాలు, క్రీడలు
 *     tags: [Smart Theme Management]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         example: cmk7e7tg401ezlp22wkz5rxky
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
 *                 description: Array of section updates (only include sections you want to modify)
 *                 items:
 *                   type: object
 *                   required: [key]
 *                   properties:
 *                     key:
 *                       type: string
 *                       enum: [flashTicker, heroSection, heroAd1, categorySection, categoryAd1, webStories]
 *                     isActive:
 *                       type: boolean
 *                     config:
 *                       type: object
 *           examples:
 *             updateCategories:
 *               summary: Update category section (Telugu slugs)
 *               value:
 *                 sections:
 *                   - key: categorySection
 *                     isActive: true
 *                     config:
 *                       categories: ["జాతీయం", "వినోదం", "రాజకీయాలు", "క్రీడలు"]
 *             updateCategoriesEnglish:
 *               summary: Update category section (English slugs)
 *               value:
 *                 sections:
 *                   - key: categorySection
 *                     isActive: true
 *                     config:
 *                       categories: ["national", "entertainment", "politics", "sports"]
 *             setupGoogleAds:
 *               summary: Setup Google AdSense for both ad slots
 *               value:
 *                 sections:
 *                   - key: heroAd1
 *                     isActive: true
 *                     config:
 *                       provider: google
 *                       google:
 *                         slot: "ca-pub-1234567890/heroAd1"
 *                         format: auto
 *                         responsive: true
 *                   - key: categoryAd1
 *                     isActive: true
 *                     config:
 *                       provider: google
 *                       google:
 *                         slot: "ca-pub-1234567890/categoryAd1"
 *             setupLocalAd:
 *               summary: Setup local banner ad with schedule
 *               value:
 *                 sections:
 *                   - key: heroAd1
 *                     isActive: true
 *                     config:
 *                       provider: local
 *                       local:
 *                         enabled: true
 *                         imageUrl: "https://cdn.example.com/ads/diwali-sale-970x250.jpg"
 *                         clickUrl: "https://advertiser.com/diwali-offer"
 *                         alt: "Diwali Sale - 50% Off"
 *                         schedule:
 *                           startDate: "2026-01-25"
 *                           endDate: "2026-02-15"
 *             disableWebStories:
 *               summary: Disable web stories section
 *               value:
 *                 sections:
 *                   - key: webStories
 *                     isActive: false
 *             disableAds:
 *               summary: Disable all ads
 *               value:
 *                 sections:
 *                   - key: heroAd1
 *                     isActive: false
 *                   - key: categoryAd1
 *                     isActive: false
 *             completeSetup:
 *               summary: Complete homepage setup (categories + ads)
 *               value:
 *                 sections:
 *                   - key: categorySection
 *                     isActive: true
 *                     config:
 *                       categories: ["జాతీయం", "వినోదం", "రాజకీయాలు", "క్రీడలు"]
 *                   - key: heroAd1
 *                     isActive: true
 *                     config:
 *                       provider: google
 *                       google:
 *                         slot: "1234567890"
 *                   - key: categoryAd1
 *                     isActive: true
 *                     config:
 *                       provider: google
 *                       google:
 *                         slot: "0987654321"
 *                   - key: webStories
 *                     isActive: false
 *     responses:
 *       200:
 *         description: Updated layout configuration
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               layout:
 *                 themeKey: style1
 *                 sections: "... (full sections array)"
 *               summary:
 *                 totalArticles: 58
 *                 sections: 6
 *                 ads: 2
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             examples:
 *               categoryError:
 *                 value:
 *                   error: Validation failed
 *                   details: ["categorySection requires exactly 4 categories"]
 *               invalidSection:
 *                 value:
 *                   error: Validation failed
 *                   details: ["Invalid section key: invalidKey"]
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.put(
  '/:tenantId/homepage/style1/smart',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const body = req.body || {};
      const errors: string[] = [];

      if (!Array.isArray(body.sections)) {
        return res.status(400).json({ error: 'sections array required' });
      }

      // Get existing theme and layout
      const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
      const existingHomepageConfig = isPlainObject((theme as any)?.homepageConfig)
        ? { ...(theme as any).homepageConfig }
        : {};
      
      // Get current layout or create default
      let currentLayout = isPlainObject(existingHomepageConfig.style1Layout)
        ? JSON.parse(JSON.stringify(existingHomepageConfig.style1Layout))
        : getDefaultStyle1Layout();

      // Valid section keys
      const validKeys = ['flashTicker', 'heroSection', 'heroAd1', 'categorySection', 'categoryAd1', 'webStories'];

      // Process each section update
      for (const update of body.sections) {
        if (!update.key || !validKeys.includes(update.key)) {
          errors.push(`Invalid section key: ${update.key}`);
          continue;
        }

        // Find section in current layout
        const sectionIndex = currentLayout.sections.findIndex((s: any) => s.key === update.key);
        if (sectionIndex === -1) continue;

        const section = currentLayout.sections[sectionIndex];

        // Update isActive
        if (typeof update.isActive === 'boolean') {
          section.isActive = update.isActive;
        }

        // Update config
        if (isPlainObject(update.config)) {
          section.config = section.config || {};

          // Category section validation
          if (update.key === 'categorySection' && Array.isArray(update.config.categories)) {
            if (update.config.categories.length !== 4) {
              errors.push('categorySection requires exactly 4 categories');
            } else {
              section.config.categories = update.config.categories.map((c: any) => String(c).trim());
            }
          }

          // Ad section config
          if (update.key === 'heroAd1' || update.key === 'categoryAd1') {
            if (update.config.provider === 'google' || update.config.provider === 'local') {
              section.config.provider = update.config.provider;
            }
            if (isPlainObject(update.config.google)) {
              section.config.google = { ...section.config.google, ...update.config.google };
            }
            if (isPlainObject(update.config.local)) {
              section.config.local = { ...section.config.local, ...update.config.local };
            }
          }

          // Flash ticker config
          if (update.key === 'flashTicker') {
            if (typeof update.config.autoScroll === 'boolean') {
              section.config.autoScroll = update.config.autoScroll;
            }
            if (typeof update.config.scrollSpeed === 'number') {
              section.config.scrollSpeed = update.config.scrollSpeed;
            }
          }

          // Web stories config
          if (update.key === 'webStories') {
            if (typeof update.config.storiesLimit === 'number') {
              section.config.storiesLimit = update.config.storiesLimit;
            }
          }
        }

        currentLayout.sections[sectionIndex] = section;
      }

      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      // Save updated layout
      existingHomepageConfig.style1Layout = currentLayout;

      const saved = theme
        ? await (prisma as any).tenantTheme.update({
            where: { tenantId },
            data: { homepageConfig: existingHomepageConfig }
          })
        : await (prisma as any).tenantTheme.create({
            data: { tenantId, homepageConfig: existingHomepageConfig }
          });

      const savedLayout = (saved.homepageConfig as any)?.style1Layout || currentLayout;

      return res.json({
        success: true,
        layout: savedLayout,
        summary: {
          totalArticles: 58,
          sections: 6,
          ads: 2
        }
      });
    } catch (e: any) {
      console.error('update style1 layout error', e);
      return res.status(500).json({ error: 'Failed to update style1 layout' });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style1/smart/reset:
 *   post:
 *     summary: Reset Style1 layout to defaults
 *     description: |
 *       Resets the Style1 homepage layout to the default configuration.
 *       
 *       **Default values after reset:**
 *       - flashTicker: 12 articles, autoScroll enabled
 *       - heroSection: 26 articles (6+8+8+4)
 *       - categorySection: 4 default categories (national, entertainment, politics, sports)
 *       - Both ads: enabled with Google provider
 *       - webStories: disabled
 *     tags: [Smart Theme Management]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         example: cmk7e7tg401ezlp22wkz5rxky
 *     responses:
 *       200:
 *         description: Layout reset to defaults
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Layout reset to defaults
 *               layout:
 *                 themeKey: style1
 *                 sections: "... (default sections array)"
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.post(
  '/:tenantId/homepage/style1/smart/reset',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      
      const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
      const existingHomepageConfig = isPlainObject((theme as any)?.homepageConfig)
        ? { ...(theme as any).homepageConfig }
        : {};

      // Reset to default layout
      existingHomepageConfig.style1Layout = getDefaultStyle1Layout();

      const saved = theme
        ? await (prisma as any).tenantTheme.update({
            where: { tenantId },
            data: { homepageConfig: existingHomepageConfig }
          })
        : await (prisma as any).tenantTheme.create({
            data: { tenantId, homepageConfig: existingHomepageConfig }
          });

      return res.json({
        success: true,
        message: 'Layout reset to defaults',
        layout: (saved.homepageConfig as any)?.style1Layout
      });
    } catch (e: any) {
      console.error('reset style1 layout error', e);
      return res.status(500).json({ error: 'Failed to reset style1 layout' });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style1/smart/ads:
 *   get:
 *     summary: Get Style1 ads configuration
 *     description: |
 *       Returns ads configuration for Style1 homepage.
 *       
 *       ## Ad Slots
 *       | Slot | Position | Sizes |
 *       |------|----------|-------|
 *       | heroAd1 | After hero section | 728×90 / 970×250 |
 *       | categoryAd1 | After category section | 728×90 / 970×250 |
 *       
 *       ## Providers
 *       | Provider | Description |
 *       |----------|-------------|
 *       | google | Google AdSense (requires slot ID) |
 *       | local | Custom banner (imageUrl, clickUrl, schedule) |
 *     tags: [Smart Theme Management]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         example: cmk7e7tg401ezlp22wkz5rxky
 *     responses:
 *       200:
 *         description: Ads configuration
 *         content:
 *           application/json:
 *             examples:
 *               googleAds:
 *                 summary: Google AdSense configured
 *                 value:
 *                   ads:
 *                     heroAd1:
 *                       isActive: true
 *                       provider: google
 *                       sizes: ["728x90", "970x250"]
 *                       google:
 *                         slot: "ca-pub-1234567890/heroAd1"
 *                         format: auto
 *                         responsive: true
 *                       local: null
 *                     categoryAd1:
 *                       isActive: true
 *                       provider: google
 *                       sizes: ["728x90", "970x250"]
 *                       google:
 *                         slot: "ca-pub-1234567890/categoryAd1"
 *                       local: null
 *                   adSizes:
 *                     horizontal:
 *                       desktop: "970x250"
 *                       mobile: "728x90"
 *                     sidebar:
 *                       desktop: "300x600"
 *                       mobile: hidden
 *               localAd:
 *                 summary: Local banner with schedule
 *                 value:
 *                   ads:
 *                     heroAd1:
 *                       isActive: true
 *                       provider: local
 *                       sizes: ["728x90", "970x250"]
 *                       google: null
 *                       local:
 *                         enabled: true
 *                         imageUrl: "https://cdn.example.com/ads/festival-banner.jpg"
 *                         clickUrl: "https://advertiser.com/offer"
 *                         alt: "Festival Sale - 50% Off"
 *                         schedule:
 *                           startDate: "2026-01-25"
 *                           endDate: "2026-02-15"
 *                     categoryAd1:
 *                       isActive: false
 *                       provider: google
 *                       sizes: ["728x90", "970x250"]
 *                       google: null
 *                       local: null
 *                   adSizes:
 *                     horizontal:
 *                       desktop: "970x250"
 *                       mobile: "728x90"
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  '/:tenantId/homepage/style1/smart/ads',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
      const homepageConfig = isPlainObject((theme as any)?.homepageConfig) ? (theme as any).homepageConfig : {};
      const layout = isPlainObject(homepageConfig.style1Layout) ? homepageConfig.style1Layout : getDefaultStyle1Layout();

      // Extract ad sections
      const heroAd1 = layout.sections?.find((s: any) => s.key === 'heroAd1') || {};
      const categoryAd1 = layout.sections?.find((s: any) => s.key === 'categoryAd1') || {};

      return res.json({
        ads: {
          heroAd1: {
            isActive: heroAd1.isActive !== false,
            provider: heroAd1.config?.provider || 'google',
            sizes: heroAd1.config?.sizes || ['728x90', '970x250'],
            google: heroAd1.config?.google || null,
            local: heroAd1.config?.local || null
          },
          categoryAd1: {
            isActive: categoryAd1.isActive !== false,
            provider: categoryAd1.config?.provider || 'google',
            sizes: categoryAd1.config?.sizes || ['728x90', '970x250'],
            google: categoryAd1.config?.google || null,
            local: categoryAd1.config?.local || null
          }
        },
        adSizes: STYLE1_AD_SIZES
      });
    } catch (e: any) {
      console.error('get style1 ads error', e);
      return res.status(500).json({ error: 'Failed to get ads config' });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style1/smart/ads:
 *   put:
 *     summary: Update Style1 ads configuration
 *     description: |
 *       Update ads for heroAd1 and/or categoryAd1.
 *       
 *       ## Providers
 *       | Provider | Fields Required |
 *       |----------|-----------------|
 *       | google | slot (AdSense slot ID) |
 *       | local | imageUrl, clickUrl, alt, schedule (optional) |
 *       
 *       ## Local Ad Schedule
 *       Use schedule for time-limited campaigns (festivals, promotions).
 *       When schedule expires, ad automatically deactivates.
 *     tags: [Smart Theme Management]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         example: cmk7e7tg401ezlp22wkz5rxky
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               heroAd1:
 *                 type: object
 *                 properties:
 *                   isActive: { type: boolean }
 *                   provider: { type: string, enum: [google, local] }
 *                   google:
 *                     type: object
 *                     properties:
 *                       slot: { type: string, description: "AdSense slot ID" }
 *                       format: { type: string, default: "auto" }
 *                       responsive: { type: boolean, default: true }
 *                   local:
 *                     type: object
 *                     properties:
 *                       enabled: { type: boolean }
 *                       imageUrl: { type: string, description: "Banner image (970x250 recommended)" }
 *                       clickUrl: { type: string, description: "Click destination URL" }
 *                       alt: { type: string, description: "Alt text" }
 *                       schedule:
 *                         type: object
 *                         properties:
 *                           startDate: { type: string, format: date }
 *                           endDate: { type: string, format: date }
 *               categoryAd1:
 *                 type: object
 *                 description: Same structure as heroAd1
 *           examples:
 *             setupGoogleAdSense:
 *               summary: Setup Google AdSense for both slots
 *               value:
 *                 heroAd1:
 *                   isActive: true
 *                   provider: google
 *                   google:
 *                     slot: "ca-pub-1234567890/homepage-hero"
 *                     format: auto
 *                     responsive: true
 *                 categoryAd1:
 *                   isActive: true
 *                   provider: google
 *                   google:
 *                     slot: "ca-pub-1234567890/homepage-category"
 *             setupLocalBanner:
 *               summary: Setup local banner ad with schedule
 *               value:
 *                 heroAd1:
 *                   isActive: true
 *                   provider: local
 *                   local:
 *                     enabled: true
 *                     imageUrl: "https://cdn.example.com/ads/diwali-sale-970x250.jpg"
 *                     clickUrl: "https://advertiser.com/diwali-offer"
 *                     alt: "Diwali Sale - 50% Off on Electronics"
 *                     schedule:
 *                       startDate: "2026-10-15"
 *                       endDate: "2026-11-15"
 *             disableHeroAd:
 *               summary: Disable hero ad slot
 *               value:
 *                 heroAd1:
 *                   isActive: false
 *             disableAllAds:
 *               summary: Disable both ad slots
 *               value:
 *                 heroAd1:
 *                   isActive: false
 *                 categoryAd1:
 *                   isActive: false
 *             switchToLocal:
 *               summary: Switch from Google to local ad
 *               value:
 *                 heroAd1:
 *                   provider: local
 *                   local:
 *                     enabled: true
 *                     imageUrl: "https://cdn.example.com/ads/sponsor.jpg"
 *                     clickUrl: "https://sponsor.com"
 *                     alt: "Sponsored by Example Corp"
 *     responses:
 *       200:
 *         description: Updated ads configuration
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               ads:
 *                 heroAd1:
 *                   isActive: true
 *                   provider: google
 *                   google:
 *                     slot: "ca-pub-1234567890/homepage-hero"
 *                     format: auto
 *                     responsive: true
 *                   local: null
 *                 categoryAd1:
 *                   isActive: true
 *                   provider: google
 *                   google:
 *                     slot: "ca-pub-1234567890/homepage-category"
 *                   local: null
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.put(
  '/:tenantId/homepage/style1/smart/ads',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const body = req.body || {};

      // Get existing theme and layout
      const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
      const existingHomepageConfig = isPlainObject((theme as any)?.homepageConfig)
        ? { ...(theme as any).homepageConfig }
        : {};
      
      let currentLayout = isPlainObject(existingHomepageConfig.style1Layout)
        ? JSON.parse(JSON.stringify(existingHomepageConfig.style1Layout))
        : getDefaultStyle1Layout();

      // Update heroAd1
      if (isPlainObject(body.heroAd1)) {
        const idx = currentLayout.sections.findIndex((s: any) => s.key === 'heroAd1');
        if (idx !== -1) {
          const section = currentLayout.sections[idx];
          if (typeof body.heroAd1.isActive === 'boolean') {
            section.isActive = body.heroAd1.isActive;
          }
          section.config = section.config || {};
          if (body.heroAd1.provider === 'google' || body.heroAd1.provider === 'local') {
            section.config.provider = body.heroAd1.provider;
          }
          if (isPlainObject(body.heroAd1.google)) {
            section.config.google = { ...section.config.google, ...body.heroAd1.google };
          }
          if (isPlainObject(body.heroAd1.local)) {
            section.config.local = { ...section.config.local, ...body.heroAd1.local };
          }
          currentLayout.sections[idx] = section;
        }
      }

      // Update categoryAd1
      if (isPlainObject(body.categoryAd1)) {
        const idx = currentLayout.sections.findIndex((s: any) => s.key === 'categoryAd1');
        if (idx !== -1) {
          const section = currentLayout.sections[idx];
          if (typeof body.categoryAd1.isActive === 'boolean') {
            section.isActive = body.categoryAd1.isActive;
          }
          section.config = section.config || {};
          if (body.categoryAd1.provider === 'google' || body.categoryAd1.provider === 'local') {
            section.config.provider = body.categoryAd1.provider;
          }
          if (isPlainObject(body.categoryAd1.google)) {
            section.config.google = { ...section.config.google, ...body.categoryAd1.google };
          }
          if (isPlainObject(body.categoryAd1.local)) {
            section.config.local = { ...section.config.local, ...body.categoryAd1.local };
          }
          currentLayout.sections[idx] = section;
        }
      }

      // Save updated layout
      existingHomepageConfig.style1Layout = currentLayout;

      const saved = theme
        ? await (prisma as any).tenantTheme.update({
            where: { tenantId },
            data: { homepageConfig: existingHomepageConfig }
          })
        : await (prisma as any).tenantTheme.create({
            data: { tenantId, homepageConfig: existingHomepageConfig }
          });

      const savedLayout = (saved.homepageConfig as any)?.style1Layout || currentLayout;
      const heroAd1 = savedLayout.sections?.find((s: any) => s.key === 'heroAd1') || {};
      const categoryAd1 = savedLayout.sections?.find((s: any) => s.key === 'categoryAd1') || {};

      return res.json({
        success: true,
        ads: {
          heroAd1: {
            isActive: heroAd1.isActive !== false,
            provider: heroAd1.config?.provider || 'google',
            google: heroAd1.config?.google || null,
            local: heroAd1.config?.local || null
          },
          categoryAd1: {
            isActive: categoryAd1.isActive !== false,
            provider: categoryAd1.config?.provider || 'google',
            google: categoryAd1.config?.google || null,
            local: categoryAd1.config?.local || null
          }
        }
      });
    } catch (e: any) {
      console.error('update style1 ads error', e);
      return res.status(500).json({ error: 'Failed to update ads config' });
    }
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
