import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdminScoped, requireSuperAdmin } from '../middlewares/authz';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

/**
 * @swagger
 * tags:
 *   - name: Homepage Sections
 *     description: Style2 homepage section configuration - link categories to sections with custom labels
 */

/**
 * @swagger
 * /homepage-sections/{tenantId}:
 *   get:
 *     summary: List all homepage section configs for a tenant
 *     description: Returns all configured homepage sections for the tenant, optionally filtered by domainId.
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *         description: Filter sections by domain (optional)
 *       - in: query
 *         name: activeOnly
 *         schema: { type: boolean, default: false }
 *         description: Only return active sections
 *     responses:
 *       200:
 *         description: List of homepage sections
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   key: { type: string }
 *                   label: { type: string }
 *                   labelEn: { type: string, nullable: true }
 *                   position: { type: integer }
 *                   style: { type: string }
 *                   categoryId: { type: string, nullable: true }
 *                   categorySlug: { type: string, nullable: true }
 *                   articleLimit: { type: integer }
 *                   isActive: { type: boolean }
 *                   category: { type: object, nullable: true }
 */
router.get('/:tenantId', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const domainId = req.query.domainId ? String(req.query.domainId) : null;
    const activeOnly = String(req.query.activeOnly || '').toLowerCase() === 'true';

    const where: any = { tenantId };
    if (domainId) where.domainId = domainId;
    if (activeOnly) where.isActive = true;

    const sections = await p.homepageSectionConfig.findMany({
      where,
      orderBy: { position: 'asc' },
      include: {
        category: { select: { id: true, slug: true, name: true, iconUrl: true } }
      }
    });

    return res.json(sections);
  } catch (e) {
    console.error('homepage-sections list error', e);
    return res.status(500).json({ error: 'Failed to list homepage sections' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/{key}:
 *   get:
 *     summary: Get a single homepage section by key
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Section config }
 *       404: { description: Not found }
 */
router.get('/:tenantId/:key', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId, key } = req.params;
    const domainId = req.query.domainId ? String(req.query.domainId) : null;

    const section = await p.homepageSectionConfig.findUnique({
      where: { tenantId_domainId_key: { tenantId, domainId, key } },
      include: { category: { select: { id: true, slug: true, name: true, iconUrl: true } } }
    });

    if (!section) return res.status(404).json({ error: 'Section not found' });
    return res.json(section);
  } catch (e) {
    console.error('homepage-sections get error', e);
    return res.status(500).json({ error: 'Failed to get homepage section' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}:
 *   post:
 *     summary: Create a new homepage section config
 *     description: |
 *       Create a section for Style2 homepage. Link a category and set a custom label (in tenant language).
 *       Example: Create a "Politics" section with Telugu label "రాజకీయాలు".
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
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
 *             required: [key, label]
 *             properties:
 *               key: { type: string, example: "politics", description: "Unique section key" }
 *               label: { type: string, example: "రాజకీయాలు", description: "Display label in tenant language" }
 *               labelEn: { type: string, example: "Politics", description: "English fallback label" }
 *               position: { type: integer, example: 1, description: "Order on page (lower = higher)" }
 *               style: { type: string, enum: [hero, grid, list, cards, ticker], default: "cards" }
 *               categorySlug: { type: string, example: "politics", description: "Category slug to link" }
 *               articleLimit: { type: integer, example: 6, default: 6 }
 *               isActive: { type: boolean, default: true }
 *               domainId: { type: string, nullable: true, description: "Domain-specific config (optional)" }
 *               config: { type: object, description: "Extra config JSON" }
 *           examples:
 *             politics:
 *               summary: Politics section with Telugu label
 *               value:
 *                 key: "politics"
 *                 label: "రాజకీయాలు"
 *                 labelEn: "Politics"
 *                 position: 1
 *                 style: "cards"
 *                 categorySlug: "politics"
 *                 articleLimit: 6
 *     responses:
 *       201: { description: Created section }
 *       400: { description: Validation error }
 *       409: { description: Section key already exists }
 */
router.post('/:tenantId', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { key, label, labelEn, position, style, categorySlug, articleLimit, isActive, domainId, config } = req.body || {};

    if (!key || typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ error: 'key is required' });
    }
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'label is required' });
    }

    const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    // Resolve category if slug provided
    let categoryId: string | null = null;
    let resolvedSlug: string | null = null;
    if (categorySlug && typeof categorySlug === 'string' && categorySlug.trim()) {
      const cat = await p.category.findUnique({ where: { slug: categorySlug.trim() } });
      if (cat) {
        categoryId = cat.id;
        resolvedSlug = cat.slug;
      } else {
        return res.status(400).json({ error: `Category with slug "${categorySlug}" not found` });
      }
    }

    const data: any = {
      tenantId,
      domainId: domainId || null,
      key: normalizedKey,
      label: label.trim(),
      labelEn: labelEn ? String(labelEn).trim() : null,
      position: typeof position === 'number' ? position : 0,
      style: typeof style === 'string' && style.trim() ? style.trim() : 'cards',
      categoryId,
      categorySlug: resolvedSlug,
      articleLimit: typeof articleLimit === 'number' ? Math.min(Math.max(articleLimit, 1), 50) : 6,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      config: config || null
    };

    const created = await p.homepageSectionConfig.create({
      data,
      include: { category: { select: { id: true, slug: true, name: true } } }
    });

    return res.status(201).json(created);
  } catch (e: any) {
    if (String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Section key already exists for this tenant/domain' });
    }
    console.error('homepage-sections create error', e);
    return res.status(500).json({ error: 'Failed to create homepage section' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/{key}:
 *   put:
 *     summary: Update a homepage section config
 *     description: Update label, category link, position, or other settings for a section.
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               labelEn: { type: string }
 *               position: { type: integer }
 *               style: { type: string }
 *               categorySlug: { type: string, nullable: true }
 *               articleLimit: { type: integer }
 *               isActive: { type: boolean }
 *               config: { type: object }
 *     responses:
 *       200: { description: Updated section }
 *       404: { description: Not found }
 */
router.put('/:tenantId/:key', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId, key } = req.params;
    const domainId = req.query.domainId ? String(req.query.domainId) : null;
    const { label, labelEn, position, style, categorySlug, articleLimit, isActive, config } = req.body || {};

    const existing = await p.homepageSectionConfig.findUnique({
      where: { tenantId_domainId_key: { tenantId, domainId, key } }
    });

    if (!existing) return res.status(404).json({ error: 'Section not found' });

    const updateData: any = {};

    if (typeof label === 'string' && label.trim()) updateData.label = label.trim();
    if (labelEn !== undefined) updateData.labelEn = labelEn ? String(labelEn).trim() : null;
    if (typeof position === 'number') updateData.position = position;
    if (typeof style === 'string' && style.trim()) updateData.style = style.trim();
    if (typeof articleLimit === 'number') updateData.articleLimit = Math.min(Math.max(articleLimit, 1), 50);
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (config !== undefined) updateData.config = config;

    // Handle category update
    if (categorySlug !== undefined) {
      if (categorySlug === null || categorySlug === '') {
        updateData.categoryId = null;
        updateData.categorySlug = null;
      } else {
        const cat = await p.category.findUnique({ where: { slug: String(categorySlug).trim() } });
        if (!cat) return res.status(400).json({ error: `Category with slug "${categorySlug}" not found` });
        updateData.categoryId = cat.id;
        updateData.categorySlug = cat.slug;
      }
    }

    const updated = await p.homepageSectionConfig.update({
      where: { id: existing.id },
      data: updateData,
      include: { category: { select: { id: true, slug: true, name: true } } }
    });

    return res.json(updated);
  } catch (e) {
    console.error('homepage-sections update error', e);
    return res.status(500).json({ error: 'Failed to update homepage section' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/{key}:
 *   delete:
 *     summary: Delete a homepage section config
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
router.delete('/:tenantId/:key', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId, key } = req.params;
    const domainId = req.query.domainId ? String(req.query.domainId) : null;

    const existing = await p.homepageSectionConfig.findUnique({
      where: { tenantId_domainId_key: { tenantId, domainId, key } }
    });

    if (!existing) return res.status(404).json({ error: 'Section not found' });

    await p.homepageSectionConfig.delete({ where: { id: existing.id } });

    return res.json({ success: true, deleted: key });
  } catch (e) {
    console.error('homepage-sections delete error', e);
    return res.status(500).json({ error: 'Failed to delete homepage section' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/bulk:
 *   put:
 *     summary: Bulk upsert homepage sections
 *     description: |
 *       Create or update multiple sections at once. Useful for initial setup or reordering.
 *       Each section is identified by `key`. If exists, updates; otherwise creates.
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
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
 *               domainId: { type: string, nullable: true }
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [key, label]
 *                   properties:
 *                     key: { type: string }
 *                     label: { type: string }
 *                     labelEn: { type: string }
 *                     position: { type: integer }
 *                     style: { type: string }
 *                     categorySlug: { type: string, nullable: true }
 *                     articleLimit: { type: integer }
 *                     isActive: { type: boolean }
 *           examples:
 *             setup:
 *               summary: Initial homepage setup with Telugu labels
 *               value:
 *                 sections:
 *                   - { key: "hero", label: "ప్రధాన వార్తలు", labelEn: "Hero", position: 0, style: "hero", articleLimit: 3 }
 *                   - { key: "politics", label: "రాజకీయాలు", labelEn: "Politics", position: 1, style: "cards", categorySlug: "politics", articleLimit: 6 }
 *                   - { key: "crime", label: "నేరాలు", labelEn: "Crime", position: 2, style: "list", categorySlug: "crime", articleLimit: 6 }
 *                   - { key: "sports", label: "క్రీడలు", labelEn: "Sports", position: 3, style: "cards", categorySlug: "sports", articleLimit: 6 }
 *     responses:
 *       200: { description: Bulk upsert results }
 */
router.put('/:tenantId/bulk', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { domainId, sections } = req.body || {};

    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ error: 'sections array is required' });
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const sec of sections) {
      if (!sec.key || !sec.label) {
        errors.push({ key: sec.key, error: 'key and label are required' });
        continue;
      }

      const normalizedKey = String(sec.key).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

      let categoryId: string | null = null;
      let categorySlug: string | null = null;
      if (sec.categorySlug && typeof sec.categorySlug === 'string' && sec.categorySlug.trim()) {
        const cat = await p.category.findUnique({ where: { slug: sec.categorySlug.trim() } });
        if (cat) {
          categoryId = cat.id;
          categorySlug = cat.slug;
        }
      }

      const data: any = {
        tenantId,
        domainId: domainId || null,
        key: normalizedKey,
        label: String(sec.label).trim(),
        labelEn: sec.labelEn ? String(sec.labelEn).trim() : null,
        position: typeof sec.position === 'number' ? sec.position : 0,
        style: typeof sec.style === 'string' && sec.style.trim() ? sec.style.trim() : 'cards',
        categoryId,
        categorySlug,
        articleLimit: typeof sec.articleLimit === 'number' ? Math.min(Math.max(sec.articleLimit, 1), 50) : 6,
        isActive: typeof sec.isActive === 'boolean' ? sec.isActive : true
      };

      try {
        const upserted = await p.homepageSectionConfig.upsert({
          where: { tenantId_domainId_key: { tenantId, domainId: domainId || null, key: normalizedKey } },
          create: data,
          update: {
            label: data.label,
            labelEn: data.labelEn,
            position: data.position,
            style: data.style,
            categoryId: data.categoryId,
            categorySlug: data.categorySlug,
            articleLimit: data.articleLimit,
            isActive: data.isActive
          },
          include: { category: { select: { id: true, slug: true, name: true } } }
        });
        results.push(upserted);
      } catch (e: any) {
        errors.push({ key: normalizedKey, error: e?.message || 'Failed to upsert' });
      }
    }

    return res.json({ success: true, count: results.length, sections: results, errors });
  } catch (e) {
    console.error('homepage-sections bulk error', e);
    return res.status(500).json({ error: 'Failed to bulk upsert homepage sections' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/reorder:
 *   patch:
 *     summary: Reorder homepage sections
 *     description: Update positions of multiple sections at once.
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
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
 *               domainId: { type: string, nullable: true }
 *               order:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key: { type: string }
 *                     position: { type: integer }
 *           examples:
 *             reorder:
 *               value:
 *                 order:
 *                   - { key: "hero", position: 0 }
 *                   - { key: "sports", position: 1 }
 *                   - { key: "politics", position: 2 }
 *                   - { key: "crime", position: 3 }
 *     responses:
 *       200: { description: Reorder results }
 */
router.patch('/:tenantId/reorder', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { domainId, order } = req.body || {};

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order array is required' });
    }

    const results: any[] = [];
    for (const item of order) {
      if (!item.key || typeof item.position !== 'number') continue;
      const key = String(item.key).trim();
      try {
        const updated = await p.homepageSectionConfig.updateMany({
          where: { tenantId, domainId: domainId || null, key },
          data: { position: item.position }
        });
        results.push({ key, position: item.position, updated: updated.count });
      } catch (e) {
        results.push({ key, position: item.position, error: 'Failed' });
      }
    }

    return res.json({ success: true, results });
  } catch (e) {
    console.error('homepage-sections reorder error', e);
    return res.status(500).json({ error: 'Failed to reorder homepage sections' });
  }
});

export default router;
