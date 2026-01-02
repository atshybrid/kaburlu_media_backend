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
 *       On captured payments, reconciles:
 *       - Tenant billing invoice payments (notes.type=TENANT_BILLING_INVOICE)
 *       - Reporter payments (legacy)
 *
 *       Header required: `X-Razorpay-Signature`.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           examples:
 *             tenantInvoiceCaptured:
 *               summary: Tenant billing invoice paid (subscription or topup)
 *               value:
 *                 event: "payment.captured"
 *                 payload:
 *                   payment:
 *                     entity:
 *                       id: "pay_ABC123"
 *                       order_id: "order_RZP_456"
 *                       status: "captured"
 *                       notes:
 *                         type: "TENANT_BILLING_INVOICE"
 *                         tenantId: "tenant_01"
 *                         invoiceId: "inv_01"
 *                         kind: "SUBSCRIPTION"
 *             designTopupCaptured:
 *               summary: Design-page topup invoice paid (credits will be added)
 *               value:
 *                 event: "payment.captured"
 *                 payload:
 *                   payment:
 *                     entity:
 *                       id: "pay_DEF456"
 *                       order_id: "order_RZP_789"
 *                       status: "captured"
 *                       notes:
 *                         type: "TENANT_BILLING_INVOICE"
 *                         tenantId: "tenant_01"
 *                         invoiceId: "inv_topup_01"
 *                         kind: "TOPUP"
 *                         component: "NEWSPAPER_DESIGN_PAGE"
 *                         pages: 60
 *             reporterOnboardingCaptured:
 *               summary: Reporter onboarding payment paid (legacy flow)
 *               value:
 *                 event: "payment.captured"
 *                 payload:
 *                   payment:
 *                     entity:
 *                       id: "pay_XYZ000"
 *                       order_id: "order_RZP_111"
 *                       status: "captured"
 *                       notes:
 *                         reporterId: "rep_01"
 *                         tenantId: "tenant_01"
 *                         type: "ONBOARDING"
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

    const bodyString = ((req as any).rawBody ? (req as any).rawBody.toString('utf8') : null) || JSON.stringify(req.body || {});
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
    const tenantIdFromNotes = notes.tenantId;
    const invoiceIdFromNotes = notes.invoiceId;
    const typeFromNotes = notes.type;

    if (!orderId) return res.status(400).json({ error: 'order_id missing' });

    function nowUtcYearMonth() {
      const now = new Date();
      return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, now };
    }

    function pickReporterLimitMax(settingsData: any, input: { designationId: string; level: string; location: { field: string; id: string } }): number | undefined {
      const limits = settingsData?.reporterLimits;
      // Limits are always enforced. Default is max=1 when not configured.
      if (!limits) return 1;

      const rules: any[] = Array.isArray(limits.rules) ? limits.rules : [];
      const defaultMax = typeof limits.defaultMax === 'number' ? limits.defaultMax : 1;

      const locationField = input.location.field;
      const locationId = input.location.id;

      const exact = rules.find(
        (r) =>
          String(r?.designationId || '') === input.designationId &&
          String(r?.level || '') === input.level &&
          String(r?.[locationField] || '') === locationId
      );
      if (typeof exact?.max === 'number') return exact.max;

      const wildcardLocation = rules.find(
        (r) =>
          String(r?.designationId || '') === input.designationId &&
          String(r?.level || '') === input.level &&
          !r?.stateId &&
          !r?.districtId &&
          !r?.mandalId &&
          !r?.assemblyConstituencyId
      );
      if (typeof wildcardLocation?.max === 'number') return wildcardLocation.max;

      const wildcardDesignation = rules.find((r) => String(r?.designationId || '') === input.designationId && !r?.level);
      if (typeof wildcardDesignation?.max === 'number') return wildcardDesignation.max;

      return defaultMax;
    }

    // Update ReporterPayment if captured
    if (status === 'captured') {
      // Tenant Billing invoice payment
      if (invoiceIdFromNotes && tenantIdFromNotes && String(typeFromNotes) === 'TENANT_BILLING_INVOICE') {
        const tenantId = String(tenantIdFromNotes);
        const inv = await (prisma as any)
          .billingInvoice
          .findFirst({ where: { id: String(invoiceIdFromNotes), tenantId }, include: { lineItems: true } })
          .catch(() => null);

        if (inv?.id && String(inv.status) !== 'PAID') {
          await (prisma as any).$transaction(async (tx: any) => {
            // Mark invoice as paid
            await tx.billingInvoice.update({
              where: { id: inv.id },
              data: {
                status: 'PAID',
                razorpayOrderId: orderId || inv.razorpayOrderId,
                razorpayPaymentId: paymentId,
                paidAt: new Date(),
                meta: paymentEntity,
              },
            });

            // Prepaid credit top-ups: add credits once
            if (String(inv.kind) === 'TOPUP') {
              const items = Array.isArray(inv.lineItems) ? inv.lineItems : [];
              for (const li of items) {
                const component = li?.component ? String(li.component) : null;
                const qty = typeof li?.quantity === 'number' ? li.quantity : parseInt(String(li?.quantity ?? 0), 10);
                if (!component || !Number.isFinite(qty) || qty <= 0) continue;

                // Currently only design pages are used for prepaid credits
                if (component === 'NEWSPAPER_DESIGN_PAGE') {
                  await tx.billingCreditBalance.upsert({
                    where: { tenantId_component: { tenantId, component } },
                    create: { tenantId, component, balance: qty },
                    update: { balance: { increment: qty } },
                  });
                }
              }
            }
          });
        }
      }

      const rp = await (prisma as any).reporterPayment.findFirst({ where: { razorpayOrderId: orderId } }).catch(() => null);
      if (rp) {
        await (prisma as any).reporterPayment
          .update({
            where: { id: rp.id },
            data: { status: 'PAID', razorpayPaymentId: paymentId, meta: paymentEntity },
          })
          .catch(() => null);

        // Backward compatible: onboarding payment captured after reporter already exists.
        if (String(rp.type) === 'ONBOARDING') {
          const rep = await (prisma as any)
            .reporter.findUnique({ where: { id: rp.reporterId }, select: { id: true, active: true, userId: true } })
            .catch(() => null);
          if (rep?.id && rep.active !== true) {
            await (prisma as any).reporter.update({ where: { id: rep.id }, data: { active: true } }).catch(() => null);
          }
          if (rep?.userId) {
            const reporterRole = await (prisma as any).role.findFirst({ where: { name: 'REPORTER' }, select: { id: true } }).catch(() => null);
            if (reporterRole?.id) {
              await (prisma as any).user.update({ where: { id: rep.userId }, data: { roleId: reporterRole.id } }).catch(() => null);
            }
          }
        }
      } else {
        // Payment-first public join: create reporter/user AFTER payment using ReporterOnboardingOrder
        const onboarding = await (prisma as any).reporterOnboardingOrder.findUnique({ where: { razorpayOrderId: orderId } }).catch(() => null);
        if (onboarding?.id) {
          // Mark onboarding order as paid (idempotent)
          await (prisma as any).reporterOnboardingOrder
            .update({
              where: { id: onboarding.id },
              data: { status: 'PAID', razorpayPaymentId: paymentId, meta: paymentEntity },
            })
            .catch(() => null);

          const tenantId = String(onboarding.tenantId);

          // Re-check limits at capture time (to avoid over-allocating if multiple people paid simultaneously)
          const settingsRow = await (prisma as any).tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null);

          const location: { field: string; id: string } | null = onboarding.stateId
            ? { field: 'stateId', id: String(onboarding.stateId) }
            : onboarding.districtId
              ? { field: 'districtId', id: String(onboarding.districtId) }
              : onboarding.assemblyConstituencyId
                ? { field: 'assemblyConstituencyId', id: String(onboarding.assemblyConstituencyId) }
                : onboarding.mandalId
                  ? { field: 'mandalId', id: String(onboarding.mandalId) }
                  : null;

          const designationId = String(onboarding.designationId);
          const level = String(onboarding.level);
          const maxAllowed = location ? pickReporterLimitMax(settingsRow?.data, { designationId, level, location }) : undefined;
          if (location && typeof maxAllowed === 'number') {
            const where: any = { tenantId, active: true, designationId, level };
            where[location.field] = location.id;
            const current = await (prisma as any).reporter.count({ where }).catch(() => 0);
            if (current >= maxAllowed) {
              await (prisma as any).reporterOnboardingOrder
                .update({ where: { id: onboarding.id }, data: { status: 'PAID_NO_SLOT' } })
                .catch(() => null);
              return res.json({ received: true, event, paymentStatus: status, conflict: true, reason: 'LIMIT_REACHED_AFTER_PAYMENT' });
            }
          }

          // Ensure role REPORTER
          const reporterRole = await (prisma as any).role.findFirst({ where: { name: 'REPORTER' }, select: { id: true } }).catch(() => null);
          if (!reporterRole?.id) {
            return res.status(500).json({ error: 'Role REPORTER not configured' });
          }

          // Find or create user
          const existingUser = await (prisma as any).user.findFirst({ where: { mobileNumber: String(onboarding.mobileNumber) } }).catch(() => null);

          let userId: string;
          if (existingUser?.id) {
            userId = existingUser.id;
            await (prisma as any).user.update({ where: { id: userId }, data: { roleId: reporterRole.id } }).catch(() => null);
          } else {
            // Fallback language resolution
            let languageId = onboarding.languageId ? String(onboarding.languageId) : null;
            if (!languageId) {
              const entity = await (prisma as any).tenantEntity.findUnique({ where: { tenantId }, select: { languageId: true } }).catch(() => null);
              languageId = entity?.languageId || null;
            }
            if (!languageId) {
              const te = await (prisma as any).language.findFirst({ where: { code: 'te' }, select: { id: true } }).catch(() => null);
              languageId = te?.id || null;
            }
            if (!languageId) {
              const anyLang = await (prisma as any).language.findFirst({ select: { id: true } }).catch(() => null);
              languageId = anyLang?.id || null;
            }
            if (!languageId) {
              return res.status(500).json({ error: 'No languages configured' });
            }

            const createdUser = await (prisma as any).user.create({
              data: { mobileNumber: String(onboarding.mobileNumber), roleId: reporterRole.id, languageId },
              select: { id: true },
            });
            userId = createdUser.id;
          }

          // Ensure profile
          const fullName = String(onboarding.fullName || '').trim();
          const profile = await (prisma as any).userProfile.findUnique({ where: { userId } }).catch(() => null);
          if (!profile) {
            await (prisma as any).userProfile.create({ data: { userId, fullName } }).catch(() => null);
          } else if (!profile.fullName && fullName) {
            await (prisma as any).userProfile.update({ where: { userId }, data: { fullName } }).catch(() => null);
          }

          // If reporter already exists, mark onboarding as duplicate
          const existingReporter = await (prisma as any).reporter.findFirst({ where: { tenantId, userId } }).catch(() => null);
          let reporterId: string;
          if (existingReporter?.id) {
            reporterId = existingReporter.id;
            await (prisma as any).reporterOnboardingOrder.update({ where: { id: onboarding.id }, data: { status: 'DUPLICATE' } }).catch(() => null);
          } else {
            const createData: any = {
              tenantId,
              userId,
              designationId,
              level,
              subscriptionActive: true,
              monthlySubscriptionAmount: onboarding.monthlySubscriptionAmount || 0,
              idCardCharge: onboarding.idCardCharge || 0,
              active: true,
            };
            if (onboarding.stateId) createData.stateId = onboarding.stateId;
            if (onboarding.districtId) createData.districtId = onboarding.districtId;
            if (onboarding.mandalId) createData.mandalId = onboarding.mandalId;
            if (onboarding.assemblyConstituencyId) createData.assemblyConstituencyId = onboarding.assemblyConstituencyId;

            const createdReporter = await (prisma as any).reporter.create({ data: createData, select: { id: true } });
            reporterId = createdReporter.id;
          }

          // Create payment record as PAID if not exists
          const existingByOrder = await (prisma as any).reporterPayment.findFirst({ where: { razorpayOrderId: orderId } }).catch(() => null);
          if (!existingByOrder?.id) {
            const { year, month, now } = nowUtcYearMonth();
            await (prisma as any).reporterPayment
              .create({
                data: {
                  reporterId,
                  tenantId,
                  type: 'ONBOARDING',
                  year,
                  month,
                  amount: onboarding.amount,
                  currency: onboarding.currency || 'INR',
                  status: 'PAID',
                  razorpayOrderId: orderId,
                  razorpayPaymentId: paymentId,
                  meta: paymentEntity,
                  expiresAt: onboarding.expiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000),
                },
              })
              .catch(() => null);
          }
        }
      }
    }

    res.json({ received: true, event, paymentStatus: status });
  } catch (e) {
    console.error('razorpay webhook error', e);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * @swagger
 * /webhooks/ai-rewrite-status:
 *   post:
 *     summary: AI rewrite completion callback (internal)
 *     description: |
 *       Receiver for AI callbackUrl notifications from the AI queue runner.
 *       If AI_CALLBACK_SECRET is configured, clients must send header X-AI-Callback-Secret.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Acknowledged }
 *       401: { description: Missing/invalid callback secret }
 */
router.post('/ai-rewrite-status', async (req, res) => {
  try {
    const expected = String(process.env.AI_CALLBACK_SECRET || '').trim();
    if (expected) {
      const got = String(req.header('X-AI-Callback-Secret') || '').trim();
      if (!got || got !== expected) {
        return res.status(401).json({ error: 'Invalid callback secret' });
      }
    }

    const payload = req.body || {};
    // eslint-disable-next-line no-console
    console.log('[webhook] ai-rewrite-status', {
      status: payload?.status,
      articleId: payload?.articleId,
      tenantId: payload?.tenantId,
      webArticleId: payload?.webArticleId,
      shortNewsId: payload?.shortNewsId,
      newspaperArticleId: payload?.newspaperArticleId,
      externalArticleId: payload?.externalArticleId,
      finishedAt: payload?.finishedAt,
      error: payload?.error,
    });

    return res.json({ received: true });
  } catch (e) {
    console.error('ai-rewrite-status webhook error', e);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;