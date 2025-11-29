import { Router } from 'express';
import passport from 'passport';
import { getEntitySettings, upsertEntitySettings, getTenantSettings, upsertTenantSettings, getDomainSettings, upsertDomainSettings, listDomainSettings } from './settings.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Settings
 *     description: Entity, tenant and domain settings
 */

/** Entity Settings (SUPER_ADMIN) */
/**
 * @swagger
 * /entity/settings:
 *   get:
 *     summary: Get global entity settings
 *     tags: [Settings]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Settings JSON
 *   put:
 *     summary: Replace global entity settings
 *     tags: [Settings]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated settings
 *   patch:
 *     summary: Update parts of entity settings
 *     tags: [Settings]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 */
router.get('/entity/settings', passport.authenticate('jwt', { session: false }), getEntitySettings);
router.put('/entity/settings', passport.authenticate('jwt', { session: false }), upsertEntitySettings);
router.patch('/entity/settings', passport.authenticate('jwt', { session: false }), upsertEntitySettings);

/** Tenant Settings */
/**
 * @swagger
 * /tenants/{tenantId}/settings:
 *   get:
 *     summary: Get tenant settings (resolved)
 *     tags: [Settings]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant settings with effective merged defaults
 *   put:
 *     summary: Replace tenant settings
 *     tags: [Settings]
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
 *   patch:
 *     summary: Update parts of tenant settings
 *     tags: [Settings]
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
 */
router.get('/tenants/:tenantId/settings', passport.authenticate('jwt', { session: false }), getTenantSettings);
router.put('/tenants/:tenantId/settings', passport.authenticate('jwt', { session: false }), upsertTenantSettings);
router.patch('/tenants/:tenantId/settings', passport.authenticate('jwt', { session: false }), upsertTenantSettings);

/** Domain Settings */
/**
 * @swagger
 * /tenants/{tenantId}/domains/{domainId}/settings:
 *   get:
 *     summary: Get domain settings (resolved)
 *     tags: [Settings]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: domainId
 *         required: true
 *         schema: { type: string }
 *   put:
 *     summary: Replace domain settings
 *     tags: [Settings]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *   patch:
 *     summary: Update parts of domain settings
 *     tags: [Settings]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 */
router.get('/tenants/:tenantId/domains/:domainId/settings', passport.authenticate('jwt', { session: false }), getDomainSettings);
router.put('/tenants/:tenantId/domains/:domainId/settings', passport.authenticate('jwt', { session: false }), upsertDomainSettings);
router.patch('/tenants/:tenantId/domains/:domainId/settings', passport.authenticate('jwt', { session: false }), upsertDomainSettings);

/**
 * @swagger
 * /tenants/{tenantId}/domains/settings:
 *   get:
 *     summary: List domain settings for tenant
 *     tags: [Settings]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated domain settings
 */
router.get('/tenants/:tenantId/domains/settings', passport.authenticate('jwt', { session: false }), listDomainSettings);

export default router;