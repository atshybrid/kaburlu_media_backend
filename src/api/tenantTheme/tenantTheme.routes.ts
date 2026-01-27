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
 * Smart Style1 Section Structure (Fixed - cannot be changed by admin)
 * ====================================================================
 * Position 1: flashTicker       - 12 articles (latest, auto-filled)
 * Position 2: heroStack         - 27 articles total (4 sub-sections, auto-filled by viewCount + latest)
 *             ├─ heroMain        - 8 articles (1 large + 7 grid)
 *             ├─ heroLatest      - 7 articles (latest news)
 *             ├─ heroMostRead    - 8 articles (by viewCount desc)
 *             └─ heroTrending    - 4 articles (top viewCount)
 * Position 3: categorySection1  - 20 articles (admin links 4 categories, 5 each)
 * Position 4: categorySection2  - 20 articles (admin links 4 categories, 5 each)
 * Position 5: categoryHub       - 10 articles (admin links 2 categories, 5 each)
 * 
 * Total: 89 articles per homepage load
 * 
 * Ad Slots:
 * - adSection1: Between heroStack and categorySection1
 * - adSection2: Between categorySection1 and categorySection2
 * - adSection3: Between categorySection2 and categoryHub
 */

const SMART_STYLE1_FIXED_SECTIONS = {
  flashTicker: { position: 1, label: 'Flash Ticker', limit: 12, autoFill: true, fillBy: 'latest' },
  heroStack: {
    position: 2,
    label: 'Hero Stack',
    limit: 27,
    autoFill: true,
    fillBy: 'viewCount+latest',
    subSections: {
      heroMain: { limit: 8, fillBy: 'viewCount' },
      heroLatest: { limit: 7, fillBy: 'latest' },
      heroMostRead: { limit: 8, fillBy: 'viewCount' },
      heroTrending: { limit: 4, fillBy: 'viewCount' }
    }
  },
  categorySection1: { position: 3, label: 'Category Section 1', limit: 20, perCategoryLimit: 5, categoryCount: 4 },
  categorySection2: { position: 4, label: 'Category Section 2', limit: 20, perCategoryLimit: 5, categoryCount: 4 },
  categoryHub: { position: 5, label: 'Category Hub', limit: 10, perCategoryLimit: 5, categoryCount: 2 }
};

const SMART_STYLE1_AD_SLOTS = {
  adSection1: { position: 'after_heroStack', label: 'Ad Section 1 (After Hero)' },
  adSection2: { position: 'after_categorySection1', label: 'Ad Section 2 (After Category 1)' },
  adSection3: { position: 'after_categorySection2', label: 'Ad Section 3 (After Category 2)' }
};

/**
 * @swagger
 * tags:
 *   - name: Smart Theme Management
 *     description: Smart homepage configuration with fixed sections and category linking
 */

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style1/smart:
 *   get:
 *     summary: Get Smart Style1 homepage configuration
 *     description: |
 *       Returns the fixed section structure for Style1 homepage with current category links.
 *       
 *       **Fixed Sections (cannot be changed):**
 *       - Position 1: flashTicker (12 articles, auto-filled by latest)
 *       - Position 2: heroStack (27 articles, auto-filled by viewCount + latest)
 *       - Position 3: categorySection1 (20 articles = 4 categories × 5)
 *       - Position 4: categorySection2 (20 articles = 4 categories × 5)
 *       - Position 5: categoryHub (10 articles = 2 categories × 5)
 *       
 *       **Ads Slots:**
 *       - adSection1: Between heroStack and categorySection1
 *       - adSection2: Between categorySection1 and categorySection2
 *       - adSection3: Between categorySection2 and categoryHub
 *       
 *       Admin can only configure: category links for sections 3,4,5 and ad provider/content per slot.
 *     tags: [Smart Theme Management]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Smart Style1 configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fixedSections:
 *                   type: object
 *                   description: Fixed section definitions (read-only)
 *                 adSlots:
 *                   type: object
 *                   description: Ad slot definitions
 *                 categoryLinks:
 *                   type: object
 *                   description: Current category assignments (admin configurable)
 *                   properties:
 *                     categorySection1:
 *                       type: array
 *                       items: { type: string }
 *                       example: ["politics", "sports", "entertainment", "technology"]
 *                     categorySection2:
 *                       type: array
 *                       items: { type: string }
 *                       example: ["health", "education", "crime", "national"]
 *                     categoryHub:
 *                       type: array
 *                       items: { type: string }
 *                       example: ["business", "international"]
 *                 adsConfig:
 *                   type: object
 *                   description: Ad configuration per slot
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
      const smartStyle1 = isPlainObject(homepageConfig.smartStyle1) ? homepageConfig.smartStyle1 : {};

      return res.json({
        fixedSections: SMART_STYLE1_FIXED_SECTIONS,
        adSlots: SMART_STYLE1_AD_SLOTS,
        categoryLinks: {
          categorySection1: Array.isArray(smartStyle1.categorySection1) ? smartStyle1.categorySection1 : [],
          categorySection2: Array.isArray(smartStyle1.categorySection2) ? smartStyle1.categorySection2 : [],
          categoryHub: Array.isArray(smartStyle1.categoryHub) ? smartStyle1.categoryHub : []
        },
        adsConfig: isPlainObject(smartStyle1.adsConfig) ? smartStyle1.adsConfig : {}
      });
    } catch (e: any) {
      console.error('get smart style1 config error', e);
      return res.status(500).json({ error: 'Failed to get smart style1 config' });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style1/smart:
 *   put:
 *     summary: Update Smart Style1 category links
 *     description: |
 *       Update category links for the configurable sections.
 *       
 *       **Rules:**
 *       - categorySection1: Requires exactly 4 category slugs
 *       - categorySection2: Requires exactly 4 category slugs
 *       - categoryHub: Requires exactly 2 category slugs
 *       
 *       Category slugs must match existing categories in the tenant's domain.
 *     tags: [Smart Theme Management]
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
 *               categorySection1:
 *                 type: array
 *                 items: { type: string }
 *                 minItems: 4
 *                 maxItems: 4
 *                 example: ["politics", "sports", "entertainment", "technology"]
 *                 description: "4 category slugs for section 1 (5 articles each = 20 total)"
 *               categorySection2:
 *                 type: array
 *                 items: { type: string }
 *                 minItems: 4
 *                 maxItems: 4
 *                 example: ["health", "education", "crime", "national"]
 *                 description: "4 category slugs for section 2 (5 articles each = 20 total)"
 *               categoryHub:
 *                 type: array
 *                 items: { type: string }
 *                 minItems: 2
 *                 maxItems: 2
 *                 example: ["business", "international"]
 *                 description: "2 category slugs for category hub (5 articles each = 10 total)"
 *           examples:
 *             fullUpdate:
 *               summary: Update all category sections
 *               value:
 *                 categorySection1: ["politics", "sports", "entertainment", "technology"]
 *                 categorySection2: ["health", "education", "crime", "national"]
 *                 categoryHub: ["business", "international"]
 *             partialUpdate:
 *               summary: Update only categorySection1
 *               value:
 *                 categorySection1: ["రాజకీయాలు", "క్రీడలు", "వినోదం", "సాంకేతికం"]
 *     responses:
 *       200:
 *         description: Updated configuration
 *       400:
 *         description: Validation error (wrong number of categories)
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

      // Validate category counts if provided
      if (body.categorySection1 !== undefined) {
        if (!Array.isArray(body.categorySection1) || body.categorySection1.length !== 4) {
          errors.push('categorySection1 must have exactly 4 category slugs');
        }
      }
      if (body.categorySection2 !== undefined) {
        if (!Array.isArray(body.categorySection2) || body.categorySection2.length !== 4) {
          errors.push('categorySection2 must have exactly 4 category slugs');
        }
      }
      if (body.categoryHub !== undefined) {
        if (!Array.isArray(body.categoryHub) || body.categoryHub.length !== 2) {
          errors.push('categoryHub must have exactly 2 category slugs');
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      // Get existing theme
      const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
      const existingHomepageConfig = isPlainObject((theme as any)?.homepageConfig)
        ? { ...(theme as any).homepageConfig }
        : {};
      const existingSmartStyle1 = isPlainObject(existingHomepageConfig.smartStyle1)
        ? { ...existingHomepageConfig.smartStyle1 }
        : {};

      // Update category links
      if (body.categorySection1 !== undefined) {
        existingSmartStyle1.categorySection1 = body.categorySection1.map((s: any) => String(s).trim());
      }
      if (body.categorySection2 !== undefined) {
        existingSmartStyle1.categorySection2 = body.categorySection2.map((s: any) => String(s).trim());
      }
      if (body.categoryHub !== undefined) {
        existingSmartStyle1.categoryHub = body.categoryHub.map((s: any) => String(s).trim());
      }

      existingHomepageConfig.smartStyle1 = existingSmartStyle1;

      const saved = theme
        ? await (prisma as any).tenantTheme.update({
            where: { tenantId },
            data: { homepageConfig: existingHomepageConfig }
          })
        : await (prisma as any).tenantTheme.create({
            data: { tenantId, homepageConfig: existingHomepageConfig }
          });

      const savedSmartStyle1 = isPlainObject((saved.homepageConfig as any)?.smartStyle1)
        ? (saved.homepageConfig as any).smartStyle1
        : {};

      return res.json({
        success: true,
        categoryLinks: {
          categorySection1: Array.isArray(savedSmartStyle1.categorySection1) ? savedSmartStyle1.categorySection1 : [],
          categorySection2: Array.isArray(savedSmartStyle1.categorySection2) ? savedSmartStyle1.categorySection2 : [],
          categoryHub: Array.isArray(savedSmartStyle1.categoryHub) ? savedSmartStyle1.categoryHub : []
        }
      });
    } catch (e: any) {
      console.error('update smart style1 config error', e);
      return res.status(500).json({ error: 'Failed to update smart style1 config' });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style1/smart/ads:
 *   get:
 *     summary: Get Smart Style1 ads configuration
 *     description: |
 *       Returns the ads configuration for Style1 homepage.
 *       
 *       **Ad Slots:**
 *       - adSection1: Between heroStack and categorySection1
 *       - adSection2: Between categorySection1 and categorySection2
 *       - adSection3: Between categorySection2 and categoryHub
 *       
 *       **Provider Types:**
 *       - `google`: Google AdSense (default) - uses slot ID from Google
 *       - `local`: Local/Private ads - custom image, click URL, schedule
 *       
 *       Local ads can override Google ads for specific time periods (e.g., festival campaigns).
 *     tags: [Smart Theme Management]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ads configuration per slot
 *         content:
 *           application/json:
 *             example:
 *               globalEnabled: true
 *               defaultProvider: "google"
 *               googleAdsense:
 *                 client: "ca-pub-XXXXXXXXX"
 *               slots:
 *                 adSection1:
 *                   enabled: true
 *                   provider: "google"
 *                   google:
 *                     slot: "1234567890"
 *                     format: "auto"
 *                     responsive: true
 *                   local: null
 *                 adSection2:
 *                   enabled: true
 *                   provider: "local"
 *                   google: null
 *                   local:
 *                     enabled: true
 *                     imageUrl: "https://cdn.example.com/ads/diwali-sale.jpg"
 *                     clickUrl: "https://advertiser.com/offer"
 *                     alt: "Diwali Sale - 50% Off"
 *                     schedule:
 *                       startDate: "2025-10-15"
 *                       endDate: "2025-11-15"
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
      const smartStyle1 = isPlainObject(homepageConfig.smartStyle1) ? homepageConfig.smartStyle1 : {};
      const adsConfig = isPlainObject(smartStyle1.adsConfig) ? smartStyle1.adsConfig : {};

      // Build response with defaults
      const response = {
        globalEnabled: adsConfig.globalEnabled !== false,
        defaultProvider: adsConfig.defaultProvider || 'google',
        googleAdsense: isPlainObject(adsConfig.googleAdsense) ? adsConfig.googleAdsense : { client: null },
        slots: {
          adSection1: buildAdSlotResponse(adsConfig.slots?.adSection1),
          adSection2: buildAdSlotResponse(adsConfig.slots?.adSection2),
          adSection3: buildAdSlotResponse(adsConfig.slots?.adSection3)
        }
      };

      return res.json(response);
    } catch (e: any) {
      console.error('get smart style1 ads config error', e);
      return res.status(500).json({ error: 'Failed to get ads config' });
    }
  }
);

function buildAdSlotResponse(slot: any) {
  if (!isPlainObject(slot)) {
    return {
      enabled: false,
      provider: 'google',
      google: { slot: null, format: 'auto', responsive: true },
      local: null
    };
  }
  return {
    enabled: slot.enabled !== false,
    provider: slot.provider || 'google',
    google: isPlainObject(slot.google) ? slot.google : null,
    local: isPlainObject(slot.local) ? slot.local : null
  };
}

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style1/smart/ads:
 *   put:
 *     summary: Update Smart Style1 ads configuration
 *     description: |
 *       Update ads configuration for Style1 homepage slots.
 *       
 *       **Use Cases:**
 *       1. **Enable Google Ads (default):** Set provider to "google" with slot ID
 *       2. **Override with Local Ad:** Set provider to "local" with image/click URLs
 *       3. **Schedule Local Ad:** Add schedule.startDate and schedule.endDate for time-limited campaigns
 *       4. **Disable a slot:** Set enabled: false
 *       
 *       **Provider Priority:**
 *       - If local ad has active schedule → show local ad
 *       - Otherwise → show Google ad (if enabled)
 *       - If both disabled → hide slot
 *     tags: [Smart Theme Management]
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
 *               globalEnabled:
 *                 type: boolean
 *                 description: Master switch for all ads
 *               defaultProvider:
 *                 type: string
 *                 enum: [google, local]
 *                 description: Default provider for new slots
 *               googleAdsense:
 *                 type: object
 *                 properties:
 *                   client:
 *                     type: string
 *                     example: "ca-pub-XXXXXXXXX"
 *               slots:
 *                 type: object
 *                 properties:
 *                   adSection1:
 *                     $ref: '#/components/schemas/AdSlotConfig'
 *                   adSection2:
 *                     $ref: '#/components/schemas/AdSlotConfig'
 *                   adSection3:
 *                     $ref: '#/components/schemas/AdSlotConfig'
 *           examples:
 *             enableGoogleAds:
 *               summary: Enable Google AdSense for all slots
 *               value:
 *                 globalEnabled: true
 *                 googleAdsense:
 *                   client: "ca-pub-1234567890"
 *                 slots:
 *                   adSection1:
 *                     enabled: true
 *                     provider: "google"
 *                     google:
 *                       slot: "1111111111"
 *                   adSection2:
 *                     enabled: true
 *                     provider: "google"
 *                     google:
 *                       slot: "2222222222"
 *             localAdCampaign:
 *               summary: Schedule a local ad campaign (overrides Google for time period)
 *               value:
 *                 slots:
 *                   adSection1:
 *                     enabled: true
 *                     provider: "local"
 *                     local:
 *                       enabled: true
 *                       imageUrl: "https://cdn.example.com/ads/diwali-banner.jpg"
 *                       clickUrl: "https://advertiser.com/diwali-offer"
 *                       alt: "Diwali Special - 50% Off"
 *                       schedule:
 *                         startDate: "2025-10-15"
 *                         endDate: "2025-11-15"
 *             disableAdsOnSlot:
 *               summary: Disable ads on a specific slot
 *               value:
 *                 slots:
 *                   adSection2:
 *                     enabled: false
 *     responses:
 *       200:
 *         description: Updated ads configuration
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *
 * components:
 *   schemas:
 *     AdSlotConfig:
 *       type: object
 *       properties:
 *         enabled:
 *           type: boolean
 *           description: Whether this slot shows ads
 *         provider:
 *           type: string
 *           enum: [google, local]
 *           description: Which ad provider to use
 *         google:
 *           type: object
 *           properties:
 *             slot:
 *               type: string
 *               description: Google AdSense slot ID
 *             format:
 *               type: string
 *               default: "auto"
 *             responsive:
 *               type: boolean
 *               default: true
 *         local:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *             imageUrl:
 *               type: string
 *               description: Ad banner image URL
 *             clickUrl:
 *               type: string
 *               description: Click destination URL
 *             alt:
 *               type: string
 *               description: Alt text for accessibility
 *             logoUrl:
 *               type: string
 *               description: Optional sponsor logo
 *             schedule:
 *               type: object
 *               properties:
 *                 startDate:
 *                   type: string
 *                   format: date
 *                   description: Campaign start date (YYYY-MM-DD)
 *                 endDate:
 *                   type: string
 *                   format: date
 *                   description: Campaign end date (YYYY-MM-DD)
 */
router.put(
  '/:tenantId/homepage/style1/smart/ads',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const body = req.body || {};

      // Get existing theme
      const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
      const existingHomepageConfig = isPlainObject((theme as any)?.homepageConfig)
        ? { ...(theme as any).homepageConfig }
        : {};
      const existingSmartStyle1 = isPlainObject(existingHomepageConfig.smartStyle1)
        ? { ...existingHomepageConfig.smartStyle1 }
        : {};
      const existingAdsConfig = isPlainObject(existingSmartStyle1.adsConfig)
        ? { ...existingSmartStyle1.adsConfig }
        : {};

      // Update global settings
      if (typeof body.globalEnabled === 'boolean') {
        existingAdsConfig.globalEnabled = body.globalEnabled;
      }
      if (body.defaultProvider === 'google' || body.defaultProvider === 'local') {
        existingAdsConfig.defaultProvider = body.defaultProvider;
      }
      if (isPlainObject(body.googleAdsense)) {
        existingAdsConfig.googleAdsense = {
          ...(existingAdsConfig.googleAdsense || {}),
          ...body.googleAdsense
        };
      }

      // Update slot configs
      if (isPlainObject(body.slots)) {
        const existingSlots = isPlainObject(existingAdsConfig.slots) ? { ...existingAdsConfig.slots } : {};
        for (const slotKey of ['adSection1', 'adSection2', 'adSection3']) {
          if (isPlainObject(body.slots[slotKey])) {
            existingSlots[slotKey] = {
              ...(existingSlots[slotKey] || {}),
              ...body.slots[slotKey]
            };
          }
        }
        existingAdsConfig.slots = existingSlots;
      }

      existingSmartStyle1.adsConfig = existingAdsConfig;
      existingHomepageConfig.smartStyle1 = existingSmartStyle1;

      const saved = theme
        ? await (prisma as any).tenantTheme.update({
            where: { tenantId },
            data: { homepageConfig: existingHomepageConfig }
          })
        : await (prisma as any).tenantTheme.create({
            data: { tenantId, homepageConfig: existingHomepageConfig }
          });

      const savedAdsConfig = (saved.homepageConfig as any)?.smartStyle1?.adsConfig || {};

      return res.json({
        success: true,
        adsConfig: {
          globalEnabled: savedAdsConfig.globalEnabled !== false,
          defaultProvider: savedAdsConfig.defaultProvider || 'google',
          googleAdsense: savedAdsConfig.googleAdsense || { client: null },
          slots: {
            adSection1: buildAdSlotResponse(savedAdsConfig.slots?.adSection1),
            adSection2: buildAdSlotResponse(savedAdsConfig.slots?.adSection2),
            adSection3: buildAdSlotResponse(savedAdsConfig.slots?.adSection3)
          }
        }
      });
    } catch (e: any) {
      console.error('update smart style1 ads config error', e);
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
