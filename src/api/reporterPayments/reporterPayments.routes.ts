import { Router } from 'express';
import passport from 'passport';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { getRazorpayClientForTenant, getRazorpayConfigForTenant } from './razorpay.service';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Reporter Payments
 *     description: |
 *       Reporter payment management APIs for annual subscription and ID card payments.
 *       
 *       ## Payment Flow
 *       1. **Create Order** - POST `/tenants/{tenantId}/reporters/{id}/payments/order`
 *       2. **Frontend Razorpay Checkout** - Use the returned `razorpayKeyId` and `orderId`
 *       3. **Verify Payment** - POST `/tenants/{tenantId}/reporters/{id}/payments/verify`
 *       
 *       ## Payment Types
 *       - `ONBOARDING` - Initial payment (ID Card + Subscription)
 *       - `MONTHLY_SUBSCRIPTION` - Monthly subscription renewal
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
   *     description: |
   *       Creates a Razorpay order for reporter payment. Returns order details including
   *       the Razorpay Key ID needed for frontend checkout.
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
   *       201:
   *         description: Razorpay order created
   *         content:
   *           application/json:
   *             examples:
   *               sample:
   *                 value:
   *                   orderId: "order_NxYz123456"
   *                   amount: 19900
   *                   currency: "INR"
   *                   type: "MONTHLY_SUBSCRIPTION"
   *                   idCardAmount: 0
   *                   subscriptionAmount: 19900
   *                   reporterPaymentId: "pay_01HPAY1"
   *                   razorpayKeyId: "rzp_live_XXXXXXXXXX"
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

      // Get Razorpay config to include keyId in response
      const razorpayConfig = await (prisma as any).razorpayConfig.findFirst({
        where: {
          OR: [{ tenantId }, { tenantId: null }],
          active: true,
        },
        orderBy: { tenantId: 'desc' },
        select: { keyId: true },
      });

      if (!razorpayConfig?.keyId) {
        return res.status(500).json({ error: 'Razorpay configuration not found' });
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
        razorpayKeyId: razorpayConfig.keyId,
      });
    } catch (e: any) {
      console.error('create reporter payment order error', e);
      if (e && e.message) {
        return res.status(500).json({ error: e.message });
      }
      res.status(500).json({ error: 'Failed to create reporter payment order' });
    }
  });

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/payments/verify:
 *   post:
 *     summary: Verify Razorpay payment and update reporter status
 *     description: |
 *       Verifies the Razorpay payment signature and updates the reporter's payment status to PAID.
 *       This should be called after successful Razorpay checkout.
 *       
 *       On successful verification:
 *       - Reporter's `paymentStatus` is updated to `PAID`
 *       - `subscriptionExpiry` is set to 1 year from now
 *       - Payment record status is updated to `SUCCESS`
 *     tags: [Reporter Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: Tenant ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Reporter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *                 description: Order ID from Razorpay
 *                 example: "order_NxYz123456"
 *               razorpay_payment_id:
 *                 type: string
 *                 description: Payment ID from Razorpay
 *                 example: "pay_AbCd789012"
 *               razorpay_signature:
 *                 type: string
 *                 description: HMAC SHA256 signature from Razorpay
 *                 example: "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Payment verified successfully"
 *                 reporter:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     paymentStatus:
 *                       type: string
 *                       example: "PAID"
 *                     subscriptionExpiry:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid signature or missing parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid payment signature"
 *       404:
 *         description: Payment record not found
 */
router.post('/tenants/:tenantId/reporters/:id/payments/verify', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required payment parameters' });
    }

    // Find the payment record
    const paymentRecord = await (prisma as any).reporterPayment.findFirst({
      where: { razorpayOrderId: razorpay_order_id, reporterId: id, tenantId },
    });

    if (!paymentRecord) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Get Razorpay config for signature verification
    const razorpayConfig = await getRazorpayConfigForTenant(tenantId);
    if (!razorpayConfig?.keySecret) {
      return res.status(500).json({ error: 'Razorpay configuration not found' });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', razorpayConfig.keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Update payment status to EXPIRED (signature verification failed)
      await (prisma as any).reporterPayment.update({
        where: { id: paymentRecord.id },
        data: { status: 'EXPIRED', razorpayPaymentId: razorpay_payment_id },
      });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Signature valid - update payment and reporter
    const subscriptionExpiry = new Date();
    subscriptionExpiry.setFullYear(subscriptionExpiry.getFullYear() + 1);

    const [updatedPayment, updatedReporter] = await (prisma as any).$transaction([
      (prisma as any).reporterPayment.update({
        where: { id: paymentRecord.id },
        data: {
          status: 'PAID',
          razorpayPaymentId: razorpay_payment_id,
          paidAt: new Date(),
        },
      }),
      (prisma as any).reporter.update({
        where: { id },
        data: {
          paymentStatus: 'PAID',
          subscriptionExpiry,
        },
        select: {
          id: true,
          paymentStatus: true,
          subscriptionExpiry: true,
        },
      }),
    ]);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      reporter: updatedReporter,
    });
  } catch (e: any) {
    console.error('verify payment error', e);
    res.status(500).json({ error: e.message || 'Failed to verify payment' });
  }
});

/**
 * @swagger
 * /public/reporter-payments/verify:
 *   post:
 *     summary: Verify Razorpay payment (PUBLIC - no auth required)
 *     description: |
 *       Public endpoint for verifying Razorpay payments without JWT authentication.
 *       Used by mobile apps when reporter hasn't logged in yet (402 payment flow).
 *       
 *       The razorpay_order_id is used to look up the payment record and tenant context.
 *       
 *       On successful verification:
 *       - Reporter's `paymentStatus` is updated to `PAID`
 *       - `subscriptionExpiry` is set to 1 year from now
 *       - Payment record status is updated to `SUCCESS`
 *       - Returns success so app can retry login
 *     tags: [Reporter Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *                 description: Order ID from Razorpay
 *                 example: "order_NxYz123456"
 *               razorpay_payment_id:
 *                 type: string
 *                 description: Payment ID from Razorpay
 *                 example: "pay_AbCd789012"
 *               razorpay_signature:
 *                 type: string
 *                 description: HMAC SHA256 signature from Razorpay
 *                 example: "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Payment verified successfully. You can now login."
 *                 reporter:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     paymentStatus:
 *                       type: string
 *                       example: "PAID"
 *       400:
 *         description: Invalid signature or missing parameters
 *       404:
 *         description: Payment record not found
 */
router.post('/public/reporter-payments/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required payment parameters' });
    }

    // Find the payment record by order ID (no tenantId/reporterId needed)
    const paymentRecord = await (prisma as any).reporterPayment.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
      include: { reporter: { select: { id: true, tenantId: true } } }
    });

    if (!paymentRecord) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const { tenantId, id: reporterId } = paymentRecord.reporter;

    // Get Razorpay config for signature verification
    const razorpayConfig = await getRazorpayConfigForTenant(tenantId);
    if (!razorpayConfig?.keySecret) {
      return res.status(500).json({ error: 'Razorpay configuration not found' });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', razorpayConfig.keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Update payment status to EXPIRED (signature verification failed)
      await (prisma as any).reporterPayment.update({
        where: { id: paymentRecord.id },
        data: { status: 'EXPIRED', razorpayPaymentId: razorpay_payment_id },
      });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Signature valid - update payment and reporter
    const subscriptionExpiry = new Date();
    subscriptionExpiry.setFullYear(subscriptionExpiry.getFullYear() + 1);

    const [updatedPayment, updatedReporter] = await (prisma as any).$transaction([
      (prisma as any).reporterPayment.update({
        where: { id: paymentRecord.id },
        data: {
          status: 'PAID',
          razorpayPaymentId: razorpay_payment_id,
          paidAt: new Date(),
        },
      }),
      (prisma as any).reporter.update({
        where: { id: reporterId },
        data: {
          paymentStatus: 'PAID',
          subscriptionExpiry,
        },
        select: {
          id: true,
          paymentStatus: true,
          subscriptionExpiry: true,
        },
      }),
    ]);

    res.json({
      success: true,
      message: 'Payment verified successfully. You can now login.',
      reporter: updatedReporter,
    });
  } catch (e: any) {
    console.error('public verify payment error', e);
    res.status(500).json({ error: e.message || 'Failed to verify payment' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/payments:
 *   get:
 *     summary: Get payment history for a reporter
 *     description: Returns all payment records for a specific reporter, ordered by most recent first.
 *     tags: [Reporter Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: Tenant ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Reporter ID
 *     responses:
 *       200:
 *         description: List of payment records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [ONBOARDING, MONTHLY_SUBSCRIPTION]
 *                       amount:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [PENDING, SUCCESS, FAILED]
 *                       razorpayOrderId:
 *                         type: string
 *                       razorpayPaymentId:
 *                         type: string
 *                       paidAt:
 *                         type: string
 *                         format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *             examples:
 *               sample:
 *                 value:
 *                   payments:
 *                     - id: "pay_01HPAY1"
 *                       type: "ONBOARDING"
 *                       amount: 19900
 *                       currency: "INR"
 *                       status: "SUCCESS"
 *                       razorpayOrderId: "order_NxYz123"
 *                       razorpayPaymentId: "pay_AbCd789"
 *                       paidAt: "2026-01-25T10:30:00.000Z"
 *                       createdAt: "2026-01-25T10:25:00.000Z"
 */
router.get('/tenants/:tenantId/reporters/:id/payments', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const payments = await (prisma as any).reporterPayment.findMany({
      where: { reporterId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        status: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        paidAt: true,
        createdAt: true,
      },
    });

    res.json({ payments });
  } catch (e: any) {
    console.error('get payment history error', e);
    res.status(500).json({ error: e.message || 'Failed to fetch payment history' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/payments/status:
 *   get:
 *     summary: Get reporter's current payment status
 *     description: Returns the reporter's current payment status, subscription expiry, and pending payments.
 *     tags: [Reporter Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: Tenant ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Reporter ID
 *     responses:
 *       200:
 *         description: Payment status details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentStatus:
 *                   type: string
 *                   enum: [PENDING, PAID]
 *                 subscriptionExpiry:
 *                   type: string
 *                   format: date-time
 *                 isSubscriptionActive:
 *                   type: boolean
 *                 daysUntilExpiry:
 *                   type: number
 *                 pendingPayment:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     orderId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *             examples:
 *               active:
 *                 value:
 *                   paymentStatus: "PAID"
 *                   subscriptionExpiry: "2027-01-25T00:00:00.000Z"
 *                   isSubscriptionActive: true
 *                   daysUntilExpiry: 365
 *                   pendingPayment: null
 *               pending:
 *                 value:
 *                   paymentStatus: "PENDING"
 *                   subscriptionExpiry: null
 *                   isSubscriptionActive: false
 *                   daysUntilExpiry: 0
 *                   pendingPayment:
 *                     orderId: "order_NxYz123"
 *                     amount: 19900
 *                     expiresAt: "2026-01-26T10:30:00.000Z"
 *       404:
 *         description: Reporter not found
 */
router.get('/tenants/:tenantId/reporters/:id/payments/status', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        paymentStatus: true,
        subscriptionExpiry: true,
      },
    });

    if (!reporter) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    // Check for pending payment
    const pendingPayment = await (prisma as any).reporterPayment.findFirst({
      where: {
        reporterId: id,
        tenantId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        razorpayOrderId: true,
        amount: true,
        expiresAt: true,
      },
    });

    const now = new Date();
    const expiry = reporter.subscriptionExpiry ? new Date(reporter.subscriptionExpiry) : null;
    const isSubscriptionActive = expiry ? expiry > now : false;
    const daysUntilExpiry = expiry && isSubscriptionActive
      ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      paymentStatus: reporter.paymentStatus || 'PENDING',
      subscriptionExpiry: reporter.subscriptionExpiry,
      isSubscriptionActive,
      daysUntilExpiry,
      pendingPayment: pendingPayment
        ? {
            orderId: pendingPayment.razorpayOrderId,
            amount: pendingPayment.amount,
            expiresAt: pendingPayment.expiresAt,
          }
        : null,
    });
  } catch (e: any) {
    console.error('get payment status error', e);
    res.status(500).json({ error: e.message || 'Failed to fetch payment status' });
  }
});

export default router;
