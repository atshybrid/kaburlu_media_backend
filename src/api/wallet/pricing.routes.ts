/**
 * Tenant Pricing Management Routes
 */

import { Router } from 'express';
import passport from 'passport';
import {
  getTenantPricing,
  setTenantPricing,
  updateTenantPricing,
  deleteTenantPricing,
  getTenantServices,
  toggleTenantService,
} from './pricing.controller';
import { requireSuperAdmin } from '../../middleware/subscriptionAccess';

const router = Router();

// All pricing routes require JWT auth (scoped so this router can be mounted at '/')
router.use('/admin', passport.authenticate('jwt', { session: false }));
router.use('/admin', requireSuperAdmin);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/pricing:
 *   get:
 *     tags: [Tenant Subscription - Pricing Configuration]
 *     summary: Get tenant pricing configuration
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pricing configuration retrieved
 */
router.get('/admin/tenants/:tenantId/pricing', getTenantPricing);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/pricing:
 *   post:
 *     tags: [Tenant Subscription - Pricing Configuration]
 *     summary: Set tenant pricing
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
 *             required:
 *               - service
 *             properties:
 *               service:
 *                 type: string
 *                 enum: [EPAPER, NEWS_WEBSITE, PRINT_SERVICE, CUSTOM_SERVICE]
 *               minEpaperPages:
 *                 type: integer
 *                 default: 8
 *               pricePerPageMinor:
 *                 type: integer
 *                 description: Price per ePaper page in paise (₹2000 = 200000)
 *               monthlyFeeMinor:
 *                 type: integer
 *                 description: Fixed monthly fee in paise
 *               discount6MonthPercent:
 *                 type: number
 *                 default: 5.0
 *               discount12MonthPercent:
 *                 type: number
 *                 default: 15.0
 *               effectiveFrom:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Pricing set successfully
 */
router.post('/admin/tenants/:tenantId/pricing', setTenantPricing);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/pricing/{pricingId}:
 *   put:
 *     tags: [Tenant Subscription - Pricing Configuration]
 *     summary: Update tenant pricing
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: pricingId
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
 *               minEpaperPages:
 *                 type: integer
 *               pricePerPageMinor:
 *                 type: integer
 *               monthlyFeeMinor:
 *                 type: integer
 *               discount6MonthPercent:
 *                 type: number
 *               discount12MonthPercent:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Pricing updated successfully
 */
router.put('/admin/tenants/:tenantId/pricing/:pricingId', updateTenantPricing);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/pricing/{pricingId}:
 *   delete:
 *     tags: [Tenant Subscription - Pricing Configuration]
 *     summary: Delete tenant pricing
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: pricingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pricing deleted successfully
 */
router.delete('/admin/tenants/:tenantId/pricing/:pricingId', deleteTenantPricing);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/services:
 *   get:
 *     tags: [Tenant Subscription - Pricing Configuration]
 *     summary: Get tenant active services summary
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Active services retrieved
 */
router.get('/admin/tenants/:tenantId/services', getTenantServices);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/services/{service}/toggle:
 *   post:
 *     tags: [Tenant Subscription - Pricing Configuration]
 *     summary:  Activate or deactivate a tenant service
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: service
 *         required: true
 *         schema:
 *           type: string
 *           enum: [EPAPER, NEWS_WEBSITE, PRINT_SERVICE, CUSTOM_SERVICE]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activate
 *             properties:
 *               activate:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Service toggled successfully
 */
router.post('/admin/tenants/:tenantId/services/:service/toggle', toggleTenantService);

export default router;
