import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdminScoped } from '../middlewares/authz';

// transient any-cast for newly added delegates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router({ mergeParams: true });
const auth = passport.authenticate('jwt', { session: false });

function getTenantStaticPageDelegate() {
  // Prisma client is generated from schema; if user hasn't run prisma generate yet,
  // the delegate won't exist at runtime.
  const delegate = (p as any)?.tenantStaticPage;
  return delegate || null;
}

function prismaDelegateMissingError() {
  return {
    error: 'TenantStaticPage model is not available in Prisma client',
    hint: 'Run `npm run prisma:generate` and apply migrations (dev: `npm run prisma:migrate:dev`, deploy: `npm run prisma:migrate:deploy`).'
  };
}

function normalizeSlug(input: any): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

/**
 * @swagger
 * tags:
 *   - name: Tenant Static Pages
 *     description: Tenant-scoped website pages like /about-us, /privacy-policy
 */

/**
 * @swagger
 * /tenants/{tenantId}/pages:
 *   get:
 *     summary: List tenant static pages (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     tags: [Tenant Static Pages]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List
 */
router.get('/tenants/:tenantId/pages', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const delegate = getTenantStaticPageDelegate();
    if (!delegate) return res.status(500).json(prismaDelegateMissingError());

    const { tenantId } = req.params;
    const items = await delegate.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, tenantId: true, slug: true, title: true, published: true, updatedAt: true, createdAt: true }
    });
    res.json(items);
  } catch (e) {
    console.error('tenantStaticPages list error', e);
    return res.status(500).json({ error: 'Failed to list tenant pages' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/pages/{slug}:
 *   get:
 *     summary: Get a tenant static page by slug (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     tags: [Tenant Static Pages]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, example: about-us }
 *     responses:
 *       200: { description: Page }
 *       404: { description: Not found }
 */
router.get('/tenants/:tenantId/pages/:slug', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const delegate = getTenantStaticPageDelegate();
    if (!delegate) return res.status(500).json(prismaDelegateMissingError());

    const { tenantId } = req.params;
    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const row = await delegate.findFirst({ where: { tenantId, slug } });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    console.error('tenantStaticPages get error', e);
    return res.status(500).json({ error: 'Failed to get tenant page' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/pages/{slug}:
 *   put:
 *     summary: Upsert a tenant static page (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     tags: [Tenant Static Pages]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, example: privacy-policy }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentHtml]
 *             properties:
 *               title: { type: string, nullable: true }
 *               contentHtml: { type: string }
 *               meta: { type: object, nullable: true }
 *               published: { type: boolean, default: true }
 *     responses:
 *       200: { description: Upserted page }
 */
router.put('/tenants/:tenantId/pages/:slug', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const delegate = getTenantStaticPageDelegate();
    if (!delegate) return res.status(500).json(prismaDelegateMissingError());

    const { tenantId } = req.params;
    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const body = req.body || {};
    const contentHtml = Object.prototype.hasOwnProperty.call(body, 'contentHtml') ? String(body.contentHtml || '') : '';
    if (!contentHtml) return res.status(400).json({ error: 'contentHtml is required' });

    const data: any = {
      tenantId,
      slug,
      contentHtml,
    };
    if (Object.prototype.hasOwnProperty.call(body, 'title')) data.title = body.title === null ? null : String(body.title);
    if (Object.prototype.hasOwnProperty.call(body, 'meta')) data.meta = body.meta === null ? null : body.meta;
    if (Object.prototype.hasOwnProperty.call(body, 'published')) data.published = Boolean(body.published);

    const row = await delegate.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      create: data,
      update: data,
    });

    res.json(row);
  } catch (e) {
    console.error('tenantStaticPages upsert error', e);
    return res.status(500).json({ error: 'Failed to upsert tenant page' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/pages/{slug}:
 *   patch:
 *     summary: Patch a tenant static page (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     tags: [Tenant Static Pages]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, nullable: true }
 *               contentHtml: { type: string }
 *               meta: { type: object, nullable: true }
 *               published: { type: boolean }
 *     responses:
 *       200: { description: Updated page }
 *       404: { description: Not found }
 */
router.patch('/tenants/:tenantId/pages/:slug', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const delegate = getTenantStaticPageDelegate();
    if (!delegate) return res.status(500).json(prismaDelegateMissingError());

    const { tenantId } = req.params;
    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const body = req.body || {};
    const data: any = {};
    if (Object.prototype.hasOwnProperty.call(body, 'title')) data.title = body.title === null ? null : String(body.title);
    if (Object.prototype.hasOwnProperty.call(body, 'contentHtml')) data.contentHtml = String(body.contentHtml || '');
    if (Object.prototype.hasOwnProperty.call(body, 'meta')) data.meta = body.meta === null ? null : body.meta;
    if (Object.prototype.hasOwnProperty.call(body, 'published')) data.published = Boolean(body.published);

    const existing = await delegate.findFirst({ where: { tenantId, slug }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const row = await delegate.update({ where: { id: existing.id }, data });
    res.json(row);
  } catch (e) {
    console.error('tenantStaticPages patch error', e);
    return res.status(500).json({ error: 'Failed to update tenant page' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/pages/{slug}:
 *   delete:
 *     summary: Delete a tenant static page (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     tags: [Tenant Static Pages]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             examples:
 *               ok:
 *                 value: { ok: true }
 *       404: { description: Not found }
 */
router.delete('/tenants/:tenantId/pages/:slug', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const delegate = getTenantStaticPageDelegate();
    if (!delegate) return res.status(500).json(prismaDelegateMissingError());

    const { tenantId } = req.params;
    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const existing = await delegate.findFirst({ where: { tenantId, slug }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await delegate.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('tenantStaticPages delete error', e);
    return res.status(500).json({ error: 'Failed to delete tenant page' });
  }
});

export default router;
