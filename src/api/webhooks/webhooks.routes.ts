import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Webhooks
 *     description: External service callbacks (Razorpay, etc.)
 */

/**
 * @swagger
 * /webhooks/razorpay:
 *   post:
 *     summary: Razorpay payment webhook
 *     description: |
 *       Validates the X-Razorpay-Signature header using the shared webhook secret.
 *       On successful payment events, updates the related ReporterPayment row to PAID.
 *       Expected payload includes `payload.payment.entity.id` and notes with `reporterId`, `tenantId`, `type`.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Acknowledged }
 *       400: { description: Invalid signature or payload }
 */
router.post('/razorpay', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ error: 'Webhook secret not configured' });

    const signature = req.header('X-Razorpay-Signature');
    if (!signature) return res.status(400).json({ error: 'Missing signature header' });

    const bodyString = JSON.stringify(req.body || {});
    const expected = crypto
      .createHmac('sha256', secret)
      .update(bodyString)
      .digest('hex');
    if (expected !== signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    const paymentEntity = req.body?.payload?.payment?.entity;
    if (!paymentEntity) return res.status(400).json({ error: 'Payment entity missing' });

    const paymentId = paymentEntity.id;
    const orderId = paymentEntity.order_id;
    const status = paymentEntity.status; // captured, authorized, failed, etc.
    const notes = paymentEntity.notes || {};
    const reporterId = notes.reporterId;
    const tenantId = notes.tenantId;

    if (!orderId) return res.status(400).json({ error: 'order_id missing' });

    // Update ReporterPayment if captured
    if (status === 'captured') {
      const rp = await (prisma as any).reporterPayment.findFirst({ where: { razorpayOrderId: orderId } });
      if (rp) {
        await (prisma as any).reporterPayment.update({
          where: { id: rp.id },
          data: { status: 'PAID', razorpayPaymentId: paymentId, meta: paymentEntity }
        });
      }
    }

    res.json({ received: true, event, paymentStatus: status });
  } catch (e) {
    console.error('razorpay webhook error', e);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;