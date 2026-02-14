/**
 * Tenant Self-Service Wallet Routes
 */

import { Router } from 'express';
import passport from 'passport';
import {
  getMyWalletBalance,
  getMyWalletTransactions,
  getMyCurrentUsage,
  getMyInvoices,
  requestTopup,
} from './tenant.controller';

const router = Router();

// All tenant routes require JWT auth
router.use(passport.authenticate('jwt', { session: false }));

/**
 * @swagger
 * /api/v1/tenant/wallet/balance:
 *   get:
 *     tags: [Tenant Subscription - Self-Service]
 *     summary: Get my wallet balance
 *     responses:
 *       200:
 *         description: Wallet balance retrieved
 */
router.get('/tenant/wallet/balance', getMyWalletBalance);

/**
 * @swagger
 * /api/v1/tenant/wallet/transactions:
 *   get:
 *     tags: [Tenant Subscription - Self-Service]
 *     summary: Get my wallet transaction history
 *     parameters:
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
router.get('/tenant/wallet/transactions', getMyWalletTransactions);

/**
 * @swagger
 * /api/v1/tenant/usage/current-month:
 *   get:
 *     tags: [Tenant Subscription - Self-Service]
 *     summary: Get my current month usage
 *     responses:
 *       200:
 *         description: Current month usage retrieved
 */
router.get('/tenant/usage/current-month', getMyCurrentUsage);

/**
 * @swagger
 * /api/v1/tenant/invoices:
 *   get:
 *     tags: [Tenant Subscription - Self-Service]
 *     summary: Get my invoices
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, OPEN, PAID, VOID, PAST_DUE]
 *     responses:
 *       200:
 *         description: Invoices retrieved
 */
router.get('/tenant/invoices', getMyInvoices);

/**
 * @swagger
 * /api/v1/tenant/wallet/topup-request:
 *   post:
 *     tags: [Tenant Subscription - Self-Service]
 *     summary: Request wallet top-up
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
 *                 description: Amount in paise
 *               months:
 *                 type: integer
 *                 description: Number of months (optional, for bulk payment)
 *     responses:
 *       200:
 *         description: Top-up request created
 */
router.post('/tenant/wallet/topup-request', requestTopup);

export default router;
