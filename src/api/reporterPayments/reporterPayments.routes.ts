import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { getRazorpayClientForTenant } from './razorpay.service';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Reporter Payments
 *     description: Annual subscription/payment tracking
 */

/**
 * @swagger
 * /reporter-payments:
 *   get:
 *     summary: List reporter payments (demo)
 *     tags: [Reporter Payments]
 *     responses:
 *       200: { description: List payments }
 */
/**
 * @swagger
 * /reporter-payments:
 *   get:
 *     summary: List recent reporter payments (admin/debug)
 *     tags: [Reporter Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: take
 *         schema: { type: integer, minimum: 1, maximum: 500, default: 100 }
 *         description: Max number of rows to return.
 *     responses:
 *       200:
 *         description: Array of ReporterPayment rows
 */
router.get('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const take = Math.min(Math.max(parseInt(String(req.query.take || '100'), 10), 1), 500);
  const payments = await (prisma as any).reporterPayment.findMany({ take, orderBy: { createdAt: 'desc' } });
  res.json(payments);
});

  /**
   * @swagger
   * /tenants/{tenantId}/reporters/{id}/payments/order:
   *   post:
   *     summary: Create Razorpay order for reporter onboarding/subscription
   *     tags: [Reporter Payments]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: tenantId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               mode:
   *                 type: string
   *                 enum: [ONBOARDING, MONTHLY_SUBSCRIPTION]
   *                 default: ONBOARDING
   *     responses:
   *       201: { description: Razorpay order created }
   *       400: { description: Validation error }
   *       404: { description: Reporter not found }
   */
  router.post('/tenants/:tenantId/reporters/:id/payments/order', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
      const { tenantId, id } = req.params;
      const { mode } = req.body || {};
      const type = mode === 'MONTHLY_SUBSCRIPTION' ? 'MONTHLY_SUBSCRIPTION' : 'ONBOARDING';

      const reporter = await (prisma as any).reporter.findFirst({ where: { id, tenantId } });
      if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

      const idCardAmount = reporter.idCardCharge || 0;
      const subscriptionAmount = reporter.subscriptionActive ? (reporter.monthlySubscriptionAmount || 0) : 0;

      let amount = 0;
      if (type === 'ONBOARDING') {
        amount = idCardAmount + subscriptionAmount;
      } else {
        amount = subscriptionAmount;
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'No payable amount for this reporter' });
      }

      const razorpay = await getRazorpayClientForTenant(tenantId);
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;

      const shortReporterId = id.slice(0, 12);
      let receipt = `REP-${shortReporterId}-${Date.now()}`;
      if (receipt.length > 40) {
        receipt = receipt.slice(0, 40);
      }

      const order = await (razorpay as any).orders.create({
        amount,
        currency: 'INR',
        receipt,
        notes: { tenantId, reporterId: id, type },
      });

      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const paymentRecord = await (prisma as any).reporterPayment.create({
        data: {
          reporterId: reporter.id,
          tenantId,
          type,
          year,
          month,
          amount,
          currency: 'INR',
          status: 'PENDING',
          razorpayOrderId: order.id,
          meta: order,
          expiresAt,
        },
      });

      res.status(201).json({
        orderId: order.id,
        amount,
        currency: 'INR',
        type,
        idCardAmount,
        subscriptionAmount,
        reporterPaymentId: paymentRecord.id,
      });
    } catch (e: any) {
      console.error('create reporter payment order error', e);
      if (e && e.message) {
        return res.status(500).json({ error: e.message });
      }
      res.status(500).json({ error: 'Failed to create reporter payment order' });
    }
  });

export default router;
