import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { config } from '../../config/env';
import { sendWhatsappTextMessage, sendWhatsappButtons, sendWhatsappList } from '../../lib/whatsapp';

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
 * /webhooks/whatsapp:
 *   get:
 *     summary: WhatsApp webhook verification (Meta challenge)
 *     description: |
 *       Meta calls this GET endpoint once when you register the webhook URL in the developer portal.
 *       Set WHATSAPP_WEBHOOK_VERIFY_TOKEN to any random string and use the same value in the Meta dashboard.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         schema: { type: string }
 *       - in: query
 *         name: hub.verify_token
 *         schema: { type: string }
 *       - in: query
 *         name: hub.challenge
 *         schema: { type: string }
 *     responses:
 *       200: { description: Challenge echoed back }
 *       403: { description: Token mismatch }
 */
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = config.whatsapp.webhookVerifyToken;
  if (!verifyToken) {
    return res.status(500).send('WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured');
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification passed');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp Webhook] Verification failed — token mismatch');
  return res.status(403).send('Forbidden');
});

/**
 * @swagger
 * /webhooks/whatsapp:
 *   post:
 *     summary: WhatsApp Cloud API incoming events
 *     description: |
 *       Receives message status updates (sent, delivered, read, failed) and
 *       incoming user messages from WhatsApp Cloud API.
 *       Logs events to console; extend here to handle reactions, replies, etc.
 *     tags: [Webhooks]
 *     responses:
 *       200: { description: Event acknowledged }
 */
router.post('/whatsapp', (req, res) => {
  // Always acknowledge immediately so Meta does not retry
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body?.object !== 'whatsapp_business_account') return;

    const entries: any[] = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes: any[] = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        const phoneNumberId: string | undefined = value.metadata?.phone_number_id;

        // Message status updates (sent / delivered / read / failed)
        const statuses: any[] = Array.isArray(value.statuses) ? value.statuses : [];
        for (const s of statuses) {
          console.log(`[WhatsApp Webhook] Status — id:${s.id} to:${s.recipient_id} status:${s.status}`);
          if (s.status === 'failed') {
            console.warn('[WhatsApp Webhook] Delivery failed:', JSON.stringify(s.errors || s));
          }
          const firstError = Array.isArray(s.errors) ? s.errors[0] : undefined;
          (prisma as any).whatsappWebhookEvent.create({
            data: {
              eventType: 'status',
              waMessageId: s.id || null,
              from: null,
              to: s.recipient_id || null,
              status: s.status || null,
              messageType: null,
              bodyText: null,
              errorCode: firstError?.code ?? null,
              errorMsg: firstError?.title ?? null,
              rawPayload: s,
              phoneNumberId: phoneNumberId || null,
            },
          }).catch((e: any) => console.error('[WhatsApp Webhook] DB store status error:', e?.message));
        }

        // Incoming messages from users
        const messages: any[] = Array.isArray(value.messages) ? value.messages : [];
        for (const msg of messages) {
          const from = msg.from;
          const type = msg.type;
          console.log(`[WhatsApp Webhook] Incoming message — from:${from} type:${type}`);
          const bodyText = type === 'text' ? (msg.text?.body || null) : null;
          (prisma as any).whatsappWebhookEvent.create({
            data: {
              eventType: 'message',
              waMessageId: msg.id || null,
              from: from || null,
              to: value.metadata?.display_phone_number || null,
              status: null,
              messageType: type || null,
              bodyText,
              errorCode: null,
              errorMsg: null,
              rawPayload: msg,
              phoneNumberId: phoneNumberId || null,
            },
          }).catch((e: any) => console.error('[WhatsApp Webhook] DB store message error:', e?.message));

          // Bot: handle journalist union registration flow
          // Accept both plain text and interactive button/list replies
          let botText: string | null = bodyText;
          if (type === 'interactive') {
            const iType = msg.interactive?.type;
            if (iType === 'button_reply') botText = msg.interactive.button_reply?.id || msg.interactive.button_reply?.title || null;
            if (iType === 'list_reply')   botText = msg.interactive.list_reply?.id   || msg.interactive.list_reply?.title   || null;
          }
          if (from && botText) {
            processWhatsappBotMessage(from, botText.trim()).catch(
              (e: any) => console.error('[WhatsApp Bot] Error:', e?.message),
            );
          }
        }
      }
    }
  } catch (e) {
    console.error('[WhatsApp Webhook] Processing error:', e);
  }
});

// ─── WhatsApp Journalist Union Registration Bot ────────────────────────────

const BOT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

const STEPS = [
  'AWAIT_MOBILE',
  'AWAIT_NAME',
  'AWAIT_DESIGNATION',
  'AWAIT_NEWSPAPER',
  'AWAIT_STATE',
  'AWAIT_DISTRICT',
  'AWAIT_MANDAL',
  'AWAIT_DOB',
  'AWAIT_MPIN',
  'CONFIRM',
  'DONE',
] as const;

type BotStep = typeof STEPS[number];

const TRIGGER_KEYWORDS = ['join', 'register', 'membership', 'సభ్యత్వం', 'సభ్యుడు'];

const DESIGNATIONS = ['Reporter', 'Senior Reporter', 'Photographer', 'Videographer', 'Editor', 'Sub Editor', 'Correspondent', 'Anchor', 'Freelancer'];
const STATES = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Delhi', 'Other'];

async function reply(phone: string, text: string) {
  await sendWhatsappTextMessage({ to: phone, text });
}

async function replyButtons(phone: string, body: string, buttons: { id: string; title: string }[], header?: string) {
  const result = await sendWhatsappButtons({ to: phone, body, buttons, header });
  // Fallback to text if interactive fails (e.g. non-WhatsApp Business accounts in test)
  if (!result.ok) await reply(phone, body + '\n\n' + buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n'));
}

async function replyList(phone: string, body: string, buttonLabel: string, rows: { id: string; title: string; description?: string }[], header?: string) {
  const result = await sendWhatsappList({ to: phone, body, buttonLabel, sections: [{ title: 'Options', rows }], header });
  if (!result.ok) await reply(phone, body + '\n\n' + rows.map((r, i) => `${i + 1}. ${r.title}`).join('\n'));
}

async function processWhatsappBotMessage(phone: string, text: string) {
  const input = text.trim();
  const inputLower = input.toLowerCase();

  // Load or check existing session
  let session = await (prisma as any).whatsappBotSession.findUnique({ where: { phone } });

  // Expired session — treat as fresh
  if (session && new Date(session.expiresAt) < new Date()) {
    await (prisma as any).whatsappBotSession.delete({ where: { phone } });
    session = null;
  }

  // CANCEL at any point
  if (session && ['cancel', 'రద్దు', 'stop'].includes(inputLower)) {
    await (prisma as any).whatsappBotSession.delete({ where: { phone } });
    await reply(phone, '❌ Registration cancelled. Send JOIN anytime to start again.');
    return;
  }

  // No active session — check for trigger keyword
  if (!session) {
    if (!TRIGGER_KEYWORDS.some(k => inputLower.includes(k))) {
      // Friendly fallback
      await replyButtons(phone,
        '👋 *Welcome to Kaburlu Journalist Union!*\n\nJoin as a member to get your Press ID card.',
        [{ id: 'JOIN', title: '📋 Register Now' }]
      );
      return;
    }

    // Detect union name from message e.g. "JOIN DJFW"
    let unionName: string | null = null;
    const parts = input.split(/\s+/);
    if (parts.length > 1) {
      const abbr = parts.slice(1).join(' ').toUpperCase();
      const union = await (prisma as any).journalistUnionSettings.findFirst({
        where: { OR: [{ abbreviation: abbr }, { unionName: { contains: abbr, mode: 'insensitive' } }] },
        select: { unionName: true, displayName: true, abbreviation: true },
      });
      if (union) unionName = union.unionName;
    }
    if (!unionName) {
      const firstUnion = await (prisma as any).journalistUnionSettings.findFirst({
        select: { unionName: true, displayName: true, abbreviation: true },
      });
      unionName = firstUnion?.unionName ?? null;
    }
    if (!unionName) {
      await reply(phone, '⚠️ No journalist union configured. Please contact the admin.');
      return;
    }

    session = await (prisma as any).whatsappBotSession.create({
      data: {
        phone,
        step: 'AWAIT_MOBILE',
        unionName,
        data: {},
        expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
      },
    });

    await reply(phone,
      `👋 *Journalist Union Membership Registration*\n\n` +
      `Please enter your *10-digit mobile number* to begin:\n` +
      `(We'll check if you already have an account)`
    );
    return;
  }

  // Active session — process by current step
  const step = session.step as BotStep;
  const data: Record<string, any> = (session.data as Record<string, any>) || {};

  async function advanceStep(nextStep: BotStep, newData: Record<string, any>) {
    await (prisma as any).whatsappBotSession.update({
      where: { phone },
      data: {
        step: nextStep,
        data: { ...data, ...newData },
        expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
      },
    });
  }

  switch (step) {

    // ── STEP 0: Mobile number ────────────────────────────────────────────────
    case 'AWAIT_MOBILE': {
      const mobile = input.replace(/\D/g, '');
      const mobile10 = mobile.length === 12 && mobile.startsWith('91') ? mobile.slice(2) : mobile;
      if (!/^[6-9]\d{9}$/.test(mobile10)) {
        await reply(phone, '⚠️ Please enter a valid 10-digit Indian mobile number.');
        return;
      }
      // Check if user already exists with profile
      const existingUser = await prisma.user.findUnique({
        where: { mobileNumber: mobile10 },
        include: { profile: true },
      });
      const existingJournalist = existingUser
        ? await (prisma as any).journalistProfile.findUnique({ where: { userId: existingUser.id } })
        : null;

      if (existingJournalist) {
        // Already a journalist member
        await (prisma as any).whatsappBotSession.delete({ where: { phone } });
        await reply(phone,
          `✅ *Already Registered!*\n\n` +
          `Mobile *${mobile10}* already has a journalist membership.\n` +
          `Press ID: *${existingJournalist.pressId || existingJournalist.id.slice(-8).toUpperCase()}*\n\n` +
          `Send JOIN to start a fresh registration with a different number.`
        );
        return;
      }

      if (existingUser && existingUser.profile) {
        // User exists, has profile → prefill and fast-track to MPIN
        const p = existingUser.profile as any;
        await advanceStep('AWAIT_MPIN', {
          mobileNumber: mobile10,
          userId: existingUser.id,
          prefilled: true,
          fullName:    p.fullName || '',
          designation: '',
          newspaper:   '',
          state:       '',
          district:    '',
          mandal:      '',
          dob:         p.dob ? (p.dob as Date).toISOString().split('T')[0] : null,
        });
        await replyButtons(phone,
          `✅ Found your account!\n\n` +
          `👤 Name: *${p.fullName || 'N/A'}*\n` +
          `📱 Mobile: *${mobile10}*\n\n` +
          `We'll register you with these details. Create a *4-digit MPIN* for login or type it below:`,
          [{ id: 'SKIP_MPIN', title: 'Use existing MPIN' }]
        );
        return;
      }

      // New user — start full flow
      await advanceStep('AWAIT_NAME', { mobileNumber: mobile10 });
      await reply(phone, `✅ Mobile: *${mobile10}*\n\n📝 *Step 1/6* — Enter your *full name*:`);
      break;
    }

    // ── STEP 1: Name ─────────────────────────────────────────────────────────
    case 'AWAIT_NAME':
      if (input.length < 2) { await reply(phone, '⚠️ Please enter a valid full name.'); return; }
      await advanceStep('AWAIT_DESIGNATION', { fullName: input });
      await replyList(phone,
        `✅ Name: *${input}*\n\n📝 *Step 2/6* — Select your designation:`,
        'Choose Designation',
        DESIGNATIONS.map(d => ({ id: d, title: d })),
        'Designation'
      );
      break;

    // ── STEP 2: Designation ───────────────────────────────────────────────────
    case 'AWAIT_DESIGNATION': {
      // Accept list reply id, or typed number, or free text
      let designation = input;
      if (/^\d+$/.test(input)) {
        const idx = parseInt(input) - 1;
        designation = DESIGNATIONS[idx] || input;
      }
      await advanceStep('AWAIT_NEWSPAPER', { designation });
      // Fetch tenants (newspapers) from DB
      const tenants = await (prisma as any).tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        take: 9,
        orderBy: { name: 'asc' },
      });
      if (tenants.length > 0) {
        await replyList(phone,
          `✅ Designation: *${designation}*\n\n📝 *Step 3/6* — Select your newspaper/channel:`,
          'Choose Newspaper',
          [
            ...tenants.map((t: any) => ({ id: `tenant:${t.id}`, title: t.name.slice(0, 24) })),
            { id: 'OTHER_NEWSPAPER', title: 'Other (type name)' },
          ],
          'Newspaper'
        );
      } else {
        await reply(phone, `✅ Designation: *${designation}*\n\n📝 *Step 3/6* — Enter your newspaper/channel name (or type SKIP):`);
      }
      break;
    }

    // ── STEP 3: Newspaper ─────────────────────────────────────────────────────
    case 'AWAIT_NEWSPAPER': {
      let newspaper = '';
      let tenantId: string | null = null;
      if (input.startsWith('tenant:')) {
        tenantId = input.replace('tenant:', '');
        const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
        newspaper = t?.name || '';
      } else if (inputLower === 'skip' || inputLower === 'other_newspaper') {
        newspaper = '';
      } else {
        newspaper = input;
      }

      if (input === 'OTHER_NEWSPAPER') {
        await advanceStep('AWAIT_NEWSPAPER', { ...data, _awaitOtherNewspaper: true });
        await reply(phone, '📝 Enter your newspaper/channel name (or SKIP):');
        return;
      }
      if (data._awaitOtherNewspaper) {
        newspaper = inputLower === 'skip' ? '' : input;
      }

      await advanceStep('AWAIT_STATE', { newspaper, tenantId: tenantId || null, _awaitOtherNewspaper: undefined });
      await replyList(phone,
        `✅ Newspaper: *${newspaper || 'N/A'}*\n\n📝 *Step 4/6* — Select your state:`,
        'Choose State',
        STATES.map(s => ({ id: s, title: s })),
        'State'
      );
      break;
    }

    // ── STEP 4: State ─────────────────────────────────────────────────────────
    case 'AWAIT_STATE': {
      let state = input;
      if (/^\d+$/.test(input)) {
        const idx = parseInt(input) - 1;
        state = STATES[idx] || input;
      }
      await advanceStep('AWAIT_DISTRICT', { state });
      await reply(phone, `✅ State: *${state}*\n\n📝 *Step 5/6* — Enter your *district*:`);
      break;
    }

    // ── STEP 5: District ──────────────────────────────────────────────────────
    case 'AWAIT_DISTRICT':
      await advanceStep('AWAIT_MANDAL', { district: input });
      await replyButtons(phone,
        `✅ District: *${input}*\n\n📝 *Step 6/6* — Enter your mandal/tehsil:`,
        [{ id: 'SKIP', title: 'Skip' }]
      );
      break;

    // ── STEP 6: Mandal ────────────────────────────────────────────────────────
    case 'AWAIT_MANDAL': {
      const mandal = (inputLower === 'skip') ? '' : input;
      await advanceStep('AWAIT_DOB', { mandal });
      await replyButtons(phone,
        `✅ Mandal: *${mandal || 'Skipped'}*\n\n🎂 Date of birth? Format: DD-MM-YYYY\n(e.g. 15-06-1990)`,
        [{ id: 'SKIP', title: 'Skip DOB' }]
      );
      break;
    }

    // ── STEP 7: DOB ───────────────────────────────────────────────────────────
    case 'AWAIT_DOB': {
      let dob: string | null = null;
      if (inputLower !== 'skip') {
        const parts = input.split(/[-\/.]/);
        if (parts.length === 3) {
          const [d, m, y] = parts.map(Number);
          if (d && m && y) dob = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        }
        if (!dob) { await reply(phone, '⚠️ Invalid date. Use DD-MM-YYYY or tap Skip.'); return; }
      }
      await advanceStep('AWAIT_MPIN', { dob });
      await reply(phone, `🔐 Create a *4-digit MPIN* for your account login:`);
      break;
    }

    case 'AWAIT_MPIN': {
      // Handle "Use existing MPIN" button — skip creating new MPIN
      const skipMpin = (inputLower === 'skip_mpin' || inputLower === 'use existing mpin');
      if (!skipMpin && !/^\d{4}$/.test(input)) {
        await reply(phone, '⚠️ MPIN must be exactly 4 digits. Try again:');
        return;
      }
      const mpinValue = skipMpin ? null : input;
      await advanceStep('CONFIRM', { mpin: mpinValue });
      const merged: Record<string, any> = { ...data, mpin: mpinValue };
      const summary =
        `📋 *Registration Summary* — Please verify:\n\n` +
        `📱 Mobile: *${merged.mobileNumber}*\n` +
        `👤 Name: *${merged.fullName || 'N/A'}*\n` +
        `🏷️ Designation: *${merged.designation || 'N/A'}*\n` +
        `📰 Newspaper: *${merged.newspaper || 'N/A'}*\n` +
        `📍 State: *${merged.state || 'N/A'}*\n` +
        `📍 District: *${merged.district || 'N/A'}*\n` +
        `📍 Mandal: *${merged.mandal || 'N/A'}*\n` +
        `🎂 DOB: *${merged.dob || 'N/A'}*`;
      await replyButtons(phone, summary,
        [{ id: 'CONFIRM', title: '✅ Confirm & Submit' }, { id: 'cancel', title: '❌ Cancel' }]
      );
      break;
    }

    case 'CONFIRM': {
      if (!['confirm', 'yes', 'ok', 'submit', 'సరే'].includes(inputLower)) {
        await replyButtons(phone, 'Ready to submit your registration?',
          [{ id: 'CONFIRM', title: '✅ Confirm & Submit' }, { id: 'cancel', title: '❌ Cancel' }]
        );
        return;
      }

      // Use stored mobile number from session data (entered by user in AWAIT_MOBILE step)
      const mobileRaw: string = data.mobileNumber || (phone.startsWith('91') && phone.length === 12 ? phone.slice(2) : phone);

      try {
        // Check if user already exists
        let user = await prisma.user.findUnique({ where: { mobileNumber: mobileRaw } });
        let isNew = false;

        if (user) {
          const existing = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
          if (existing) {
            await reply(phone, `⚠️ This mobile number already has a journalist union application (ID: ${existing.pressId || existing.id.slice(-6)}).`);
            await (prisma as any).whatsappBotSession.delete({ where: { phone } });
            return;
          }
        } else {
          const citizenRole = await prisma.role.findUnique({ where: { name: 'CITIZEN_REPORTER' } });
          const lang = await prisma.language.findFirst({ where: { code: 'te' } }) ?? await prisma.language.findFirst();
          if (!citizenRole || !lang) throw new Error('Role or language not configured');
          let mpinHash: string | null = null;
          if (data.mpin && /^\d{4}$/.test(data.mpin)) {
            mpinHash = await bcrypt.hash(data.mpin, 10);
          }
          user = await prisma.user.create({
            data: {
              mobileNumber: mobileRaw,
              ...(mpinHash ? { mpin: mpinHash } : {}),
              roleId: citizenRole.id,
              languageId: lang.id,
              status: 'PENDING',
            },
          });
          isNew = true;
        }

        // Upsert UserProfile
        await prisma.userProfile.upsert({
          where:  { userId: user.id },
          create: { userId: user.id, fullName: data.fullName, dob: data.dob ? new Date(data.dob) : undefined },
          update: { fullName: data.fullName, ...(data.dob ? { dob: new Date(data.dob) } : {}) },
        });

        // Create JournalistProfile
        const profile = await (prisma as any).journalistProfile.create({
          data: {
            userId:             user.id,
            designation:        data.designation || 'Member',
            district:           data.district || '',
            organization:       data.newspaper || '',
            unionName:          session.unionName,
            state:              data.state || null,
            mandal:             data.mandal || null,
            currentNewspaper:   data.newspaper || null,
            currentDesignation: data.designation || null,
          },
        });

        await (prisma as any).whatsappBotSession.update({
          where: { phone },
          data: { step: 'DONE', expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS) },
        });

        await reply(phone,
          `✅ *Registration Successful!*\n\n` +
          `Welcome to the journalist union, *${data.fullName || 'Member'}*!\n\n` +
          `📱 Mobile: ${mobileRaw}\n` +
          (data.mpin ? `🔑 MPIN: ${data.mpin} (keep it safe)\n\n` : `\n`) +
          `Your application is under review. You'll be notified once approved.\n` +
          (isNew ? `\nYour account has been created — login with your mobile & MPIN.` : '')
        );
      } catch (err: any) {
        console.error('[WhatsApp Bot] Registration error:', err?.message);
        await reply(phone, '❌ Registration failed due to a server error. Please try again later or contact the admin.');
      }
      break;
    }

    case 'DONE':
      await reply(phone, '✅ Your registration is already submitted. Type CANCEL to start a new registration if needed.');
      break;

    default:
      break;
  }
}

export default router;