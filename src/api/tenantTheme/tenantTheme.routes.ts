import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdminScoped } from '../middlewares/authz';

const router = Router();

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

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style2/v2:
 *   get:
 *     summary: Get Style2 v2 homepage config for a tenant
 *     description: |
 *       Returns the effective Style2 v2 config stored under `TenantTheme.homepageConfig.style2.v2`.
 *
 *       Best practice:
 *       1) POST `/tenant-theme/{tenantId}/homepage/style2/v2/apply-default`
 *       2) PATCH `/tenant-theme/{tenantId}/homepage/style2/v2/sections`
 *       3) Verify via GET `/public/homepage?shape=style2&v=2`
 *     tags: [Tenant Theme]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Style2 v2 config
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/:tenantId/homepage/style2/v2',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const tenantId = req.params.tenantId;

    const tenantTheme = await prisma.tenantTheme.findFirst({ where: { tenantId } });
    const homepageConfig = (tenantTheme?.homepageConfig as any) ?? {};
    const style2 = homepageConfig.style2 ?? {};
    const v2 = style2.v2 ?? buildDefaultHomepageConfigForStyle('style2')?.v2;

    return res.json({ tenantId, style: 'style2', v: 2, config: v2 });
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style2/v2/apply-default:
 *   post:
 *     summary: Apply default Style2 v2 homepage config to a tenant
 *     description: |
 *       Creates/updates `TenantTheme.homepageConfig.style2.v2` with server defaults.
 *
 *       Use this first, then PATCH sections to customize category slugs and labels.
 *     tags: [Tenant Theme]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated tenant theme
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/:tenantId/homepage/style2/v2/apply-default',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const tenantId = req.params.tenantId;
    const defaultStyle2 = buildDefaultHomepageConfigForStyle('style2');

    // Merge update safely (Prisma JSON merge isn't automatic for nested objects)
    const current = await prisma.tenantTheme.findFirst({ where: { tenantId } });
    const existing = (current?.homepageConfig as any) ?? {};
    const merged = {
      ...existing,
      style2: {
        ...(existing.style2 ?? {}),
        v2: defaultStyle2.v2
      }
    };

    const updated = await prisma.tenantTheme.upsert({
      where: { tenantId },
      create: { tenantId, homepageConfig: merged as any },
      update: { homepageConfig: merged as any }
    });

    return res.json(updated);
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/homepage/style2/v2/sections:
 *   patch:
 *     summary: Patch Style2 v2 homepage sections for a tenant (labels + category slugs)
 *     description: |
 *       Partial merge by `key` against `homepageConfig.style2.v2.sections[]`.
 *
 *       Notes:
 *       - `toiGrid3.centerLimit` stays "latest" in the public homepage response.
 *       - `toiGrid3.rightMostReadLabel` only changes UI label; the data comes from `TenantWebArticle.viewCount`.
 *     tags: [Tenant Theme]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                       example: toiGrid3
 *                     label:
 *                       type: string
 *                       example: Top Stories
 *                     limit:
 *                       type: number
 *                       example: 10
 *                     leftCategorySlug:
 *                       type: string
 *                       nullable: true
 *                       example: politics
 *                     centerLimit:
 *                       type: number
 *                       example: 6
 *                     rightLatestLimit:
 *                       type: number
 *                       example: 8
 *                     rightMostReadLimit:
 *                       type: number
 *                       example: 8
 *                     rightLatestLabel:
 *                       type: string
 *                       example: Latest News
 *                     rightMostReadLabel:
 *                       type: string
 *                       example: Most Read
 *                     categorySlugs:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: [technology, education, also-in-news]
 *                     perCategoryLimit:
 *                       type: number
 *                       example: 5
 *                     rows:
 *                       type: number
 *                       example: 4
 *                     cols:
 *                       type: number
 *                       example: 3
 *           examples:
 *             updateStyle2V2:
 *               value:
 *                 sections:
 *                   - key: flashTicker
 *                     label: Breaking
 *                     limit: 10
 *                   - key: toiGrid3
 *                     label: Top Stories
 *                     leftCategorySlug: politics
 *                     centerLimit: 6
 *                     rightLatestLimit: 8
 *                     rightMostReadLimit: 8
 *                     rightLatestLabel: Latest News
 *                     rightMostReadLabel: Most Read
 *                   - key: topStoriesGrid
 *                     label: Top Stories
 *                     limit: 9
 *                   - key: section3
 *                     label: Highlights
 *                     categorySlugs: [technology, education, sports]
 *                     perCategoryLimit: 5
 *                   - key: section4
 *                     label: Categories
 *                     rows: 4
 *                     cols: 3
 *                     perCategoryLimit: 5
 *     responses:
 *       200:
 *         description: Updated tenant theme
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/:tenantId/homepage/style2/v2/sections',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const tenantId = req.params.tenantId;
    const incomingSections = Array.isArray(req.body?.sections) ? req.body.sections : [];

    const tenantTheme = await prisma.tenantTheme.findFirst({ where: { tenantId } });
    const existing = (tenantTheme?.homepageConfig as any) ?? {};

    const defaults = buildDefaultHomepageConfigForStyle('style2');
    const existingV2 = existing?.style2?.v2 ?? defaults.v2;
    const existingSections = Array.isArray(existingV2?.sections) ? existingV2.sections : [];

    const byKey = new Map<string, any>();
    for (const sec of existingSections) {
      if (sec && typeof sec.key === 'string') byKey.set(sec.key, sec);
    }

    for (const patch of incomingSections) {
      if (!patch || typeof patch.key !== 'string') continue;
      const current = byKey.get(patch.key) ?? { key: patch.key };

      const next = {
        ...current,
        ...(typeof patch.label === 'string' ? { label: patch.label } : {}),
        ...(typeof patch.limit === 'number' ? { limit: patch.limit } : {}),
        ...(typeof patch.leftCategorySlug === 'string' || patch.leftCategorySlug === null
          ? { leftCategorySlug: patch.leftCategorySlug }
          : {}),
        ...(typeof patch.centerLimit === 'number' ? { centerLimit: patch.centerLimit } : {}),
        ...(typeof patch.rightLatestLimit === 'number' ? { rightLatestLimit: patch.rightLatestLimit } : {}),
        ...(typeof patch.rightMostReadLimit === 'number' ? { rightMostReadLimit: patch.rightMostReadLimit } : {}),
        ...(typeof patch.rightLatestLabel === 'string' ? { rightLatestLabel: patch.rightLatestLabel } : {}),
        ...(typeof patch.rightMostReadLabel === 'string' ? { rightMostReadLabel: patch.rightMostReadLabel } : {}),
        ...(Array.isArray(patch.categorySlugs)
          ? { categorySlugs: patch.categorySlugs.filter((s: any) => typeof s === 'string') }
          : {}),
        ...(typeof patch.perCategoryLimit === 'number' ? { perCategoryLimit: patch.perCategoryLimit } : {}),
        ...(typeof patch.rows === 'number' ? { rows: patch.rows } : {}),
        ...(typeof patch.cols === 'number' ? { cols: patch.cols } : {})
      };

      byKey.set(patch.key, next);
    }

    // Preserve original order; append any new keys at the end.
    const orderedKeys = existingSections.map((s: any) => s?.key).filter((k: any) => typeof k === 'string');
    const seen = new Set<string>();
    const mergedSections: any[] = [];
    for (const k of orderedKeys) {
      const sec = byKey.get(k);
      if (sec && !seen.has(k)) {
        mergedSections.push(sec);
        seen.add(k);
      }
    }
    for (const [k, sec] of byKey.entries()) {
      if (!seen.has(k)) mergedSections.push(sec);
    }

    const merged = {
      ...existing,
      style2: {
        ...(existing.style2 ?? {}),
        v2: {
          ...(existing?.style2?.v2 ?? {}),
          sections: mergedSections
        }
      }
    };

    const updated = await prisma.tenantTheme.upsert({
      where: { tenantId },
      create: { tenantId, homepageConfig: merged as any },
      update: { homepageConfig: merged as any }
    });

    return res.json(updated);
  }
);
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
 *       Style2 note: Apply defaults for style2 first, then PATCH sections via
 *       /tenant-theme/{tenantId}/homepage/style2/sections.
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
 *     description: Partial merge by section `key`. Updates only provided fields; creates missing section keys.
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
 *             style2Homepage:
 *               summary: Style2 homepage sections (drives /public/homepage?shape=style2)
 *               value:
 *                 sections:
 *                   - key: hero
 *                     title: "Latest"
 *                     position: 1
 *                     style: "hero"
 *                     limit: 1
 *                   - key: politics
 *                     title: "Politics"
 *                     position: 10
 *                     style: "grid"
 *                     categorySlug: "politics"
 *                     limit: 6
 *                   - key: sports
 *                     title: "Sports"
 *                     position: 20
 *                     style: "grid"
 *                     categorySlug: "sports"
 *                     limit: 6
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

export default router;
