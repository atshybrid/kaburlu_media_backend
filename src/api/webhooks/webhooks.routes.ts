import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { config } from '../../config/env';
import { sendWhatsappTextMessage, sendWhatsappButtons, sendWhatsappList, downloadWhatsappMedia, sendWhatsappIdCardTemplate } from '../../lib/whatsapp';
import { putPublicObject } from '../../lib/objectStorage';
import { generateAndUploadPressCardPdf } from '../../lib/journalistPressCardPdf';

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
          // Accept both plain text and interactive button/list replies, and image media
          let botText: string | null = bodyText;
          let botMediaId: string | null = null;
          if (type === 'interactive') {
            const iType = msg.interactive?.type;
            if (iType === 'button_reply') botText = msg.interactive.button_reply?.id || msg.interactive.button_reply?.title || null;
            if (iType === 'list_reply')   botText = msg.interactive.list_reply?.id   || msg.interactive.list_reply?.title   || null;
          }
          if (type === 'image') {
            botText = '__IMAGE__';
            botMediaId = msg.image?.id || null;
          }
          if (type === 'document') {
            botText = '__IMAGE__'; // treat document (PDF scan) same as image for KYC
            botMediaId = msg.document?.id || null;
          }
          if (from && (botText || botMediaId)) {
            processWhatsappBotMessage(from, botText?.trim() || '__IMAGE__', botMediaId).catch(
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
  'AWAIT_WORKING_AREA',
  'AWAIT_DOB',
  'AWAIT_MPIN',
  'CONFIRM',
  'AWAIT_INSURANCE_OPT',
  'AWAIT_AADHAAR',
  'AWAIT_AADHAAR_BACK',
  'AWAIT_PAN',
  'AWAIT_NOMINEE',
  'KYC_SUBMITTED',
  'DONE',
] as const;

type BotStep = typeof STEPS[number];

const TRIGGER_KEYWORDS = [
  'join', 'register', 'membership', 'member', 'union', 'djfw',
  'join union', 'సభ్యత్వం', 'సభ్యుడు', 'జాయిన్',
];

const DESIGNATIONS = ['Reporter', 'Senior Reporter', 'Photographer', 'Videographer', 'Editor', 'Sub Editor', 'Correspondent', 'Anchor', 'Freelancer', 'Other'];

async function reply(phone: string, text: string) {
  await sendWhatsappTextMessage({ to: phone, text });
}

async function replyButtons(phone: string, body: string, buttons: { id: string; title: string }[], header?: string) {
  const result = await sendWhatsappButtons({ to: phone, body, buttons, header });
  if (!result.ok) await reply(phone, body + '\n\n' + buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n'));
}

async function replyList(phone: string, body: string, buttonLabel: string, rows: { id: string; title: string; description?: string }[], header?: string) {
  const result = await sendWhatsappList({ to: phone, body, buttonLabel, sections: [{ title: 'Options', rows }], header });
  if (!result.ok) await reply(phone, body + '\n\n' + rows.map((r, i) => `${i + 1}. ${r.title}`).join('\n'));
}

/** Upload media from WhatsApp to R2 and return the public URL */
async function uploadBotMedia(mediaId: string, prefix: string): Promise<string | null> {
  const downloaded = await downloadWhatsappMedia(mediaId);
  if (!downloaded) return null;
  const ext = downloaded.mimeType.includes('pdf') ? 'pdf' : downloaded.mimeType.split('/')[1] || 'jpg';
  const key = `journalist-kyc/${prefix}-${Date.now()}.${ext}`;
  try {
    const result = await putPublicObject({ key, body: downloaded.buffer, contentType: downloaded.mimeType });
    return result.publicUrl;
  } catch (e: any) {
    console.error('[WhatsApp Bot] R2 upload failed:', e?.message);
    return null;
  }
}

async function processWhatsappBotMessage(phone: string, text: string, mediaId: string | null = null) {
  const input = text.trim();
  const inputLower = input.toLowerCase();

  let session = await (prisma as any).whatsappBotSession.findUnique({ where: { phone } });

  // Expired session — treat as fresh
  if (session && new Date(session.expiresAt) < new Date()) {
    await (prisma as any).whatsappBotSession.delete({ where: { phone } });
    session = null;
  }

  // CANCEL at any point
  if (session && ['cancel', 'రద్దు', 'stop', 'restart'].includes(inputLower)) {
    await (prisma as any).whatsappBotSession.delete({ where: { phone } });
    await reply(phone, '❌ నమోదు రద్దు చేయబడింది. మళ్ళీ చేరాలంటే *JOIN* లేదా *DJFW* పంపండి.');
    return;
  }

  // No active session — check for trigger keyword
  if (!session) {
    // Detect union name from message e.g. "JOIN DJFW" (needed for both welcome + registration)
    let unionName: string | null = null;
    let unionDisplayName: string | null = null;
    const parts = input.split(/\s+/);
    for (const candidate of [parts.slice(1).join(' ').toUpperCase(), parts[0].toUpperCase()]) {
      if (!candidate) continue;
      const union = await (prisma as any).journalistUnionSettings.findFirst({
        where: { OR: [{ abbreviation: candidate }, { unionName: { contains: candidate, mode: 'insensitive' } }] },
        select: { unionName: true, displayName: true },
      });
      if (union) { unionName = union.unionName; unionDisplayName = union.displayName || union.unionName; break; }
    }
    if (!unionName) {
      const firstUnion = await (prisma as any).journalistUnionSettings.findFirst({ select: { unionName: true, displayName: true } });
      unionName = firstUnion?.unionName ?? null;
      unionDisplayName = firstUnion?.displayName || firstUnion?.unionName ?? null;
    }

    if (!TRIGGER_KEYWORDS.some(k => inputLower.includes(k))) {
      const welcomeUnion = unionDisplayName || 'జర్నలిస్ట్ యూనియన్';
      await replyButtons(phone,
        `👋 *${welcomeUnion}‌కు స్వాగతం!*\n\nమీ *${welcomeUnion} ID కార్డ్* పొందడానికి సభ్యుడిగా చేరండి.\n\n*JOIN* లేదా *DJFW* పంపండి.`,
        [{ id: 'JOIN', title: '📋 ఇప్పుడే నమోదు చేయండి' }]
      );
      return;
    }

    if (!unionName) {
      await reply(phone, '⚠️ జర్నలిస్ట్ యూనియన్ కాన్ఫిగర్ చేయలేదు. అడ్మిన్‌ని సంప్రదించండి.');
      return;
    }

    session = await (prisma as any).whatsappBotSession.create({
      data: {
        phone,
        step: 'AWAIT_MOBILE',
        unionName,
        data: { unionDisplayName: unionDisplayName || unionName },
        expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
      },
    });

    const regUnion = unionDisplayName || unionName;
    await reply(phone,
      `👋 *${regUnion} సభ్యత్వ నమోదు*\n\n` +
      `మీ *10 అంకెల మొబైల్ నంబర్* నమోదు చేయండి:\n` +
      `(మీకు ఇప్పటికే అకౌంట్ ఉందా అని తనిఖీ చేస్తాం)`
    );
    return;
  }

  const step = session.step as BotStep;
  const data: Record<string, any> = (session.data as Record<string, any>) || {};
  const unionCardName = (data.unionDisplayName as string) || session.unionName || 'యూనియన్';

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

  try {
  switch (step) {

    // ── STEP 0: Mobile number ────────────────────────────────────────────────
    case 'AWAIT_MOBILE': {
      const mobile = input.replace(/\D/g, '');
      const mobile10 = mobile.length === 12 && mobile.startsWith('91') ? mobile.slice(2) : mobile;
      if (!/^[6-9]\d{9}$/.test(mobile10)) {
        await reply(phone, '⚠️ దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.');
        return;
      }
      const existingUser = await prisma.user.findUnique({
        where: { mobileNumber: mobile10 },
        include: { profile: true },
      });
      const existingJournalist = existingUser
        ? await (prisma as any).journalistProfile.findUnique({
            where: { userId: existingUser.id },
            include: { card: { select: { status: true, expiryDate: true } } },
          })
        : null;

      if (existingJournalist) {
        if (existingJournalist.kycVerified) {
          await (prisma as any).whatsappBotSession.delete({ where: { phone } });
          await reply(phone,
            `✅ *ఇప్పటికే నమోదు & వెరిఫై అయింది!*\n\n` +
            `మొబైల్ *${mobile10}* యాక్టివ్ జర్నలిస్ట్ సభ్యత్వం ఉంది.\n` +
            `ప్రెస్ ID: *${existingJournalist.pressId || existingJournalist.id.slice(-8).toUpperCase()}*\n\n` +
            `మీ ID కార్డ్ కోసం యూనియన్ అడ్మిన్‌ని సంప్రదించండి.`
          );
          return;
        }
        // Existing journalist — show all their details as summary, go straight to CONFIRM
        const p = existingUser?.profile as any;
        let newspaper = existingJournalist.currentNewspaper || existingJournalist.organization || '';
        if (existingJournalist.linkedTenantId && !newspaper) {
          const t = await (prisma as any).tenant.findUnique({ where: { id: existingJournalist.linkedTenantId }, select: { name: true } });
          newspaper = t?.name || '';
        }
        await advanceStep('CONFIRM', {
          mobileNumber: mobile10,
          userId: existingUser!.id,
          journalistProfileId: existingJournalist.id,
          fullName: p?.fullName || existingJournalist.organization || '',
          designation: existingJournalist.currentDesignation || existingJournalist.designation || '',
          newspaper,
          district: existingJournalist.district || '',
          state: existingJournalist.state || '',
          dob: p?.dob ? (p.dob as Date).toISOString().split('T')[0] : null,
          prefilled: true,
          existingUser: true,
        });
        const summary =
          `📋 *మీ వివరాలు కనుగొన్నాం!*\n\n` +
          `👤 పేరు: *${p?.fullName || 'N/A'}*\n` +
          `📱 మొబైల్: *${mobile10}*\n` +
          `🏷️ హోదా: *${existingJournalist.currentDesignation || existingJournalist.designation || 'N/A'}*\n` +
          `📰 వార్తాపత్రిక: *${newspaper || 'N/A'}*\n` +
          `📍 ప్రాంతం: *${existingJournalist.mandal ? existingJournalist.mandal + ', ' : ''}${existingJournalist.district || 'N/A'}*${existingJournalist.state ? `, ${existingJournalist.state}` : ''}\n\n` +
          `నిర్ధారించి ID కార్డ్ పొందండి, ఆపై ఇన్సూరెన్స్ దరఖాస్తు చేయండి:`;
        await replyButtons(phone, summary,
          [{ id: 'CONFIRM', title: '✅ నిర్ధారించు & కొనసాగు' }, { id: 'cancel', title: '❌ రద్దు' }]
        );
        return;
      }

      if (existingUser && existingUser.profile) {
        const p = existingUser.profile as any;

        // Check if this user is already a Reporter in the tenant system
        const existingReporter = await (prisma as any).reporter.findUnique({
          where: { userId: existingUser.id },
          include: {
            designation: { select: { name: true, nativeName: true } },
            tenant: { select: { name: true } },
            district: { include: { state: { select: { name: true } } } },
            mandal: { include: { district: { include: { state: { select: { name: true } } } } } },
            state: { select: { name: true } },
          },
        }).catch(() => null);

        if (existingReporter) {
          // Reporter found — pre-fill all details from tenant reporter table, skip to CONFIRM
          const designation = existingReporter.designation?.name || existingReporter.designation?.nativeName || '';
          const newspaper = existingReporter.tenant?.name || '';
          // district can come from direct relation or via mandal's district
          const districtObj = existingReporter.district || (existingReporter.mandal as any)?.district || null;
          const district = districtObj?.name || '';
          const state = districtObj?.state?.name || (existingReporter as any).state?.name || '';
          const mandal = existingReporter.mandal?.name || '';
          const baseReporterData = {
            mobileNumber: mobile10,
            userId: existingUser.id,
            reporterId: existingReporter.id,
            reporterPhotoUrl: existingReporter.profilePhotoUrl || null,
            fullName: p.fullName || '',
            designation,
            newspaper,
            dob: p.dob ? (p.dob as Date).toISOString().split('T')[0] : null,
            prefilled: true,
            existingUser: true,
          };
          if (!district) {
            // Reporter has no location in DB — ask for working area
            await advanceStep('AWAIT_WORKING_AREA', { ...baseReporterData, district: '', state, mandal });
            await reply(phone,
              `📋 *మీ వివరాలు కనుగొన్నాం!*\n\n` +
              `👤 పేరు: *${p.fullName || 'N/A'}*  |  🏷️ హోదా: *${designation || 'N/A'}*\n` +
              `📰 వార్తాపత్రిక: *${newspaper || 'N/A'}*\n\n` +
              `📍 మీ *పని ప్రాంతం* (జిల్లా పేరు) నమోదు చేయండి:\n(ఉదా: నెల్లూరు, గుంటూరు, హైదరాబాద్)`
            );
            return;
          }
          await advanceStep('CONFIRM', { ...baseReporterData, district, state, mandal });
          const summary =
            `📋 *మీ వివరాలు కనుగొన్నాం!*\n\n` +
            `👤 పేరు: *${p.fullName || 'N/A'}*\n` +
            `📱 మొబైల్: *${mobile10}*\n` +
            `🏷️ హోదా: *${designation || 'N/A'}*\n` +
            `📰 వార్తాపత్రిక: *${newspaper || 'N/A'}*\n` +
            `📍 ప్రాంతం: *${mandal ? mandal + ', ' : ''}${district || 'N/A'}*${state ? `, ${state}` : ''}\n\n` +
            `నిర్ధారించి ID కార్డ్ పొందండి, ఆపై ఇన్సూరెన్స్ దరఖాస్తు చేయండి:`;
          await replyButtons(phone, summary,
            [{ id: 'CONFIRM', title: '✅ నిర్ధారించు & కొనసాగు' }, { id: 'cancel', title: '❌ రద్దు' }]
          );
          return;
        }

        // User exists with profile but no reporter/journalist record — ask for designation
        await advanceStep('AWAIT_DESIGNATION', {
          mobileNumber: mobile10,
          userId: existingUser.id,
          prefilled: true,
          existingUser: true,
          fullName: p.fullName || '',
          dob: p.dob ? (p.dob as Date).toISOString().split('T')[0] : null,
        });
        await replyList(phone,
          `✅ మీ అకౌంట్ కనుగొన్నాం!\n\n👤 పేరు: *${p.fullName || 'N/A'}*\n📱 మొబైల్: *${mobile10}*\n\n📝 మీ హోదా ఎంచుకోండి:`,
          'హోదా ఎంచుకోండి',
          DESIGNATIONS.map(d => ({ id: d, title: d })),
        );
        return;
      }

      // New user
      await advanceStep('AWAIT_NAME', { mobileNumber: mobile10 });
      await reply(phone, `✅ మొబైల్: *${mobile10}*\n\n📝 *దశ 1/5* — మీ *పూర్తి పేరు* నమోదు చేయండి:`);
      break;
    }

    // ── STEP 1: Name ─────────────────────────────────────────────────────────
    case 'AWAIT_NAME':
      if (input.length < 2) { await reply(phone, '⚠️ దయచేసి సరైన పూర్తి పేరు నమోదు చేయండి.'); return; }
      await advanceStep('AWAIT_DESIGNATION', { fullName: input });
      await replyList(phone,
        `✅ పేరు: *${input}*\n\n📝 *దశ 2/5* — మీ హోదా ఎంచుకోండి:`,
        'హోదా ఎంచుకోండి',
        DESIGNATIONS.map(d => ({ id: d, title: d })),
      );
      break;

    // ── STEP 2: Designation ───────────────────────────────────────────────────
    case 'AWAIT_DESIGNATION': {
      let designation = input;
      if (/^\d+$/.test(input)) {
        const idx = parseInt(input) - 1;
        designation = DESIGNATIONS[idx] || input;
      }
      if (designation === 'Other') {
        await advanceStep('AWAIT_DESIGNATION', { _awaitOtherDesignation: true });
        await reply(phone, '📝 మీ హోదా టైప్ చేయండి (ఉదా: Camera Person, News Presenter):');
        return;
      }
      if (data._awaitOtherDesignation) {
        designation = input;
      }
      await advanceStep('AWAIT_NEWSPAPER', { designation, _awaitOtherDesignation: undefined });
      // Fetch active tenants (newspapers)
      const tenants = await (prisma as any).tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        take: 9,
        orderBy: { name: 'asc' },
      });
      if (tenants.length > 0) {
        await replyList(phone,
          `✅ హోదా: *${designation}*\n\n📝 *దశ 3/5* — మీ వార్తాపత్రిక/చానెల్ ఎంచుకోండి:`,
          'వార్తాపత్రిక ఎంచుకోండి',
          [
            ...tenants.map((t: any) => ({ id: `t_${t.id}`, title: t.name.slice(0, 24) })),
            { id: 'OTHER_NEWSPAPER', title: 'ఇతర / పేరు టైప్ చేయండి' },
          ],
        );
      } else {
        await reply(phone, `✅ హోదా: *${designation}*\n\n📝 *దశ 3/5* — మీ వార్తాపత్రిక/చానెల్ పేరు నమోదు చేయండి:`);
      }
      break;
    }

    // ── STEP 3: Newspaper ─────────────────────────────────────────────────────
    case 'AWAIT_NEWSPAPER': {
      if (input === 'OTHER_NEWSPAPER' || data._awaitOtherNewspaper) {
        if (!data._awaitOtherNewspaper) {
          await advanceStep('AWAIT_NEWSPAPER', { _awaitOtherNewspaper: true });
          await reply(phone, '📰 మీ వార్తాపత్రిక/చానెల్ పేరు టైప్ చేయండి (లేదా SKIP పంపండి):');
          return;
        }
        // Received free text
      }
      let newspaper = '';
      let tenantId: string | null = null;
      if (input.startsWith('t_')) {
        tenantId = input.replace('t_', '');
        const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
        newspaper = t?.name || '';
      } else if (inputLower === 'skip') {
        newspaper = '';
      } else {
        newspaper = input;
      }
      await advanceStep('AWAIT_WORKING_AREA', { newspaper, tenantId: tenantId || null, _awaitOtherNewspaper: undefined });
      await reply(phone,
        `✅ వార్తాపత్రిక: *${newspaper || 'N/A'}*\n\n` +
        `📍 *దశ 4/5* — మీ *పని ప్రాంతం* (జిల్లా/నగరం పేరు) నమోదు చేయండి:\n` +
        `(ఉదా: నెల్లూరు, గుంటూరు, హైదరాబాద్)`
      );
      break;
    }

    // ── STEP 4: Working Area (District search) ────────────────────────────────
    case 'AWAIT_WORKING_AREA': {
      // Handle district selection from list
      if (input.startsWith('district:')) {
        const districtId = input.replace('district:', '');
        const d = await prisma.district.findUnique({
          where: { id: districtId },
          include: { state: { select: { name: true } } },
        });
        if (d) {
          await advanceStep('AWAIT_DOB', {
            district: d.name, districtId: d.id,
            state: d.state.name, mandal: '',
          });
          await replyButtons(phone,
            `✅ ప్రాంతం: *${d.name}*, ${d.state.name}\n\n` +
            `📝 *దశ 5/5* — జన్మ తేదీ? Format: DD-MM-YYYY\n(ఉదా: 15-06-1990)`,
            [{ id: 'SKIP', title: 'వదిలివేయి' }]
          );
          return;
        }
      }

      // Handle numeric selection (fallback for text-only phones)
      if (/^\d+$/.test(input) && Array.isArray(data._areaChoices)) {
        const idx = parseInt(input) - 1;
        const choice = data._areaChoices[idx];
        if (choice) {
          await advanceStep('AWAIT_DOB', {
            district: choice.name, districtId: choice.id,
            state: choice.stateName, mandal: '',
            _areaChoices: undefined,
          });
          await replyButtons(phone,
            `✅ ప్రాంతం: *${choice.name}*, ${choice.stateName}\n\n` +
            `📝 *దశ 5/5* — జన్మ తేదీ? Format: DD-MM-YYYY`,
            [{ id: 'SKIP', title: 'వదిలివేయి' }]
          );
          return;
        }
      }

      // Search districts in DB
      const matches = await prisma.district.findMany({
        where: {
          name: { contains: input, mode: 'insensitive' },
          isDeleted: false,
        },
        include: { state: { select: { name: true } } },
        take: 9,
        orderBy: { name: 'asc' },
      });

      if (matches.length === 0) {
        // Accept as free text
        await advanceStep('AWAIT_DOB', { district: input, districtId: null, state: '', mandal: '' });
        await replyButtons(phone,
          `✅ ప్రాంతం: *${input}*\n\n` +
          `📝 *దశ 5/5* — జన్మ తేదీ? Format: DD-MM-YYYY`,
          [{ id: 'SKIP', title: 'వదిలివేయి' }]
        );
        return;
      }

      if (matches.length === 1) {
        const d = matches[0];
        await advanceStep('AWAIT_DOB', {
          district: d.name, districtId: d.id,
          state: (d.state as any).name, mandal: '',
        });
        await replyButtons(phone,
          `✅ ప్రాంతం: *${d.name}*, ${(d.state as any).name}\n\n` +
          `📝 *దశ 5/5* — జన్మ తేదీ? Format: DD-MM-YYYY`,
          [{ id: 'SKIP', title: 'వదిలివేయి' }]
        );
        return;
      }

      // Multiple matches — show list
      const choices = matches.map(d => ({ id: d.id, name: d.name, stateName: (d.state as any).name }));
      await advanceStep('AWAIT_WORKING_AREA', { _areaChoices: choices });
      await replyList(phone,
        `"*${input}*" కు ${matches.length} ప్రాంతాలు దొరికాయి. మీది ఎంచుకోండి:`,
        'ప్రాంతం ఎంచుకోండి',
        choices.map(c => ({ id: `district:${c.id}`, title: c.name, description: c.stateName })),
      );
      break;
    }

    // ── STEP 5: DOB ───────────────────────────────────────────────────────────
    case 'AWAIT_DOB': {
      let dob: string | null = null;
      if (inputLower !== 'skip') {
        const parts = input.split(/[-\/.]/);
        if (parts.length === 3) {
          const [d, m, y] = parts.map(Number);
          if (d && m && y) dob = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        }
        if (!dob) { await reply(phone, '⚠️ తప్పు తేదీ. DD-MM-YYYY ఫార్మాట్‌లో నమోదు చేయండి లేదా వదిలివేయి నొక్కండి.'); return; }
      }
      if (data.existingUser) {
        // Existing user — skip MPIN, go directly to CONFIRM
        await advanceStep('CONFIRM', { dob });
        const merged: Record<string, any> = { ...data, dob };
        const summary =
          `📋 *నమోదు సారాంశం* — దయచేసి ధృవీకరించండి:\n\n` +
          `📱 మొబైల్: *${merged.mobileNumber}*\n` +
          `👤 పేరు: *${merged.fullName || 'N/A'}*\n` +
          `🏷️ హోదా: *${merged.designation || 'N/A'}*\n` +
          `📰 వార్తాపత్రిక: *${merged.newspaper || 'N/A'}*\n` +
          `📍 ప్రాంతం: *${merged.district || 'N/A'}*${merged.state ? `, ${merged.state}` : ''}\n` +
          `🎂 జన్మ తేదీ: *${merged.dob || 'N/A'}*`;
        await replyButtons(phone, summary,
          [{ id: 'CONFIRM', title: '✅ నిర్ధారించు & సమర్పించు' }, { id: 'cancel', title: '❌ రద్దు' }]
        );
        break;
      }
      await advanceStep('AWAIT_MPIN', { dob });
      const last4hint = (data.mobileNumber as string | undefined)?.slice(-4) || '';
      await replyButtons(phone,
        `🔐 మీ అకౌంట్ లాగిన్ కోసం *4 అంకెల MPIN* సెట్ చేయండి:\n_(default: మీ నంబర్ చివరి 4 అంకెలు — *${last4hint}*)_`,
        [{ id: 'default', title: `🔢 Default (${last4hint}) వాడు` }]
      );
      break;
    }

    // ── STEP 6: MPIN ──────────────────────────────────────────────────────────
    case 'AWAIT_MPIN': {
      // Existing users already have an account — skip MPIN
      if (data.existingUser) {
        await advanceStep('CONFIRM', { mpin: null });
        const merged = { ...data };
        const summary =
          `📋 *నమోదు సారాంశం* — దయచేసి ధృవీకరించండి:\n\n` +
          `📱 మొబైల్: *${merged.mobileNumber}*\n` +
          `👤 పేరు: *${merged.fullName || 'N/A'}*\n` +
          `🏷️ హోదా: *${merged.designation || 'N/A'}*\n` +
          `📰 వార్తాపత్రిక: *${merged.newspaper || 'N/A'}*\n` +
          `📍 ప్రాంతం: *${merged.district || 'N/A'}*${merged.state ? `, ${merged.state}` : ''}\n` +
          `🎂 జన్మ తేదీ: *${merged.dob || 'N/A'}*`;
        await replyButtons(phone, summary,
          [{ id: 'CONFIRM', title: '✅ నిర్ధారించు & సమర్పించు' }, { id: 'cancel', title: '❌ రద్దు' }]
        );
        return;
      }
      const last4 = data.mobileNumber ? (data.mobileNumber as string).slice(-4) : '';
      if (inputLower === 'skip' || inputLower === 'default') {
        const mpinValue = last4 || null;
        await advanceStep('CONFIRM', { mpin: mpinValue });
        const merged: Record<string, any> = { ...data, mpin: mpinValue };
        const summary =
          `📋 *నమోదు సారాంశం* — దయచేసి ధృవీకరించండి:\n\n` +
          `📱 మొబైల్: *${merged.mobileNumber}*\n` +
          `👤 పేరు: *${merged.fullName || 'N/A'}*\n` +
          `🏷️ హోదా: *${merged.designation || 'N/A'}*\n` +
          `📰 వార్తాపత్రిక: *${merged.newspaper || 'N/A'}*\n` +
          `📍 ప్రాంతం: *${merged.district || 'N/A'}*${merged.state ? `, ${merged.state}` : ''}\n` +
          `🎂 జన్మ తేదీ: *${merged.dob || 'N/A'}*\n` +
          `🔑 MPIN: *${mpinValue || 'N/A'}* (మొబైల్ చివరి 4 అంకెలు)`;
        await replyButtons(phone, summary,
          [{ id: 'CONFIRM', title: '✅ నిర్ధారించు & సమర్పించు' }, { id: 'cancel', title: '❌ రద్దు' }]
        );
        return;
      }
      if (!/^\d{4}$/.test(input)) {
        await replyButtons(phone,
          `🔐 మీ అకౌంట్ లాగిన్ కోసం *4 అంకెల MPIN* సెట్ చేయండి:\n_(default: మీ నంబర్ చివరి 4 అంకెలు — *${last4}*)_`,
          [{ id: 'default', title: `🔢 Default (${last4}) వాడు` }]
        );
        return;
      }
      const mpinValue = input;
      await advanceStep('CONFIRM', { mpin: mpinValue });
      const merged: Record<string, any> = { ...data, mpin: mpinValue };
      const summary =
        `📋 *నమోదు సారాంశం* — దయచేసి ధృవీకరించండి:\n\n` +
        `📱 మొబైల్: *${merged.mobileNumber}*\n` +
        `👤 పేరు: *${merged.fullName || 'N/A'}*\n` +
        `🏷️ హోదా: *${merged.designation || 'N/A'}*\n` +
        `📰 వార్తాపత్రిక: *${merged.newspaper || 'N/A'}*\n` +
        `📍 ప్రాంతం: *${merged.district || 'N/A'}*${merged.state ? `, ${merged.state}` : ''}\n` +
        `🎂 జన్మ తేదీ: *${merged.dob || 'N/A'}*`;
      await replyButtons(phone, summary,
        [{ id: 'CONFIRM', title: '✅ నిర్ధారించు & సమర్పించు' }, { id: 'cancel', title: '❌ రద్దు' }]
      );
      break;
    }

    // ── STEP 7: Confirm basic registration ────────────────────────────────────
    case 'CONFIRM': {
      if (!['confirm', 'yes', 'ok', 'submit', 'సరే'].includes(inputLower)) {
        await replyButtons(phone, 'మీ నమోదు సమర్పించాలా?',
          [{ id: 'CONFIRM', title: '✅ నిర్ధారించు & సమర్పించు' }, { id: 'cancel', title: '❌ రద్దు' }]
        );
        return;
      }

      const mobileRaw: string = data.mobileNumber || (phone.startsWith('91') && phone.length === 12 ? phone.slice(2) : phone);

      try {
        // Existing journalist — find or create their card, generate PDF, send it, then insurance opt-in
        if (data.existingUser && data.journalistProfileId) {
          try {
            let card = await (prisma as any).journalistCard.findUnique({ where: { profileId: data.journalistProfileId } });
            if (!card) {
              const expiry = new Date();
              expiry.setFullYear(expiry.getFullYear() + 1);
              card = await (prisma as any).journalistCard.create({
                data: {
                  profileId: data.journalistProfileId,
                  cardNumber: `JU-${Date.now()}`,
                  expiryDate: expiry,
                  status: 'ACTIVE',
                },
              });
            }
            let pdfUrl: string | null = card.pdfUrl || null;
            if (!pdfUrl) {
              await reply(phone, `⏳ మీ *${unionCardName} ID కార్డ్* తయారు చేస్తున్నాం...`);
              const pdfResult = await generateAndUploadPressCardPdf(data.journalistProfileId);
              if (pdfResult.ok && pdfResult.pdfUrl) {
                pdfUrl = pdfResult.pdfUrl;
              }
            }
            if (pdfUrl) {
              const sendResult = await sendWhatsappIdCardTemplate({
                toMobileNumber: phone,
                pdfUrl,
                cardType: `${unionCardName} ID`,
                organizationName: data.newspaper || 'Journalist Union',
                documentType: `${unionCardName} ID Card`,
                pdfFilename: `Press_ID_${data.journalistProfileId.slice(-8).toUpperCase()}.pdf`,
              });
              if (!sendResult.ok) {
                console.error('[WhatsApp Bot] ID card send failed (existingUser):', sendResult.error, sendResult.details);
                await reply(phone, `⚠️ ID కార్డ్ పంపడంలో సమస్య వచ్చింది. PDF లింక్: ${pdfUrl}\nఅడ్మిన్‌ని సంప్రదించండి.`);
              }
            } else {
              await reply(phone, `⚠️ ID కార్డ్ ఇప్పుడు జనరేట్ చేయడం సాధ్యం కాలేదు. అడ్మిన్ మీ కార్డ్ పంపిస్తారు.\n`);
            }
          } catch (cardErr: any) {
            console.error('[WhatsApp Bot] Card generation error:', cardErr?.message);
            await reply(phone, `⚠️ ID కార్డ్ పంపడంలో సమస్య వచ్చింది. అడ్మిన్ మీతో సంప్రదిస్తారు.\n`);
          }
          await (prisma as any).whatsappBotSession.update({
            where: { phone },
            data: { step: 'AWAIT_INSURANCE_OPT', expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS) },
          });
          await replyButtons(phone,
            `🛡️ *ఇన్సూరెన్స్ దరఖాస్తు*\n\nమీ ఆధార్ కార్డ్, PAN కార్డ్ మరియు నామినీ వివరాలు నమోదు చేసి ఇన్సూరెన్స్ కోసం దరఖాస్తు చేయాలా?`,
            [{ id: 'insurance_yes', title: '🛡️ అవును, దరఖాస్తు చేయి' }, { id: 'insurance_no', title: '❌ వద్దు, తర్వాత' }]
          );
          return;
        }

        let user = await prisma.user.findUnique({ where: { mobileNumber: mobileRaw } });
        let isNew = false;

        if (user) {
          const existing = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
          if (existing) {
            // Already has a JournalistProfile — send their card if possible, then insurance
            let pdfUrl: string | null = null;
            try {
              let card = await (prisma as any).journalistCard.findUnique({ where: { profileId: existing.id } });
              if (!card) {
                const expiry = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);
                card = await (prisma as any).journalistCard.create({
                  data: { profileId: existing.id, cardNumber: `JU-${Date.now()}`, expiryDate: expiry, status: 'ACTIVE' },
                });
              }
              pdfUrl = card.pdfUrl || null;
              if (!pdfUrl) {
                await reply(phone, `⏳ మీ *${unionCardName} ID కార్డ్* తయారు చేస్తున్నాం...`);
                const pdfResult = await generateAndUploadPressCardPdf(existing.id);
                if (pdfResult.ok && pdfResult.pdfUrl) pdfUrl = pdfResult.pdfUrl;
              }
              if (pdfUrl) {
                const sendResult = await sendWhatsappIdCardTemplate({
                  toMobileNumber: phone, pdfUrl,
                  cardType: `${unionCardName} ID`, organizationName: data.newspaper || 'Journalist Union',
                  documentType: `${unionCardName} ID Card`,
                  pdfFilename: `Press_ID_${existing.id.slice(-8).toUpperCase()}.pdf`,
                });
                if (!sendResult.ok) {
                  console.error('[WhatsApp Bot] ID card send failed (existingJournalist):', sendResult.error, sendResult.details);
                  await reply(phone, `⚠️ ID కార్డ్ పంపడంలో సమస్య వచ్చింది. PDF లింక్: ${pdfUrl}\nఅడ్మిన్‌ని సంప్రదించండి.`).catch(() => {});
                }
              }
            } catch (_e) { /* card send failure is non-fatal */ }
            await (prisma as any).whatsappBotSession.update({
              where: { phone },
              data: { step: 'AWAIT_INSURANCE_OPT', data: { ...data, journalistProfileId: existing.id }, expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS) },
            });
            await replyButtons(phone,
              `🛡️ *ఇన్సూరెన్స్ దరఖాస్తు*\n\nఇప్పుడే ఆధార్, PAN, నామినీ వివరాలు నమోదు చేయాలా?`,
              [{ id: 'insurance_yes', title: '🛡️ అవును, దరఖాస్తు చేయి' }, { id: 'insurance_no', title: '❌ వద్దు, తర్వాత' }]
            );
            return;
          }

          // User exists but no JournalistProfile yet — check if tenant reporter (has photo)
          if (data.reporterId) {
            // Tenant reporter joining union — create JournalistProfile with their existing photo
            const profile = await (prisma as any).journalistProfile.create({
              data: {
                userId: user.id,
                designation: data.designation || 'Member',
                district: data.district || '',
                organization: data.newspaper || '',
                unionName: session.unionName,
                state: data.state || null,
                mandal: data.mandal || null,
                currentNewspaper: data.newspaper || null,
                currentDesignation: data.designation || null,
                linkedTenantId: data.tenantId || null,
                photoUrl: data.reporterPhotoUrl || null,
              },
            });
            // Generate and send ID card immediately using reporter's existing photo
            let pdfUrl: string | null = null;
            try {
              const expiry = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);
              await (prisma as any).journalistCard.create({
                data: { profileId: profile.id, cardNumber: `JU-${Date.now()}`, expiryDate: expiry, status: 'ACTIVE' },
              });
              await reply(phone, `⏳ మీ *${unionCardName} ID కార్డ్* తయారు చేస్తున్నాం...`);
              const pdfResult = await generateAndUploadPressCardPdf(profile.id);
              if (pdfResult.ok && pdfResult.pdfUrl) pdfUrl = pdfResult.pdfUrl;
              if (pdfUrl) {
                const sendResult = await sendWhatsappIdCardTemplate({
                  toMobileNumber: phone, pdfUrl,
                  cardType: `${unionCardName} ID`, organizationName: data.newspaper || 'Journalist Union',
                  documentType: `${unionCardName} ID Card`,
                  pdfFilename: `Press_ID_${profile.id.slice(-8).toUpperCase()}.pdf`,
                });
                if (!sendResult.ok) {
                  console.error('[WhatsApp Bot] ID card send failed (reporter):', sendResult.error, sendResult.details);
                  await reply(phone, `⚠️ ID కార్డ్ పంపడంలో సమస్య వచ్చింది. PDF లింక్: ${pdfUrl}\nఅడ్మిన్‌ని సంప్రదించండి.`);
                }
              } else {
                await reply(phone, `⚠️ ID కార్డ్ ఇప్పుడు జనరేట్ చేయడం సాధ్యం కాలేదు. అడ్మిన్ మీ కార్డ్ పంపిస్తారు.`);
              }
            } catch (cardErr: any) {
              console.error('[WhatsApp Bot] Reporter card gen error:', cardErr?.message);
              await reply(phone, `⚠️ ID కార్డ్ పంపడంలో సమస్య వచ్చింది. అడ్మిన్ మీతో సంప్రదిస్తారు.`);
            }
            await (prisma as any).whatsappBotSession.update({
              where: { phone },
              data: { step: 'AWAIT_INSURANCE_OPT', data: { ...data, userId: user.id, journalistProfileId: profile.id }, expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS) },
            });
            await replyButtons(phone,
              `🛡️ *ఇన్సూరెన్స్ దరఖాస్తు*\n\nఇప్పుడే ఆధార్, PAN, నామినీ వివరాలు నమోదు చేయాలా?`,
              [{ id: 'insurance_yes', title: '🛡️ అవును, దరఖాస్తు చేయి' }, { id: 'insurance_no', title: '❌ వద్దు, తర్వాత' }]
            );
            return;
          }
        } else {
          const citizenRole = await prisma.role.findUnique({ where: { name: 'CITIZEN_REPORTER' } })
            ?? await prisma.role.findUnique({ where: { name: 'REPORTER' } })
            ?? await prisma.role.findFirst();
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

        await prisma.userProfile.upsert({
          where:  { userId: user.id },
          create: { userId: user.id, fullName: data.fullName, dob: data.dob ? new Date(data.dob) : undefined },
          update: { fullName: data.fullName, ...(data.dob ? { dob: new Date(data.dob) } : {}) },
        });

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
            linkedTenantId:     data.tenantId || null,
          },
        });

        await (prisma as any).whatsappBotSession.update({
          where: { phone },
          data: {
            step: 'AWAIT_INSURANCE_OPT',
            data: { ...data, userId: user.id, journalistProfileId: profile.id },
            expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
          },
        });

        await reply(phone,
          `✅ *నమోదు విజయవంతంగా పూర్తైంది!*\n\n` +
          `స్వాగతం, *${data.fullName || 'సభ్యుడు'}*!` +
          (isNew ? `\n📱 మొబైల్: ${mobileRaw}\n${data.mpin ? `🔑 MPIN: ${data.mpin} (దీన్ని సేవ్ చేయండి!)` : ''}` : '') +
          `\n\n📋 మీ దరఖాస్తు అడ్మిన్ అప్రూవ్ చేసిన తర్వాత *${unionCardName} ID కార్డ్* WhatsApp లో పంపబడుతుంది.`
        );
        await replyButtons(phone,
          `🛡️ *ఇన్సూరెన్స్ దరఖాస్తు*\n\nఇప్పుడే ఆధార్, PAN, నామినీ వివరాలు నమోదు చేయాలా?`,
          [{ id: 'insurance_yes', title: '🛡️ అవును, నమోదు చేయి' }, { id: 'insurance_no', title: '❌ తర్వాత చేస్తా' }]
        );
      } catch (err: any) {
        console.error('[WhatsApp Bot] Registration error:', err?.message);
        await reply(phone, '❌ నమోదు విఫలమైంది. మళ్ళీ ప్రయత్నించండి లేదా అడ్మిన్‌ని సంప్రదించండి.');
      }
      break;
    }

    // ── INSURANCE OPT-IN ──────────────────────────────────────────────────────
    case 'AWAIT_INSURANCE_OPT': {
      const wantsInsurance = ['insurance_yes', 'yes', 'అవును', 'ok'].includes(inputLower);
      if (wantsInsurance) {
        await advanceStep('AWAIT_AADHAAR', {});
        await replyButtons(phone,
          `🛡️ *ఇన్సూరెన్స్ దరఖాస్తు*\n\n` +
          `📄 *దశ 1/4* — మీ *ఆధార్ కార్డ్ ముందు భాగం* ఫోటో పంపండి (ఇమేజ్‌గా):\n\n` +
          `(ఆధార్ నంబర్ మరియు పేరు స్పష్టంగా కనిపించాలి)`,
          [{ id: 'SKIP', title: 'తర్వాత పంపిస్తా' }]
        );
      } else {
        await (prisma as any).whatsappBotSession.update({
          where: { phone },
          data: { step: 'DONE', expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS) },
        });
        await reply(phone,
          `✅ సరే! మీరు తర్వాత ఇన్సూరెన్స్ కోసం దరఖాస్తు చేయవచ్చు.\n\n` +
          `"djfw" అని పంపి మళ్ళీ మొదలుపెట్టవచ్చు.`
        );
      }
      break;
    }

    // ── INSURANCE STEP 4: Nominee Name (last step) ───────────────────────────
    case 'AWAIT_NOMINEE': {
      if (inputLower === 'skip' || inputLower === 'later') {
        await advanceStep('KYC_SUBMITTED', {});
        await kycSubmittedMessage(phone, data);
        return;
      }
      if (input.length < 2) {
        await replyButtons(phone,
          '👥 *ఇన్సూరెన్స్ దశ 4/4* — మీ *నామినీ పేరు* నమోదు చేయండి:\n\n(బీమా దావాలో ఈ వ్యక్తికి చెల్లింపు జరుగుతుంది)',
          [{ id: 'SKIP', title: 'తర్వాత నమోదు చేస్తా' }]
        );
        return;
      }
      if (data.journalistProfileId) {
        await (prisma as any).journalistProfile.update({
          where: { id: data.journalistProfileId },
          data: { nomineeName: input },
        }).catch((e: any) => console.error('[WhatsApp Bot] nominee update failed:', e?.message));
      }
      await advanceStep('KYC_SUBMITTED', { nomineeName: input });
      await kycSubmittedMessage(phone, { ...data, nomineeName: input });
      break;
    }

    // ── INSURANCE STEP 1 (photo): Aadhaar Front ──────────────────────────────
    case 'AWAIT_AADHAAR': {
      if (inputLower === 'skip' || inputLower === 'later') {
        await advanceStep('AWAIT_AADHAAR_BACK', {});
        await replyButtons(phone,
          `⏭️ ఆధార్ ముందు భాగం వదిలివేయబడింది.\n\n📄 *దశ 2/4* — మీ *ఆధార్ కార్డ్ వెనక భాగం* ఫోటో పంపండి (ఇమేజ్‌గా):`,
          [{ id: 'SKIP', title: 'వెనక భాగం వదిలివేయి' }]
        );
        return;
      }
      if (!mediaId) {
        await replyButtons(phone,
          '📄 *ఇన్సూరెన్స్ దశ 1/4* — దయచేసి మీ *ఆధార్ కార్డ్ ముందు భాగం* ఇమేజ్‌గా పంపండి.\n\n(ఆధార్ నంబర్ మరియు పేరు స్పష్టంగా కనిపించాలి)',
          [{ id: 'SKIP', title: 'ఆధార్ వదిలివేయి' }]
        );
        return;
      }
      const aadhaarUrl = await uploadBotMedia(mediaId, `${data.journalistProfileId || phone}/aadhaar`);
      if (!aadhaarUrl) { await reply(phone, '❌ అప్‌లోడ్ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.'); return; }
      if (data.journalistProfileId) {
        await (prisma as any).journalistProfile.update({
          where: { id: data.journalistProfileId },
          data: { aadhaarUrl },
        }).catch((e: any) => console.error('[WhatsApp Bot] aadhaar update failed:', e?.message));
      }
      await advanceStep('AWAIT_AADHAAR_BACK', { aadhaarUrl });
      await replyButtons(phone,
        `✅ ఆధార్ ముందు భాగం అందుకున్నాం!\n\n📄 *ఇన్సూరెన్స్ దశ 2/4* — మీ *ఆధార్ కార్డ్ వెనక భాగం* ఫోటో పంపండి (ఇమేజ్‌గా):`,
        [{ id: 'SKIP', title: 'వెనక భాగం వదిలివేయి' }]
      );
      break;
    }

    // ── INSURANCE STEP 2: Aadhaar Back ───────────────────────────────────────
    case 'AWAIT_AADHAAR_BACK': {
      if (inputLower === 'skip' || inputLower === 'later') {
        await advanceStep('AWAIT_PAN', {});
        await replyButtons(phone,
          `⏭️ ఆధార్ వెనక భాగం వదిలివేయబడింది.\n\n💳 *ఇన్సూరెన్స్ దశ 3/4* — మీ *PAN కార్డ్* ఫోటో పంపండి (ఇమేజ్‌గా):`,
          [{ id: 'SKIP', title: 'PAN వదిలివేయి' }]
        );
        return;
      }
      if (!mediaId) {
        await replyButtons(phone,
          '📄 *ఇన్సూరెన్స్ దశ 2/4* — దయచేసి మీ *ఆధార్ కార్డ్ వెనక భాగం* ఇమేజ్‌గా పంపండి.',
          [{ id: 'SKIP', title: 'వెనక భాగం వదిలివేయి' }]
        );
        return;
      }
      const aadhaarBackUrl = await uploadBotMedia(mediaId, `${data.journalistProfileId || phone}/aadhaar_back`);
      if (!aadhaarBackUrl) { await reply(phone, '❌ అప్‌లోడ్ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.'); return; }
      if (data.journalistProfileId) {
        await (prisma as any).journalistProfile.update({
          where: { id: data.journalistProfileId },
          data: { aadhaarBackUrl },
        }).catch((e: any) => console.error('[WhatsApp Bot] aadhaarBack update failed:', e?.message));
      }
      await advanceStep('AWAIT_PAN', { aadhaarBackUrl });
      await replyButtons(phone,
        `✅ ఆధార్ వెనక భాగం అందుకున్నాం!\n\n💳 *ఇన్సూరెన్స్ దశ 3/4* — మీ *PAN కార్డ్* ఫోటో పంపండి (ఇమేజ్‌గా):`,
        [{ id: 'SKIP', title: 'PAN వదిలివేయి' }]
      );
      break;
    }

    // ── INSURANCE STEP 3: PAN Card ────────────────────────────────────────────
    case 'AWAIT_PAN': {
      if (inputLower === 'skip' || inputLower === 'later') {
        await advanceStep('AWAIT_NOMINEE', {});
        await replyButtons(phone,
          `⏭️ PAN కార్డ్ వదిలివేయబడింది.\n\n👥 *ఇన్సూరెన్స్ దశ 4/4* — మీ *నామినీ పేరు* నమోదు చేయండి:\n(బీమా దావాలో ఈ వ్యక్తికి చెల్లింపు జరుగుతుంది)`,
          [{ id: 'SKIP', title: 'తర్వాత నమోదు చేస్తా' }]
        );
        return;
      }
      if (!mediaId) {
        await replyButtons(phone,
          '💳 *ఇన్సూరెన్స్ దశ 3/4* — దయచేసి మీ *PAN కార్డ్* ఫోటో ఇమేజ్‌గా పంపండి.\n\n(పేరు మరియు PAN నంబర్ కనిపించే ముందు భాగం)',
          [{ id: 'SKIP', title: 'PAN వదిలివేయి' }]
        );
        return;
      }
      const panCardUrl = await uploadBotMedia(mediaId, `${data.journalistProfileId || phone}/pan`);
      if (!panCardUrl) { await reply(phone, '❌ అప్‌లోడ్ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.'); return; }
      if (data.journalistProfileId) {
        await (prisma as any).journalistProfile.update({
          where: { id: data.journalistProfileId },
          data: { panCardUrl },
        }).catch((e: any) => console.error('[WhatsApp Bot] pan update failed:', e?.message));
      }
      await advanceStep('AWAIT_NOMINEE', { panCardUrl });
      await replyButtons(phone,
        `✅ PAN కార్డ్ అందుకున్నాం!\n\n👥 *ఇన్సూరెన్స్ దశ 4/4* — మీ *నామినీ పేరు* నమోదు చేయండి:\n(బీమా దావాలో ఈ వ్యక్తికి చెల్లింపు జరుగుతుంది)`,
        [{ id: 'SKIP', title: 'తర్వాత నమోదు చేస్తా' }]
      );
      break;
    }

    case 'KYC_SUBMITTED':
    case 'DONE':
      await reply(phone,
        `✅ మీ దరఖాస్తు సమీక్షలో ఉంది.\n\n` +
        `⏳ అడ్మిన్ మీ KYC వెరిఫై చేసిన తర్వాత, మీ *${unionCardName} ID కార్డ్* ఇక్కడ WhatsApp లో పంపబడుతుంది.\n\n` +
        `కొత్త నమోదు చేయాలంటే *రద్దు* అని పంపండి.`
      );
      break;

    default:
      break;
  }
  } catch (err: any) {
    console.error('[WhatsApp Bot] Unhandled error in step', step, ':', err?.message, (err?.stack || '').split('\n')[1]);
    await sendWhatsappTextMessage({ to: phone, text: '❌ సాంకేతిక సమస్య వచ్చింది. మళ్ళీ ప్రయత్నించండి లేదా *DJFW* పంపండి.' }).catch(() => {});
  }
}

async function kycSubmittedMessage(phone: string, data: Record<string, any>) {
  await reply(phone,
    `🎉 *ఇన్సూరెన్స్ దరఖాస్తు సమర్పించబడింది!*\n\n` +
    `ధన్యవాదాలు, *${data.fullName || 'సభ్యుడు'}*!\n\n` +
    `📋 మీ దరఖాస్తు సమీక్షలో ఉంది.\n` +
    `✅ మా అడ్మిన్ మీ డాక్యుమెంట్లు వెరిఫై చేసిన తర్వాత, మీ *యూనియన్ ID కార్డ్* WhatsApp లో పంపబడుతుంది.\n\n` +
    `⏳ సాధారణంగా *1–3 పని దినాలు* పడుతుంది.\n\n` +
    `సందేహాలకు మీ యూనియన్ అడ్మిన్‌ని సంప్రదించండి.`
  );
}

export default router;