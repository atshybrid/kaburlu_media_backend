/**
 * Wallet & Billing API Routes
 */

import { Router } from 'express';
import passport from 'passport';
import {
  getWallet,
  topupWallet,
  topupBulk,
  adjustWallet,
  getTransactions,
  lockTenant,
  unlockTenant,
  getCurrentUsage,
  calculateBulkDiscountPreview,
} from './wallet.controller';
import { requireSuperAdmin } from '../../middleware/subscriptionAccess';

const router = Router();

// All wallet routes require JWT auth
router.use(passport.authenticate('jwt', { session: false }));

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/wallet:
 *   get:
 *     tags: [Tenant Subscription - Wallet Management]
 *     summary: Get tenant wallet balance
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet balance retrieved
 */
router.get('/admin/tenants/:tenantId/wallet', getWallet);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/wallet/topup:
 *   post:
 *     tags: [Tenant Subscription - Wallet Management]
 *     summary: Top-up tenant wallet
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
 *               - amountMinor
 *             properties:
 *               amountMinor:
 *                 type: integer
 *                 description: Amount in paise (₹100 = 10000)
 *               description:
 *                 type: string
 *               razorpayOrderId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet topped up successfully
 */
router.post('/admin/tenants/:tenantId/wallet/topup', topupWallet);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/wallet/topup-bulk:
 *   post:
 *     tags: [Tenant Subscription - Wallet Management]
 *     summary: Bulk payment with discount
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
 *               - months
 *             properties:
 *               months:
 *                 type: integer
 *                 description: Number of months (6 or 12 for discount)
 *               razorpayOrderId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk payment successful
 */
router.post('/admin/tenants/:tenantId/wallet/topup-bulk', topupBulk);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/wallet/calculate-bulk:
 *   post:
 *     tags: [Tenant Subscription - Wallet Management]
 *     summary: Calculate bulk discount (preview)
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
 *               - months
 *             properties:
 *               months:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Bulk discount calculation
 */
router.post('/admin/tenants/:tenantId/wallet/calculate-bulk', calculateBulkDiscountPreview);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/wallet/adjust:
 *   post:
 *     tags: [Tenant Subscription - Wallet Management]
 *     summary: Adjust wallet balance (super admin only)
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
 *               - amountMinor
 *               - description
 *             properties:
 *               amountMinor:
 *                 type: integer
 *                 description: Amount to add (+) or subtract (-)
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet adjusted successfully
 */
router.post('/admin/tenants/:tenantId/wallet/adjust', requireSuperAdmin, adjustWallet);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/wallet/transactions:
 *   get:
 *     tags: [Tenant Subscription - Wallet Management]
 *     summary: Get wallet transaction history
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CREDIT, DEBIT, LOCK, UNLOCK, REFUND, ADJUSTMENT]
 *     responses:
 *       200:
 *         description: Transaction history retrieved
 */
router.get('/admin/tenants/:tenantId/wallet/transactions', getTransactions);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/usage/current:
 *   get:
 *     tags: [Tenant Subscription - Billing & Usage]
 *     summary: Get current month usage
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current month usage retrieved
 */
router.get('/admin/tenants/:tenantId/usage/current', getCurrentUsage);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/lock:
 *   post:
 *     tags: [Tenant Subscription - Billing & Usage]
 *     summary: Lock tenant access
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tenant locked successfully
 */
router.post('/admin/tenants/:tenantId/lock', requireSuperAdmin, lockTenant);

/**
 * @swagger
 * /api/v1/admin/tenants/{tenantId}/unlock:
 *   post:
 *     tags: [Tenant Subscription - Billing & Usage]
 *     summary: Unlock tenant access
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tenant unlocked successfully
 */
router.post('/admin/tenants/:tenantId/unlock', requireSuperAdmin, unlockTenant);

export default router;
