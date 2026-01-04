
import { Router } from 'express';
import passport from 'passport';
import { createCategory, getCategories, updateCategory, deleteCategory, translateAndSaveCategoryInBackground, retranslateCategory } from './categories.service';
import { getCategoriesController } from './categories.controller';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { validationMiddleware } from '../middlewares/validation.middleware';
import prisma from '../../lib/prisma';
import { requireReporterOrAdmin } from '../middlewares/authz';

const router = Router();

// Role guard: only SUPER_ADMIN can create/update categories
function requireSuperAdmin(req: any, res: any, next: any) {
  const roleName = (req.user?.role?.name || '').toUpperCase();
  if (roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN') return next();
  return res.status(403).json({ error: 'Forbidden: SUPER_ADMIN only' });
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The unique identifier for the category.
 *         name:
 *           type: string
 *           description: The name of the category (potentially translated).
 *         slug:
 *           type: string
 *           description: A URL-friendly version of the category name.
 *         iconUrl:
 *           type: string
 *           nullable: true
 *           description: URL for the category's icon.
 *         isActive:
 *           type: boolean
 *           description: Whether the category is active and visible.
 *         parentId:
 *           type: string
 *           nullable: true
 *           description: The ID of the parent category, if it's a sub-category.
 *         order:
 *           type: integer
 *           description: The display order of the category.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was created.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was last updated.
 *         children:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Category'
 *           description: A list of nested child categories.
 *
 *     CreateCategoryDto:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the category.
 *           example: "Technology"
 *         iconUrl:
 *           type: string
 *           description: URL for the category's icon.
 *           example: "https://example.com/icons/tech.png"
 *         isActive:
 *           type: boolean
 *           description: Whether the category is active and visible.
 *           default: true
 *         parentId:
 *           type: string
 *           nullable: true
 *           description: The ID of the parent category, for creating a sub-category.
 *           example: "clq1z2x3y4..."
 *
 *     UpdateCategoryDto:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: The new name of the category.
 *         iconUrl:
 *           type: string
 *           description: New URL for the category's icon.
 *         isActive:
 *           type: boolean
 *           description: New status for whether the category is active.
 *         parentId:
 *           type: string
 *           nullable: true
 *           description: The new ID of the parent category.
 */

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management
 */

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCategoryDto'
 *     responses:
 *       201:
 *         description: Category created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid input or category already exists.
 */
router.post('/', passport.authenticate('jwt', { session: false }), requireSuperAdmin, validationMiddleware(CreateCategoryDto), async (req, res) => {
  try {
    const newCategory = await createCategory(req.body);
    void translateAndSaveCategoryInBackground(newCategory.id, newCategory.name);
    res.status(201).json(newCategory);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Retrieve categories (public)
 *     description: Requires languageId and returns a nested list of categories with names translated to that language (from CategoryTranslation).
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: languageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Language ID to translate category names.
 *     responses:
 *       200:
 *         description: A nested list of categories.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 */
router.get('/', getCategoriesController);

/**
 * @swagger
 * /categories/tenant:
 *   get:
 *     summary: List domain-linked categories for the current tenant (for posting)
 *     description: |
 *       Returns ONLY categories allocated to the tenant's domains (DomainCategory mappings).
 *       Names are returned in both the tenant's primary language (from TenantEntity.language) and English.
 *       Works for SUPER_ADMIN (must provide tenantId or domainId) and tenant-scoped roles (REPORTER/TENANT_ADMIN/etc).
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *         description: Optional domain filter (must belong to tenant). If omitted, uses union across all tenant domains.
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: Required for SUPER_ADMIN when domainId is not provided.
 *     responses:
 *       200:
 *         description: Category list with multilingual names.
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 summary: Telugu tenant (te) with English fallback
 *                 value:
 *                   tenantId: "cmtenant123"
 *                   tenantLanguageCode: "te"
 *                   domainId: null
 *                   categories:
 *                     - id: "cmcat001"
 *                       slug: "politics"
 *                       parentId: null
 *                       iconUrl: "https://cdn.example.com/icons/politics.png"
 *                       name: "రాజకీయాలు"
 *                       nameDefault: "Politics"
 *                       names:
 *                         te: "రాజకీయాలు"
 *                         en: "Politics"
 *             schema:
 *               type: object
 *               properties:
 *                 tenantId: { type: string }
 *                 tenantLanguageCode: { type: string, nullable: true }
 *                 domainId: { type: string, nullable: true }
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       slug: { type: string }
 *                       parentId: { type: string, nullable: true }
 *                       iconUrl: { type: string, nullable: true }
 *                       name: { type: string }
 *                       nameDefault: { type: string }
 *                       names:
 *                         type: object
 *                         additionalProperties: { type: string, nullable: true }
 *       400: { description: Bad input }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Tenant or domain not found }
 */
router.get('/tenant', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, async (req, res) => {
  try {
    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '');

    const domainFilterId = req.query.domainId ? String(req.query.domainId) : undefined;
    const tenantIdFromQuery = req.query.tenantId ? String(req.query.tenantId) : undefined;

    // Resolve tenant scope
    let tenantId: string | null = null;
    if (roleName === 'SUPER_ADMIN') {
      if (domainFilterId) {
        const dom = await (prisma as any).domain.findUnique({ where: { id: domainFilterId }, select: { tenantId: true } }).catch(() => null);
        if (!dom) return res.status(404).json({ error: 'Domain not found' });
        tenantId = String(dom.tenantId);
      } else if (tenantIdFromQuery) {
        tenantId = tenantIdFromQuery;
      } else {
        return res.status(400).json({ error: 'tenantId or domainId required for SUPER_ADMIN' });
      }
    } else {
      // Tenant-scoped roles: derive tenantId from reporter profile
      const reporter = await (prisma as any).reporter.findFirst({ where: { userId: user?.id }, select: { tenantId: true } }).catch(() => null);
      if (!reporter?.tenantId) return res.status(403).json({ error: 'Tenant scope missing (reporter profile linkage not found)' });
      tenantId = String(reporter.tenantId);
    }

    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId }, select: { id: true } }).catch(() => null);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Resolve tenant primary language (for name selection)
    const entity = await (prisma as any).tenantEntity.findUnique({ where: { tenantId }, include: { language: true } }).catch(() => null);
    const tenantLanguageCode: string | null = entity?.language?.code ? String(entity.language.code) : null;
    const englishCode = 'en';

    // Tenant domains; optionally restrict to one domain
    const domains = await (prisma as any).domain.findMany({ where: { tenantId }, select: { id: true } }).catch(() => []);
    if (!domains.length) {
      return res.json({ tenantId, tenantLanguageCode, domainId: domainFilterId || null, categories: [] });
    }
    let targetDomainIds: string[];
    if (domainFilterId) {
      const ok = domains.some((d: any) => d.id === domainFilterId);
      if (!ok) return res.status(404).json({ error: 'Domain not found for tenant' });
      targetDomainIds = [domainFilterId];
    } else {
      targetDomainIds = domains.map((d: any) => d.id);
    }

    // Fetch domain-linked categories
    const domainCats = await (prisma as any).domainCategory.findMany({
      where: { domainId: { in: targetDomainIds } },
      include: { category: true }
    });
    const catMap = new Map<string, any>();
    for (const dc of domainCats || []) {
      if (dc?.category && !dc.category.isDeleted) catMap.set(dc.categoryId, dc.category);
    }
    const categories = Array.from(catMap.values());
    if (!categories.length) {
      return res.json({ tenantId, tenantLanguageCode, domainId: domainFilterId || null, categories: [] });
    }

    // Fetch translations for tenant language and English
    const ids = categories.map((c: any) => c.id);
    const langs = Array.from(new Set([tenantLanguageCode, englishCode].filter(Boolean))) as string[];
    const translations = langs.length
      ? await (prisma as any).categoryTranslation.findMany({ where: { categoryId: { in: ids }, language: { in: langs } } }).catch(() => [])
      : [];
    const tMap = new Map<string, string>();
    for (const t of translations) {
      const key = `${t.categoryId}::${t.language}`;
      tMap.set(key, String(t.name));
    }

    const shaped = categories
      .map((c: any) => {
        const nameEn = tMap.get(`${c.id}::${englishCode}`) || c.name;
        const nameTenant = tenantLanguageCode ? (tMap.get(`${c.id}::${tenantLanguageCode}`) || null) : null;
        const preferredName = nameTenant || c.name;
        return {
          id: c.id,
          slug: c.slug,
          parentId: c.parentId || null,
          iconUrl: c.iconUrl || null,
          name: preferredName,
          nameDefault: c.name,
          names: {
            ...(tenantLanguageCode ? { [tenantLanguageCode]: nameTenant } : {}),
            [englishCode]: nameEn,
          }
        };
      })
      .sort((a: any, b: any) => String(a.slug).localeCompare(String(b.slug)));

    return res.json({ tenantId, tenantLanguageCode, domainId: domainFilterId || null, categories: shaped });
  } catch (e: any) {
    console.error('categories/tenant error', e);
    return res.status(500).json({ error: 'Failed to list tenant categories' });
  }
});

/**
 * @swagger
 * /categories/{id}:
 *   patch:
 *     summary: Update a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the category to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCategoryDto'
 *     responses:
 *       200:
 *         description: Category updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found.
 */
router.patch('/:id', passport.authenticate('jwt', { session: false }), requireSuperAdmin, validationMiddleware(UpdateCategoryDto), async (req, res) => {
  try {
    const updatedCategory = await updateCategory(req.params.id, req.body);
    res.status(200).json(updatedCategory);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});


/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the category to delete.
 *     responses:
 *       204:
 *         description: Category deleted successfully.
 *       400:
 *         description: Deletion failed because the category has child relationships.
 *       404:
 *         description: Category not found.
 */
router.delete('/:id', passport.authenticate('jwt', { session: false }), requireSuperAdmin, async (req, res) => {
  try {
    await deleteCategory(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    if (error.message.includes('child relationships')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(404).json({ error: 'Category not found.' });
    }
  }
});

export default router;

/**
 * @swagger
 * /categories/{id}/retranslate:
 *   post:
 *     summary: Retranslate category into all active languages
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Retranslation triggered
 *       404:
 *         description: Category not found
 */
router.post('/:id/retranslate', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    await retranslateCategory(req.params.id);
    res.status(200).json({ success: true });
  } catch (error: any) {
    if ((error?.message || '').includes('not found')) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(500).json({ error: 'Failed to retranslate category' });
  }
});
