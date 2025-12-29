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
      sections: []
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
    if (Object.prototype.hasOwnProperty.call(payload, 'headerHtml')) data.headerHtml = payload.headerHtml;
    if (Object.prototype.hasOwnProperty.call(payload, 'homepageConfig')) data.homepageConfig = payload.homepageConfig;

    const existing = await (prisma as any).tenantTheme.findUnique({ where: { tenantId } }).catch(() => null);
    const saved = existing
      ? await (prisma as any).tenantTheme.update({ where: { tenantId }, data })
      : await (prisma as any).tenantTheme.create({ data: { tenantId, ...data } });
    return res.json(saved);
  }
);

export default router;
