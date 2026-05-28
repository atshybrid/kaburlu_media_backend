import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { config } from '../../config/env';
import { sendWhatsappTextMessage, sendWhatsappButtons, sendWhatsappList, downloadWhatsappMedia, sendWhatsappIdCardTemplate } from '../../lib/whatsapp';
import { updateTemplateStatusByName } from '../../lib/whatsappTemplateDb';
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

        // Template approval / rejection from Meta
        if (change.field === 'message_template_status_update') {
          const tplName = value.message_template_name;
          const tplStatus = value.event || value.message_template_status;
          const tplId = value.message_template_id ? String(value.message_template_id) : undefined;
          const reason = value.reason && value.reason !== 'NONE' ? String(value.reason) : null;
          console.log(`[WhatsApp Webhook] Template ${tplName} → ${tplStatus}`);
          if (tplName && tplStatus) {
            updateTemplateStatusByName(tplName, {
              status: tplStatus,
              rejectedReason: reason,
              templateId: tplId,
            }).catch((e: any) =>
              console.error('[WhatsApp Webhook] Template DB update error:', e?.message),
            );
          }
          (prisma as any).whatsappWebhookEvent
            .create({
              data: {
                eventType: 'template_status',
                waMessageId: tplId || null,
                from: null,
                to: null,
                status: tplStatus || null,
                messageType: 'template',
                bodyText: tplName || null,
                errorMsg: reason,
                rawPayload: value,
                phoneNumberId: null,
              },
            })
            .catch(() => null);
          continue;
        }

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
  'AWAIT_EXPERIENCE',
  'AWAIT_STATE_SELECT',
  'AWAIT_WORKING_AREA',
  'AWAIT_DOB',
  'AWAIT_MPIN',
  'CONFIRM',
  'AWAIT_PROFILE_PHOTO',
  'AWAIT_ID_CARD_PHOTO',
  'MEMBER_MENU',
  'PRESIDENT_MENU',
  'AWAIT_UPDATE_NOMINEE',
  'AWAIT_KYC_LIST',
  'AWAIT_KYC_REVIEW',
  'AWAIT_MEMBER_BROWSE',
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

const MY_TEAM_KEYWORDS = ['my team', 'myteam', 'నా టీమ్', 'నా జట్టు', 'team members', 'team list'];

const ADMIN_KEYWORDS = ['admin', 'kyc approve', 'kyc list', 'members list', 'approve kyc', 'president menu', 'అడ్మిన్', 'kyc', 'మెనూ', 'menu'];

const GREETING_KEYWORDS = ['hi', 'hello', 'hey', 'helo', 'hii', 'హలో', 'నమస్కారం', 'నమస్కారము', 'నమస్తే', 'నమస్తె'];

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

/** Kaburlu mobile app — Android Play Store (iOS not available yet). */
const KABURLU_ANDROID_APP_URL =
  'https://play.google.com/store/apps/details?id=com.media.kaburlu&hl=en_IN';

async function sendKaburluAndroidAppLink(phone: string) {
  await reply(
    phone,
    `📱 *Kaburlu – Digital Short News* (Android)\n\n` +
      `డౌన్‌లోడ్:\n${KABURLU_ANDROID_APP_URL}\n\n` +
      `_iOS యాప్ త్వరలో వస్తోంది._`,
  );
}

async function sendUnionRegistrationPendingMessage(phone: string, unionCardName: string, fullName?: string) {
  await reply(
    phone,
    `✅ *నమోదు పూర్తయింది!*\n\n` +
      `ధన్యవాదాలు${fullName ? `, *${fullName}*` : ''}!\n\n` +
      `⏳ మీ *${unionCardName}* యూనియన్ సభ్యత్వం *ప్రెసిడెంట్ నిర్ధారించిన* తర్వాత మీకు *ID కార్డ్* ఈ వాట్సాప్‌లో పంపబడుతుంది.\n\n` +
      `మరిన్ని వివరాలు & వార్తల కోసం Kaburlu యాప్ డౌన్‌లోడ్ చేయండి:`,
  );
  await sendKaburluAndroidAppLink(phone);
}

/** Member menu — ID download (approved only) + Insurance / app link. */
function buildJournalistMemberWaButtons(approved: boolean): { id: string; title: string }[] {
  const b: { id: string; title: string }[] = [];
  if (approved) b.push({ id: 'download_id_card', title: '📥 ID కార్డ్ డౌన్‌లోడ్' });
  b.push({ id: 'insurance_active', title: '🛡️ ఇన్సూరెన్స్ యాక్టివ్' });
  return b;
}

async function completeSimpleUnionRegistration(
  phone: string,
  session: { unionName: string; data: unknown },
  data: Record<string, any>,
  unionCardName: string,
): Promise<void> {
  const waSender10 = whatsappSenderMobile10(phone);
  if (!waSender10) {
    await reply(phone, '⚠️ వాట్సాప్ నంబర్ నుండి మొబైల్ గుర్తించలేము. అడ్మిన్‌ని సంప్రదించండి.');
    return;
  }
  const mobileRaw = waSender10;
  const photoUrl = data.profilePhotoUrl || data.reporterPhotoUrl || null;

  try {
    let user = await prisma.user.findUnique({ where: { mobileNumber: mobileRaw } });
    if (!user) {
      const citizenRole =
        (await prisma.role.findUnique({ where: { name: 'CITIZEN_REPORTER' } })) ??
        (await prisma.role.findUnique({ where: { name: 'REPORTER' } })) ??
        (await prisma.role.findFirst());
      const lang = (await prisma.language.findFirst({ where: { code: 'te' } })) ?? (await prisma.language.findFirst());
      if (!citizenRole || !lang) throw new Error('Role or language not configured');
      const last4 = mobileRaw.slice(-4);
      const mpinHash = await bcrypt.hash(last4, 10);
      user = await prisma.user.create({
        data: {
          mobileNumber: mobileRaw,
          mpin: mpinHash,
          roleId: citizenRole.id,
          languageId: lang.id,
          status: 'PENDING',
        },
      });
    }

    const existingJp = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } }).catch(() => null);
    if (existingJp) {
      await (prisma as any).whatsappBotSession.delete({ where: { phone } }).catch(() => {});
      await sendUnionRegistrationPendingMessage(phone, unionCardName, data.fullName as string);
      return;
    }

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: data.fullName,
        dob: data.dob ? new Date(data.dob) : undefined,
        ...(photoUrl ? { profilePhotoUrl: photoUrl } : {}),
      },
      update: {
        fullName: data.fullName,
        ...(data.dob ? { dob: new Date(data.dob) } : {}),
        ...(photoUrl ? { profilePhotoUrl: photoUrl } : {}),
      },
    });

    await (prisma as any).journalistProfile.create({
      data: {
        userId: user.id,
        designation: 'Union Member',
        district: data.district || '',
        organization: data.newspaper || '',
        unionName: session.unionName,
        state: data.state || null,
        mandal: data.mandal || null,
        currentNewspaper: data.newspaper || null,
        currentDesignation: data.designation || 'Reporter',
        photoUrl,
        approved: false,
        kycVerified: false,
      },
    });

    await (prisma as any).whatsappBotSession.delete({ where: { phone } }).catch(() => {});
    await sendUnionRegistrationPendingMessage(phone, unionCardName, data.fullName as string);
  } catch (err: any) {
    console.error('[WhatsApp Bot] Simple registration error:', err?.message);
    await reply(phone, '❌ నమోదు విఫలమైంది. మళ్ళీ *DJFW* పంపి ప్రయత్నించండి లేదా అడ్మిన్‌ని సంప్రదించండి.');
  }
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

/** Generate (if needed) and send journalist union press ID PDF on WhatsApp. */
async function deliverJournalistPressIdCardWhatsapp(
  phone: string,
  profileId: string,
  unionCardLabel: string,
): Promise<{ ok: boolean }> {
  const jp = await (prisma as any).journalistProfile
    .findUnique({
      where: { id: profileId },
      include: { card: { select: { pdfUrl: true } } },
    })
    .catch(() => null);
  if (!jp) return { ok: false };
  if (!jp.approved) return { ok: false };
  const label = unionCardLabel || 'యూనియన్';
  let pdfUrl: string | null = jp.card?.pdfUrl || null;
  if (!pdfUrl) {
    let card = await (prisma as any).journalistCard.findUnique({ where: { profileId } }).catch(() => null);
    if (!card) {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      card = await (prisma as any).journalistCard.create({
        data: { profileId, cardNumber: `JU-${Date.now()}`, expiryDate: expiry, status: 'ACTIVE' },
      });
    }
    const pdfResult = await generateAndUploadPressCardPdf(profileId);
    if (!pdfResult.ok || !pdfResult.pdfUrl) return { ok: false };
    pdfUrl = pdfResult.pdfUrl;
  }
  const sendResult = await sendWhatsappIdCardTemplate({
    toMobileNumber: phone,
    pdfUrl,
    cardType: `${label} ID`,
    organizationName: jp.currentNewspaper || jp.organization || 'Journalist Union',
    documentType: `${label} ID Card`,
    pdfFilename: `Press_ID_${profileId.slice(-8).toUpperCase()}.pdf`,
  });
  if (!sendResult.ok) await reply(phone, `🪪 మీ ID కార్డ్ లింక్: ${pdfUrl}`);
  return { ok: true };
}

async function processWhatsappBotMessage(phone: string, text: string, mediaId: string | null = null) {
  const input = text.trim();
  const inputLower = input.toLowerCase();

  // "my team" command — works at any point (president/union admin feature)
  if (MY_TEAM_KEYWORDS.some(k => inputLower.includes(k))) {
    await handleMyTeamRequest(phone);
    return;
  }

  // "admin/menu/kyc" keyword — shortcut to president/admin menu at any point
  if (ADMIN_KEYWORDS.some(k => inputLower === k || inputLower.startsWith(k + ' ') || inputLower.endsWith(' ' + k))) {
    await handleAdminMenuRequest(phone);
    return;
  }

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

    const isGreeting = GREETING_KEYWORDS.some(k => inputLower === k || inputLower.startsWith(k + ' '));
    if (isGreeting || !TRIGGER_KEYWORDS.some(k => inputLower.includes(k))) {
      const welcomeUnion = unionDisplayName || 'DJFW';
      const wa10 = whatsappSenderMobile10(phone);
      const existingUser = await findUserByWaPhone(phone);
      const existingUserProfile = existingUser
        ? await prisma.userProfile
            .findUnique({
              where: { userId: existingUser.id },
              select: { fullName: true, dob: true, profilePhotoUrl: true },
            })
            .catch(() => null)
        : null;

      /** One-line + detail for WhatsApp identity (no manual number ask). */
      const waHeader = (statusTelugu: string, detail?: string) =>
        (wa10
          ? `📱 *ఈ వాట్సాప్ నంబర్:* +91${wa10}\n*గుర్తింపు:* ${statusTelugu}${detail ? `\n${detail}` : ''}\n\n`
          : `⚠️ *వాట్సాప్ నంబర్:* గుర్తించలేము (భారత 10 అంకెల ఫార్మాట్ కావాలి).\n\n`);

      if (!wa10) {
        await replyButtons(phone,
          waHeader('స్పష్టంగా గుర్తించలేము') +
            `👋 *${welcomeUnion}‌కు స్వాగతం!*\n\nసహాయం కోసం *JOIN* లేదా అడ్మిన్‌ని సంప్రదించండి.`,
          [{ id: 'JOIN', title: '📋 నమోదు / సహాయం' }],
        );
        return;
      }

      // 1) President / union admin (DB role — not “ask number”, use WA-linked user only)
      if (existingUser) {
        const presCtx = await tryResolvePresidentMenuContext(existingUser.id);
        if (presCtx) {
          const settings = await (prisma as any).journalistUnionSettings.findFirst({
            where: { unionName: presCtx.unionName },
            select: { displayName: true },
          }).catch(() => null);
          const displayName = settings?.displayName || presCtx.unionName;
          await reply(
            phone,
            waHeader(
              'ప్రెసిడెంట్ / యూనియన్ అధికారి',
              `📌 *యూనియన్:* ${displayName}${presCtx.state ? ` | రాష్ట్రం: ${presCtx.state}` : ''}`,
            ) +
              `👑 కింది మెనూతో KYC అప్రూవల్, సభ్యుల జాబితా మొదలైనవి చూడవచ్చు.`,
          );
          await showPresidentMenu(
            phone,
            existingUser.id,
            presCtx.profileId || '',
            presCtx.unionName,
            presCtx.state,
            displayName,
          );
          return;
        }
      }

      const existingProfile = existingUser
        ? await (prisma as any).journalistProfile.findUnique({
            where: { userId: existingUser.id },
            select: { id: true, currentDesignation: true, designation: true, state: true, approved: true, unionName: true },
          }).catch(() => null)
        : null;

      if (existingProfile) {
        const isAdmin = await checkIsAdminOrPresident(
          existingUser!.id,
          existingProfile.id,
          existingProfile.unionName || unionName || '',
        );
        if (isAdmin) {
          const displayName =
            (await (prisma as any).journalistUnionSettings.findFirst({
              where: { unionName: existingProfile.unionName || unionName },
              select: { displayName: true },
            }).catch(() => null))?.displayName ||
            existingProfile.unionName ||
            unionDisplayName ||
            'DJFW';
          await reply(
            phone,
            waHeader(
              'ప్రెసిడెంట్ / యూనియన్ అధికారి',
              `📌 *యూనియన్:* ${displayName}${existingProfile.state ? ` | రాష్ట్రం: ${existingProfile.state}` : ''}`,
            ) + `👑 అడ్మిన్ మెనూ క్రింద ఉంది.`,
          );
          await showPresidentMenu(
            phone,
            existingUser!.id,
            existingProfile.id,
            existingProfile.unionName || unionName || '',
            existingProfile.state || null,
            unionDisplayName || unionName || 'DJFW',
          );
          return;
        }
        const statusLine = existingProfile.approved ? '✅ సభ్యత్వం అప్రూవ్ అయింది' : '⏳ అప్రూవల్ పెండింగ్';
        const positionLine = existingProfile.currentDesignation || existingProfile.designation || '';
        await replyButtons(phone,
          waHeader(
            'జర్నలిస్ట్ యూనియన్ సభ్యుడు',
            `📌 *${welcomeUnion}* | ${statusLine}${existingProfile.state ? ` | 📍 ${existingProfile.state}` : ''}`,
          ) +
            `👋 స్వాగతం!

${statusLine}
${positionLine ? `🏷️ ${positionLine}` : ''}${existingProfile.state ? ` | 📍 ${existingProfile.state}` : ''}

మీరు ఏమి చేయాలనుకుంటున్నారు?`,
          buildJournalistMemberWaButtons(!!existingProfile.approved),
        );
      } else if (existingUser) {
        const rep = await (prisma as any).reporter.findUnique({
          where: { userId: existingUser.id },
          include: {
            designation: { select: { name: true, nativeName: true } },
            tenant: { select: { name: true } },
            district: { include: { state: { select: { name: true } } } },
            mandal: { include: { district: { include: { state: { select: { name: true } } } } } },
            state: { select: { name: true } },
          },
        }).catch(() => null);
        const p = existingUserProfile;

        if (rep) {
          const designation = rep.designation?.name || rep.designation?.nativeName || 'Reporter';
          const newspaper = rep.tenant?.name || '';
          const districtObj = rep.district || (rep.mandal as any)?.district || null;
          const district = districtObj?.name || '';
          const state = districtObj?.state?.name || (rep as any).state?.name || '';
          const mandal = rep.mandal?.name || '';
          const baseData: Record<string, any> = {
            unionDisplayName: unionDisplayName || unionName,
            mobileNumber: wa10,
            userId: existingUser.id,
            reporterId: rep.id,
            tenantId: rep.tenantId || null,
            reporterPhotoUrl: rep.profilePhotoUrl || null,
            profilePhotoUrl: p?.profilePhotoUrl || null,
            fullName: p?.fullName || '',
            designation,
            newspaper,
            dob: p?.dob ? (p.dob as Date).toISOString().split('T')[0] : null,
            prefilled: true,
            existingUser: true,
            registrationMode: 'reporter',
          };
          if (!district) {
            await (prisma as any).whatsappBotSession.create({
              data: {
                phone,
                step: 'AWAIT_WORKING_AREA',
                unionName: unionName!,
                data: { ...baseData, district: '', state, mandal },
                expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
              },
            });
            await reply(
              phone,
              waHeader('టెనంట్ రిపోర్టర్', `📰 *${newspaper}*`) +
                `📋 మీ వివరాలు కనుగొన్నాం!\n\n👤 *${p?.fullName || 'N/A'}* | 📰 *${newspaper}*\n\n📍 *పని ప్రాంతం* (జిల్లా) నమోదు చేయండి:`,
            );
          } else {
            await (prisma as any).whatsappBotSession.create({
              data: {
                phone,
                step: 'CONFIRM',
                unionName: unionName!,
                data: { ...baseData, district, state, mandal },
                expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
              },
            });
            await replyButtons(
              phone,
              waHeader('టెనంట్ రిపోర్టర్', `📰 *${newspaper}*`) +
                `📋 *మీ వివరాలు కనుగొన్నాం!*\n\n👤 *${p?.fullName || 'N/A'}*\n📱 *${wa10}*\n📰 *${newspaper}*\n📍 *${district}*\n\nయూనియన్ సభ్యత్వం కోసం నిర్ధారించండి:`,
              [{ id: 'CONFIRM', title: '✅ నిర్ధారించు' }, { id: 'cancel', title: '❌ రద్దు' }],
            );
          }
        } else {
          const hasName = !!(p?.fullName && String(p.fullName).trim().length >= 2);
          await (prisma as any).whatsappBotSession.create({
            data: {
              phone,
              step: hasName ? 'AWAIT_DOB' : 'AWAIT_NAME',
              unionName: unionName!,
              data: {
                unionDisplayName: unionDisplayName || unionName,
                registrationMode: 'simple',
                mobileNumber: wa10,
                userId: existingUser.id,
                fullName: p?.fullName || '',
                profilePhotoUrl: p?.profilePhotoUrl || null,
              },
              expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
            },
          });
          if (hasName) {
            await replyButtons(
              phone,
              waHeader('యూనియన్ సభ్యత్వ నమోదు', 'మీరు ఇంకా యూనియన్ సభ్యుడు కాదు — నమోదు ప్రారంభిస్తున్నాం.') +
                `👤 పేరు: *${p!.fullName}*\n\n📝 *దశ 2/5* — జన్మ తేదీ (DD-MM-YYYY):`,
              [{ id: 'SKIP', title: 'వదిలివేయి' }],
            );
          } else {
            await reply(
              phone,
              waHeader('యూనియన్ సభ్యత్వ నమోదు', 'మీరు ఇంకా యూనియన్ సభ్యుడు కాదు.') +
                `👋 *${welcomeUnion}‌కు స్వాగతం!*\n\n📝 *దశ 1/5* — మీ *పూర్తి పేరు* నమోదు చేయండి:`,
            );
          }
        }
      } else {
        await (prisma as any).whatsappBotSession.create({
          data: {
            phone,
            step: 'AWAIT_NAME',
            unionName: unionName!,
            data: {
              unionDisplayName: unionDisplayName || unionName,
              registrationMode: 'simple',
              mobileNumber: wa10,
            },
            expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
          },
        });
        await reply(
          phone,
          waHeader('కొత్త సభ్యుడు', `📱 +91${wa10}`) +
            `👋 *${welcomeUnion}‌కు స్వాగతం!*\n\n📝 *దశ 1/5* — మీ *పూర్తి పేరు* నమోదు చేయండి:`,
        );
      }
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
    const sender10 = whatsappSenderMobile10(phone);
    if (!sender10) {
      await reply(phone,
        `👋 *${regUnion} సభ్యత్వ నమోదు*\n\n` +
        `⚠️ మీ వాట్సాప్ నంబర్ నుండి సరైన భారతీయ మొబైల్ (10 అంకెలు) గుర్తించలేకపోయాము. అడ్మిన్‌ని సంప్రదించండి.`,
      );
      return;
    }
    // Bind registration to this WhatsApp number only (no manual “other” number) — prevents fake / duplicate accounts.
    await processWhatsappBotMessage(phone, sender10, null);
    return;
  }

  const step = session.step as BotStep;
  const data: Record<string, any> = (session.data as Record<string, any>) || {};
  const unionCardName = (data.unionDisplayName as string) || session.unionName || 'యూనియన్';

  async function advanceStep(nextStep: BotStep, newData: Record<string, any>) {
    // Strip undefined values — Prisma throws PrismaClientValidationError on undefined in Json fields
    const merged = JSON.parse(JSON.stringify({ ...data, ...newData }));
    await (prisma as any).whatsappBotSession.update({
      where: { phone },
      data: {
        step: nextStep,
        data: merged,
        expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
      },
    });
  }

  try {
  switch (step) {

    // ── STEP 0: Mobile number ────────────────────────────────────────────────
    case 'AWAIT_MOBILE': {
      const sender10 = whatsappSenderMobile10(phone);
      if (!sender10) {
        await reply(phone, '⚠️ వాట్సాప్ నంబర్ నుండి మొబైల్ గుర్తించలేము. అడ్మిన్‌ని సంప్రదించండి.');
        return;
      }
      const mobile = input.replace(/\D/g, '');
      const mobile10 = mobile.length === 12 && mobile.startsWith('91') ? mobile.slice(2) : mobile;
      if (!/^[6-9]\d{9}$/.test(mobile10)) {
        await reply(phone, '⚠️ దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.');
        return;
      }
      if (mobile10 !== sender10) {
        await reply(
          phone,
          `🔒 *భద్రత*\n\n` +
            `నమోదు *ఈ వాట్సాప్ నంబర్* తో మాత్రమే: *${sender10}*\n` +
            `మరొక నంబర్ నమోదు చేయలేరు (ఫేక్ / డూప్లికేట్ ఖాతాల నివారణ).\n\n` +
            `దయచేసి *${sender10}* లేదా *91${sender10}* పంపండి.`,
        );
        return;
      }
      const existingUser = await prisma.user.findUnique({
        where: { mobileNumber: mobile10 },
        include: { profile: true },
      });
      const existingJournalist = existingUser
        ? await (prisma as any).journalistProfile.findUnique({
            where: { userId: existingUser.id },
            include: { card: { select: { id: true, pdfUrl: true, status: true, expiryDate: true } } },
          })
        : null;

      if (existingJournalist) {
        // Already DJFW member — show member action menu
        const p = existingUser?.profile as any;
        const fullName = p?.fullName || existingJournalist.organization || 'సభ్యుడు';
        const pressId = existingJournalist.pressId || existingJournalist.id.slice(-8).toUpperCase();
        const uCardName = (await (prisma as any).journalistUnionSettings.findFirst({
          where: { unionName: existingJournalist.unionName },
          select: { displayName: true },
        }).catch(() => null))?.displayName || 'యూనియన్';

        const hasKyc = !!(existingJournalist.aadhaarUrl || existingJournalist.panCardUrl);
        const insurance = await (prisma as any).journalistInsurance.findFirst({
          where: { profileId: existingJournalist.id, isActive: true },
          select: { policyNumber: true },
          orderBy: { createdAt: 'desc' },
        }).catch(() => null);
        const kycLine = existingJournalist.kycVerified
          ? `✅ KYC వెరిఫైడ్`
          : hasKyc ? `⏳ KYC పరీక్షలో ఉంది` : `📋 KYC పెండింగ్`;
        const insuranceLine = insurance?.policyNumber
          ? `🛡️ ఇన్సూరెన్స్ యాక్టివ్`
          : `🛡️ ఇన్సూరెన్స్ పెండింగ్`;

        await advanceStep('MEMBER_MENU', {
          journalistProfileId: existingJournalist.id,
          mobileNumber: mobile10,
          fullName,
          unionCardName: uCardName,
        });

        await replyButtons(phone,
          `✅ *${uCardName} సభ్యత్వం యాక్టివ్!*\n\n` +
          `👤 *${fullName}* | ప్రెస్ ID: *${pressId}*\n` +
          `${kycLine} | ${insuranceLine}\n\n` +
          `మీరు ఏమి చేయాలనుకుంటున్నారు?`,
          buildJournalistMemberWaButtons(!!existingJournalist.approved),
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
            tenantId: existingReporter.tenantId || null,
            reporterPhotoUrl: existingReporter.profilePhotoUrl || null,
            profilePhotoUrl: p.profilePhotoUrl || null,
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
          profilePhotoUrl: p.profilePhotoUrl || null,
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

      // New user — simplified union registration (name → DOB → paper → area → ID photo)
      await advanceStep('AWAIT_NAME', { mobileNumber: mobile10, registrationMode: 'simple' });
      await reply(phone, `✅ మొబైల్: *${mobile10}*\n\n📝 *దశ 1/5* — మీ *పూర్తి పేరు* నమోదు చేయండి:`);
      break;
    }

    // ── STEP 1: Name ─────────────────────────────────────────────────────────
    case 'AWAIT_NAME':
      if (input.length < 2) { await reply(phone, '⚠️ దయచేసి సరైన పూర్తి పేరు నమోదు చేయండి.'); return; }
      if (data.registrationMode === 'simple') {
        await advanceStep('AWAIT_DOB', { fullName: input, designation: 'Reporter' });
        await replyButtons(
          phone,
          `✅ పేరు: *${input}*\n\n📝 *దశ 2/5* — జన్మ తేదీ (DD-MM-YYYY):\n(ఉదా: 15-06-1990)`,
          [{ id: 'SKIP', title: 'వదిలివేయి' }],
        );
        break;
      }
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
      if (data.registrationMode === 'simple') {
        const newspaper = inputLower === 'skip' ? '' : input.trim();
        if (newspaper.length < 2) {
          await reply(phone, '⚠️ దయచేసి మీ *పని వార్తాపత్రిక / ఛానెల్* పేరు నమోదు చేయండి.');
          return;
        }
        await advanceStep('AWAIT_WORKING_AREA', { newspaper, _awaitOtherNewspaper: undefined });
        await reply(phone, `✅ వార్తాపత్రిక: *${newspaper}*\n\n📍 *దశ 4/5* — మీ *పని ప్రాంతం* (జిల్లా / నగరం) నమోదు చేయండి:\n(ఉదా: గుంటూరు, హైదరాబాద్)`);
        break;
      }
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
      await advanceStep('AWAIT_EXPERIENCE', { newspaper, tenantId: tenantId || null, _awaitOtherNewspaper: undefined });
      await replyList(phone,
        `✅ వార్తాపత్రిక: *${newspaper || 'N/A'}*\n\n⏱️ *దశ 4/6* — మీ మొత్తం జర్నలిజం అనుభవం?`,
        'అనుభవం ఎంచుకోండి',
        [
          { id: 'exp:0', title: '1 సంవత్సరం కంటే తక్కువ' },
          { id: 'exp:1', title: '1–3 సంవత్సరాలు' },
          { id: 'exp:3', title: '3–5 సంవత్సరాలు' },
          { id: 'exp:5', title: '5–10 సంవత్సరాలు' },
          { id: 'exp:10', title: '10–20 సంవత్సరాలు' },
          { id: 'exp:20', title: '20+ సంవత్సరాలు' },
          { id: 'SKIP', title: 'వదిలివేయి' },
        ]
      );
      break;
    }

    // ── STEP 3b: State Selection ───────────────────────────────────────────────
    case 'AWAIT_STATE_SELECT': {
      let selectedState: string | null = null;
      if (input.startsWith('state:')) {
        const stateVal = input.replace('state:', '');
        selectedState = stateVal === 'OTHER' ? null : stateVal;
      } else {
        selectedState = input.trim() || null;
      }

      if (!selectedState) {
        // Other state — free text district search
        await advanceStep('AWAIT_WORKING_AREA', { state: null });
        await reply(phone, `📍 మీ జిల్లా/నగరం పేరు నమోదు చేయండి:\n(ఉదా: విశాఖపట్నం, కర్నూలు, ముంబై)`);
        return;
      }

      // Show top districts for the selected state
      const stateDistricts = await prisma.district.findMany({
        where: { state: { name: { contains: selectedState, mode: 'insensitive' } }, isDeleted: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 9,
      });

      await advanceStep('AWAIT_WORKING_AREA', { state: selectedState });
      if (stateDistricts.length > 0) {
        await replyList(phone,
          `✅ రాష్ట్రం: *${selectedState}*\n\n📍 మీ జిల్లా ఎంచుకోండి (లేదా పేరు టైప్ చేయండి):`,
          'జిల్లా ఎంచుకోండి',
          [
            ...stateDistricts.map(d => ({ id: `district:${d.id}`, title: d.name })),
            { id: 'SEARCH_DISTRICT', title: '🔍 వేరే జిల్లా వెతకండి' },
          ],
        );
      } else {
        await reply(phone, `✅ రాష్ట్రం: *${selectedState}*\n\n📍 మీ జిల్లా పేరు నమోదు చేయండి:`);
      }
      break;
    }

    // ── STEP 4: Working Area (District search) ────────────────────────────────
    case 'AWAIT_WORKING_AREA': {
      const goSimpleIdCardPhoto = async (areaPatch: Record<string, any>, areaLabel: string) => {
        await advanceStep('AWAIT_ID_CARD_PHOTO', {
          ...areaPatch,
          registrationMode: 'simple',
          idCardPhotoResumeStep: 'DONE',
        });
        await reply(
          phone,
          `✅ ప్రాంతం: *${areaLabel}*\n\n` +
            `📸 *దశ 5/5* — మీ *రిపోర్టర్ ID కార్డ్ / పాస్‌పోర్ట్ సైజ్ ఫోటో* ఇక్కడ *ఇమేజ్‌గా* పంపండి.\n\n` +
            `(ఈ ఫోటో యూనియన్ ID కార్డ్ కోసం ఉపయోగించబడుతుంది)`,
        );
      };

      // Prompt for district search when user clicks "search another"
      if (input === 'SEARCH_DISTRICT') {
        await reply(phone, `📍 జిల్లా పేరు నమోదు చేయండి (లేదా నగరం పేరు):`);
        return;
      }

      // Handle district selection from list
      if (input.startsWith('district:')) {
        const districtId = input.replace('district:', '');
        const d = await prisma.district.findUnique({
          where: { id: districtId },
          include: { state: { select: { name: true } } },
        });
        if (d) {
          const areaPatch = { district: d.name, districtId: d.id, state: d.state.name, mandal: '' };
          if (data.registrationMode === 'simple') {
            await goSimpleIdCardPhoto(areaPatch, `${d.name}, ${d.state.name}`);
            return;
          }
          await advanceStep('AWAIT_DOB', areaPatch);
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
          const areaPatch = {
            district: choice.name, districtId: choice.id,
            state: choice.stateName, mandal: '',
            _areaChoices: undefined,
          };
          if (data.registrationMode === 'simple') {
            await goSimpleIdCardPhoto(areaPatch, `${choice.name}, ${choice.stateName}`);
            return;
          }
          await advanceStep('AWAIT_DOB', areaPatch);
          await replyButtons(phone,
            `✅ ప్రాంతం: *${choice.name}*, ${choice.stateName}\n\n` +
            `📝 *దశ 5/5* — జన్మ తేదీ? Format: DD-MM-YYYY`,
            [{ id: 'SKIP', title: 'వదిలివేయి' }]
          );
          return;
        }
      }

      // Search districts in DB (filter by pre-selected state if available)
      const stateFilter = data.state
        ? { state: { name: { contains: data.state as string, mode: 'insensitive' as const } } }
        : {};
      const matches = await prisma.district.findMany({
        where: {
          name: { contains: input, mode: 'insensitive' },
          isDeleted: false,
          ...stateFilter,
        },
        include: { state: { select: { name: true } } },
        take: 9,
        orderBy: { name: 'asc' },
      });

      if (matches.length === 0) {
        // Accept as free text
        const areaPatch = { district: input, districtId: null, state: data.state || '', mandal: '' };
        if (data.registrationMode === 'simple') {
          await goSimpleIdCardPhoto(areaPatch, input);
          return;
        }
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
        const areaPatch = {
          district: d.name, districtId: d.id,
          state: (d.state as any).name, mandal: '',
        };
        if (data.registrationMode === 'simple') {
          await goSimpleIdCardPhoto(areaPatch, `${d.name}, ${(d.state as any).name}`);
          return;
        }
        await advanceStep('AWAIT_DOB', areaPatch);
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
      if (data.registrationMode === 'simple') {
        await advanceStep('AWAIT_NEWSPAPER', { dob, _awaitOtherNewspaper: true });
        await reply(
          phone,
          `✅ జన్మ తేదీ: *${dob || 'N/A'}*\n\n📝 *దశ 3/5* — మీ *పని వార్తాపత్రిక / ఛానెల్* పేరు నమోదు చేయండి:`,
        );
        break;
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

      const needsProfilePhoto = !data.reporterPhotoUrl && !data.profilePhotoUrl && !data.journalistProfileId;
      if (needsProfilePhoto) {
        await advanceStep('AWAIT_PROFILE_PHOTO', {});
        await replyButtons(phone,
          `📷 ID కార్డ్ కోసం మీ ఫోటో పంపండి. ఈ ఫోటో లేకుంటే ID కార్డ్ జనరేట్ చేయలేం.

మీరు తర్వాత "SKIP" అని పంపి అప్లికేషన్‌ను కొనసాగించవచ్చు.`,
          [{ id: 'skip', title: 'SKIP' }]
        );
        return;
      }

      const waSender10 = whatsappSenderMobile10(phone);
      if (!waSender10) {
        await reply(phone, '⚠️ వాట్సాప్ నంబర్ నుండి మొబైల్ గుర్తించలేము. అడ్మిన్‌ని సంప్రదించండి.');
        return;
      }
      const sessionMobile = String(data.mobileNumber || '')
        .replace(/\D/g, '')
        .slice(-10);
      if (sessionMobile && sessionMobile !== waSender10) {
        await reply(
          phone,
          '🔒 సెషన్‌లో ఉన్న మొబైల్ మీ వాట్సాప్ నంబర్‌కు సరిపోలలేదు. *CANCEL* పంపి మళ్ళీ *JOIN* చేయండి.',
        );
        return;
      }
      const mobileRaw = waSender10;

      try {
        // Existing journalist — find or create their card, generate PDF, send it, then insurance opt-in
        if (data.existingUser && data.journalistProfileId) {
          try {
            const jApproval = await (prisma as any).journalistProfile
              .findUnique({ where: { id: data.journalistProfileId as string }, select: { approved: true } })
              .catch(() => null);
            if (!jApproval?.approved) {
              await reply(
                phone,
                'ℹ️ *ID కార్డ్* అప్రూవ్ అయిన తర్వాత మాత్రమే పంపబడుతుంది. మీ సభ్యత్వం ఇంకా అప్రూవల్ పెండింగ్‌లో ఉంది.',
              );
            } else {
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
            }
          } catch (cardErr: any) {
            console.error('[WhatsApp Bot] Card generation error:', cardErr?.message);
            await reply(phone, `⚠️ ID కార్డ్ పంపడంలో సమస్య వచ్చింది. అడ్మిన్ మీతో సంప్రదిస్తారు.\n`);
          }
          await (prisma as any).whatsappBotSession.update({
            where: { phone },
            data: { step: 'AWAIT_AADHAAR', expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS) },
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
            // Already has a JournalistProfile — send their card only if approved, then insurance
            if (existing.approved) {
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
            } else {
              await reply(
                phone,
                'ℹ️ *ID కార్డ్* అప్రూవ్ అయిన తర్వాత మాత్రమే పంపబడుతుంది. మీ సభ్యత్వం ఇంకా అప్రూవల్ పెండింగ్‌లో ఉంది.',
              );
            }
            await (prisma as any).whatsappBotSession.update({
              where: { phone },
              data: { step: 'AWAIT_AADHAAR', data: { ...data, journalistProfileId: existing.id }, expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS) },
            });
            await replyButtons(phone,
              `🛡️ *ఇన్సూరెన్స్ దరఖాస్తు*\n\nఇప్పుడే ఆధార్, PAN, నామినీ వివరాలు నమోదు చేయాలా?`,
              [{ id: 'insurance_yes', title: '🛡️ అవును, దరఖాస్తు చేయి' }, { id: 'insurance_no', title: '❌ వద్దు, తర్వాత' }]
            );
            return;
          }

          // User exists but no JournalistProfile yet — tenant reporter: auto-approve membership (trusted); others: pending admin
          if (data.reporterId) {
            let linkedTenantName: string | null = (data.newspaper as string) || null;
            if (data.tenantId && !linkedTenantName) {
              const trow = await (prisma as any).tenant.findUnique({
                where: { id: data.tenantId as string },
                select: { name: true },
              }).catch(() => null);
              linkedTenantName = trow?.name ?? null;
            }
            const nowApproved = new Date();
            const pressId = `JU-TR-${Date.now()}`;
            const profile = await (prisma as any).journalistProfile.create({
              data: {
                userId: user.id,
                designation: 'Union Member',
                district: data.district || '',
                organization: data.newspaper || '',
                unionName: session.unionName,
                state: data.state || null,
                mandal: data.mandal || null,
                currentNewspaper: data.newspaper || null,
                currentDesignation: data.designation || null,
                linkedTenantId: data.tenantId || null,
                linkedTenantName,
                photoUrl: data.profilePhotoUrl || data.reporterPhotoUrl || null,
                approved: true,
                approvedAt: nowApproved,
                pressId,
                kycVerified: false,
              },
            });
            const expiry = new Date();
            expiry.setFullYear(expiry.getFullYear() + 1);
            await (prisma as any).journalistCard.create({
              data: {
                profileId: profile.id,
                cardNumber: `JU-${Date.now()}`,
                expiryDate: expiry,
                status: 'ACTIVE',
              },
            });
            let pdfUrl: string | null = null;
            try {
              const pdfResult = await generateAndUploadPressCardPdf(profile.id);
              if (pdfResult.ok && pdfResult.pdfUrl) pdfUrl = pdfResult.pdfUrl;
            } catch (_pdfErr) { /* non-fatal */ }
            if (pdfUrl) {
              const sendResult = await sendWhatsappIdCardTemplate({
                toMobileNumber: phone,
                pdfUrl,
                cardType: `${unionCardName} ID`,
                organizationName: data.newspaper || linkedTenantName || 'Journalist Union',
                documentType: `${unionCardName} ID Card`,
                pdfFilename: `Press_ID_${pressId.replace(/[^A-Z0-9-]/gi, '_')}.pdf`,
              });
              if (!sendResult.ok) {
                console.error('[WhatsApp Bot] ID card send failed (tenantReporter):', sendResult.error, sendResult.details);
                await reply(phone,
                  `✅ *${unionCardName}* సభ్యత్వం అప్రూవ్ అయింది (టెనంట్ రిపోర్టర్ ఫాస్ట్ ట్రాక్).\n` +
                  `🪪 ప్రెస్ ID: *${pressId}*\n\n` +
                  `⚠️ PDF ఇక్కడ పంపడం విఫలమైంది. లింక్: ${pdfUrl}`,
                );
              } else {
                await reply(phone,
                  `✅ *${unionCardName}* సభ్యత్వం *అప్రూవ్* అయింది — మీరు మా టెనంట్ రిపోర్టర్‌గా ధృవీకరించబడ్డారు.\n` +
                  `🪪 ప్రెస్ ID: *${pressId}*\n\n` +
                  `📄 ID కార్డ్ PDF పైన పంపబడింది.`,
                );
              }
            } else {
              await reply(phone,
                `✅ *${unionCardName}* సభ్యత్వం *అప్రూవ్* అయింది (టెనంట్ రిపోర్టర్ ఫాస్ట్ ట్రాక్).\n` +
                `🪪 ప్రెస్ ID: *${pressId}*\n\n` +
                `📷 ID కార్డ్ PDF కోసం ఫోటో అవసరం — *DJFW* పంపి ఫోటో అప్‌డేట్ చేయండి లేదా అడ్మిన్‌ను సంప్రదించండి.`,
              );
            }
            await (prisma as any).whatsappBotSession.update({
              where: { phone },
              data: { step: 'AWAIT_AADHAAR', data: { ...data, userId: user.id, journalistProfileId: profile.id }, expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS) },
            });
            await replyButtons(phone,
              `🛡️ *ఇన్సూరెన్స్ దరఖాస్తు*\n\nఇప్పుడే ఆధార్, PAN, నామినీ వివరాలు నమోదు చేయాలా? (KYC అడ్మిన్ సమీక్ష తర్వాత ఇన్సూరెన్స్)`,
              [{ id: 'insurance_yes', title: '🛡️ అవును, దరఖాస్తు చేయి' }, { id: 'insurance_no', title: '❌ వద్దు, తర్వాత' }],
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
          create: { userId: user.id, fullName: data.fullName, dob: data.dob ? new Date(data.dob) : undefined, ...(data.profilePhotoUrl ? { profilePhotoUrl: data.profilePhotoUrl } : {}) },
          update: { fullName: data.fullName, ...(data.dob ? { dob: new Date(data.dob) } : {}), ...(data.profilePhotoUrl ? { profilePhotoUrl: data.profilePhotoUrl } : {}) },
        });

        const profile = await (prisma as any).journalistProfile.create({
          data: {
            userId:               user.id,
            designation:          'Union Member',
            district:             data.district || '',
            organization:         data.newspaper || '',
            unionName:            session.unionName,
            state:                data.state || null,
            mandal:               data.mandal || null,
            currentNewspaper:     data.newspaper || null,
            currentDesignation:   data.designation || null,
            linkedTenantId:       data.tenantId || null,
            photoUrl:             data.profilePhotoUrl || data.reporterPhotoUrl || null,
            totalExperienceYears: data.totalExperienceYears ?? null,
          },
        });

        await (prisma as any).whatsappBotSession.delete({ where: { phone } }).catch(() => {});
        await sendUnionRegistrationPendingMessage(phone, unionCardName, data.fullName as string);
        if (isNew && data.mpin) {
          await reply(phone, `🔑 మీ లాగిన్ MPIN: *${data.mpin}* (సేవ్ చేసుకోండి)`);
        }
      } catch (err: any) {
        console.error('[WhatsApp Bot] Registration error:', err?.message);
        await reply(phone, '❌ నమోదు విఫలమైంది. మళ్ళీ ప్రయత్నించండి లేదా అడ్మిన్‌ని సంప్రదించండి.');
      }
      break;
    }

    case 'AWAIT_PROFILE_PHOTO': {
      if (inputLower === 'skip' || inputLower === 'later') {
        await advanceStep('CONFIRM', { profilePhotoUrl: null });
        await replyButtons(phone,
          `✅ ఫోటోను వదిలివేయబడింది. ID కార్డ్ జనరేషన్ ఫోటో అందుకున్న వెంటనే జరుగుతుంది.

ఇప్పుడు మీ అప్లికేషన్‌ను సమర్పించడానికి క్రింది బటన్‌ను నొక్కండి.`,
          [{ id: 'CONFIRM', title: '✅ Confirm & submit' }]
        );
        return;
      }
      if (!mediaId) {
        await replyButtons(phone,
          `📷 దయచేసి మీ *ID కార్డ్ ఫోటో* ఇమేజ్‌గా పంపండి.

(సెల్ఫీ లేదా ప్రెస్ ID ఫోటో సరిపోతుంది)`,
          [{ id: 'skip', title: 'SKIP' }]
        );
        return;
      }
      const profilePhotoUrl = await uploadBotMedia(mediaId, `${phone}/profile-photo`);
      if (!profilePhotoUrl) {
        await reply(phone, '❌ ఫోటో అప్‌లోడ్ విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి.');
        return;
      }
      await advanceStep('CONFIRM', { profilePhotoUrl });
      await replyButtons(phone,
        '✅ ఫోటో పొందబడింది! దయచేసి మీ అప్లికేషన్‌ను సమర్పించడానికి నిర్ధారించండి.',
        [{ id: 'CONFIRM', title: '✅ Confirm & submit' }]
      );
      return;
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
        // Check existing insurance
        const existInsurance = data.journalistProfileId
          ? await (prisma as any).journalistInsurance.findFirst({
              where: { profileId: data.journalistProfileId, isActive: true },
              select: { policyNumber: true, insurer: true },
              orderBy: { createdAt: 'desc' },
            }).catch(() => null)
          : null;

        if (existInsurance?.policyNumber) {
          await reply(phone,
            `🛡️ *మీ ఇన్సూరెన్స్ యాక్టివ్!*\n\n` +
            `📋 పాలసీ నంబర్: *${existInsurance.policyNumber}*${existInsurance.insurer ? ` (${existInsurance.insurer})` : ''}\n\n` +
            `✅ సరే! మళ్ళీ KYC అప్‌డేట్ చేయాలంటే *DJFW* పంపండి.`
          );
        } else {
          await reply(phone,
            `✅ సరే! తర్వాత ఇన్సూరెన్స్ కోసం దరఖాస్తు చేయవచ్చు.\n\n` +
            `🛡️ *ఇన్సూరెన్స్ బెనిఫిట్స్:*\n` +
            `• అపఘాత బీమా: *₹5 లక్షలు*\n` +
            `• కుటుంబ ఆరోగ్య బీమా: *₹3 లక్షలు*\n\n` +
            `KYC డాక్యుమెంట్లు (ఆధార్ + PAN) సమర్పించిన తర్వాత ఇన్సూరెన్స్ త్వరలో యాక్టివేట్ అవుతుంది.\n\n` +
            `*DJFW* అని పంపి KYC అప్‌డేట్ చేయవచ్చు.`
          );
        }
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

    // ── PRESIDENT / ADMIN MENU ────────────────────────────────────────────────
    case 'PRESIDENT_MENU': {
      const adminUnion = (data.adminUnion as string) || '';
      const adminState = (data.adminState as string | null) || null;
      const profileId  = (data.journalistProfileId as string) || '';

      // Download own ID card
      if (inputLower === 'admin_my_card') {
        let effectiveProfileId = (profileId || '').trim();
        if (!effectiveProfileId) {
          const waUser = await findUserByWaPhone(phone);
          if (waUser) {
            const jp = await (prisma as any).journalistProfile
              .findUnique({ where: { userId: waUser.id }, select: { id: true } })
              .catch(() => null);
            if (jp?.id) effectiveProfileId = jp.id;
            else {
              const pres = await tryResolvePresidentMenuContext(waUser.id);
              if (pres?.profileId) effectiveProfileId = pres.profileId;
            }
          }
        }
        if (!effectiveProfileId) {
          await reply(phone,
            'మీ యూనియన్ *సభ్య ప్రొఫైల్* ఇంకా లేదు — ID కార్డ్ ఇక్కడ జనరేట్ చేయలేం.\n' +
            'KYC అప్రూవల్ / సభ్యుల జాబితా మెనూలు ఉపయోగించవచ్చు. ID కార్డ్ కోసం ముందు సభ్య నమోదు పూర్తి చేయండి.',
          );
          await replyButtons(phone, 'మెనూ', [{ id: 'admin_back', title: '🔙 అడ్మిన్ మెనూ' }]);
          return;
        }
        if (effectiveProfileId !== (profileId || '').trim()) {
          const merged = JSON.parse(JSON.stringify({ ...data, journalistProfileId: effectiveProfileId }));
          await (prisma as any).whatsappBotSession
            .update({
              where: { phone },
              data: { data: merged, expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS) },
            })
            .catch(() => null);
        }
        const jp = await (prisma as any).journalistProfile.findUnique({
          where: { id: effectiveProfileId },
          include: { card: { select: { pdfUrl: true } } },
        }).catch(() => null);
        if (!jp?.approved) {
          await reply(
            phone,
            '⚠️ *ID కార్డ్ డౌన్‌లోడ్* — అప్రూవ్ అయిన సభ్యులకు మాత్రమే.\n\nమీ జర్నలిస్ట్ ప్రొఫైల్ అప్రూవ్ అయ్యే వరకు వేచి ఉండండి.',
          );
          await replyButtons(phone, 'మెనూ', [{ id: 'admin_back', title: '🔙 అడ్మిన్ మెనూ' }]);
          return;
        }
        const cardLabel = (data.unionCardName as string) || 'DJFW';
        const pdfUrl: string | null = jp?.card?.pdfUrl || null;
        const hasUnionCardPhoto = !!(jp?.photoUrl && String(jp.photoUrl).trim());
        if (!pdfUrl) {
          if (!hasUnionCardPhoto) {
            const merged = JSON.parse(
              JSON.stringify({
                ...data,
                journalistProfileId: effectiveProfileId,
                idCardPhotoResumeStep: 'PRESIDENT_MENU',
              }),
            );
            await advanceStep('AWAIT_ID_CARD_PHOTO', merged);
            await reply(
              phone,
              '📸 *ID కార్డ్ కోసం ఫోటో*\n\n' +
                'మీ *యూనియన్ ID కార్డ్ ఫోటో* ఇంకా లేదు.\n' +
                'ముందు *పాస్‌పోర్ట్ సైజ్ ఫోటో* ఒకటి ఇక్కడ *ఇమేజ్‌గా* పంపండి — అప్‌లోడ్ అయిన తర్వాత ID కార్డ్ ఆటోమేటిక్‌గా జనరేట్ అవుతుంది.',
            );
            await replyButtons(phone, 'రద్దు చేయాలా?', [{ id: 'cancel', title: '❌ రద్దు' }]);
            return;
          }
          await reply(phone, '⏳ మీ ID కార్డ్ తయారు చేస్తున్నాం...');
        }
        const sentOk = await deliverJournalistPressIdCardWhatsapp(phone, effectiveProfileId, cardLabel);
        if (!sentOk.ok && !pdfUrl) {
          await reply(phone, '⚠️ ID కార్డ్ జనరేట్ చేయడం సాధ్యం కాలేదు. అడ్మిన్‌ని సంప్రదించండి.');
        }
        await replyButtons(phone, 'అడ్మిన్ మెనూకు తిరిగి వెళ్ళాలా?', [{ id: 'admin_back', title: '🔙 అడ్మిన్ మెనూ' }]);
        return;
      }

      // KYC pending list
      if (inputLower === 'admin_kyc_list') {
        await advanceStep('AWAIT_KYC_LIST', { adminUnion, adminState, adminPage: 0 });
        await sendKycList(phone, adminUnion, adminState, 0);
        return;
      }

      // Browse members district/mandal wise
      if (inputLower === 'admin_members') {
        await advanceStep('AWAIT_MEMBER_BROWSE', { adminUnion, adminState });
        const stateDistricts = await prisma.district.findMany({
          where: adminState
            ? { state: { name: { contains: adminState, mode: 'insensitive' } }, isDeleted: false }
            : { isDeleted: false },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
          take: 9,
        });
        if (stateDistricts.length > 0) {
          await replyList(phone,
            `📋 *సభ్యుల జాబితా* — జిల్లా ఎంచుకోండి:`,
            'జిల్లా ఎంచుకోండి',
            [
              ...stateDistricts.map(d => ({ id: `browse_district:${d.id}`, title: d.name })),
              { id: 'browse_all', title: '📊 అన్ని జిల్లాలు (summary)' },
            ]
          );
        } else {
          await reply(phone, '⚠️ జిల్లాలు కనుగొనలేదు.');
        }
        return;
      }

      // Back or default — re-show menu
      await showPresidentMenuByStep(phone, data);
      break;
    }

    // ── KYC LIST (pending approvals) ─────────────────────────────────────────
    case 'AWAIT_KYC_LIST': {
      if (inputLower === 'admin_back' || inputLower === 'admin_menu') {
        await advanceStep('PRESIDENT_MENU', {});
        await showPresidentMenuByStep(phone, data);
        return;
      }
      // Numeric selection — pick from current page list
      if (/^\d+$/.test(input) && Array.isArray(data.kycPageItems)) {
        const idx = parseInt(input, 10) - 1;
        const profileId = (data.kycPageItems as string[])[idx];
        if (profileId) {
          await advanceStep('AWAIT_KYC_REVIEW', { reviewProfileId: profileId });
          await sendKycReviewDetail(phone, profileId);
          return;
        }
      }
      // Review a specific member
      if (input.startsWith('kyc_review:')) {
        const reviewProfileId = input.replace('kyc_review:', '');
        await advanceStep('AWAIT_KYC_REVIEW', { reviewProfileId });
        await sendKycReviewDetail(phone, reviewProfileId);
        return;
      }
      // Next page
      if (input.startsWith('kyc_page:')) {
        const page = parseInt(input.replace('kyc_page:', ''), 10) || 0;
        await advanceStep('AWAIT_KYC_LIST', { ...data, adminPage: page });
        await sendKycList(phone, data.adminUnion as string, data.adminState as string | null, page);
        return;
      }
      await sendKycList(phone, data.adminUnion as string, data.adminState as string | null, (data.adminPage as number) || 0);
      break;
    }

    // ── KYC REVIEW (approve / reject individual member) ───────────────────────
    case 'AWAIT_KYC_REVIEW': {
      const reviewId = data.reviewProfileId as string;
      if (input.startsWith('kyc_approve:')) {
        const pid = input.replace('kyc_approve:', '');
        await (prisma as any).journalistProfile.update({
          where: { id: pid },
          data: { kycVerified: true, kycVerifiedAt: new Date(), approved: true, approvedAt: new Date() },
        });
        // Prepare card record for later delivery, but do not push the PDF immediately
        const jp = await (prisma as any).journalistProfile.findUnique({
          where: { id: pid },
          include: {
            user: { include: { profile: true } },
          },
        }).catch(() => null);
        if (jp?.user?.mobileNumber) {
          const memberPhone = jp.user.mobileNumber.length === 10 ? `91${jp.user.mobileNumber}` : jp.user.mobileNumber;
          const memberName = jp.user.profile?.fullName || 'సభ్యుడు';
          const card = await (prisma as any).journalistCard.upsert({
            where: { profileId: pid },
            create: {
              profileId: pid,
              cardNumber: `JU-${Date.now()}`,
              expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
              status: 'ACTIVE',
            },
            update: {},
          }).catch(() => null);
          if (card) {
            const pdfResult = await generateAndUploadPressCardPdf(pid);
            if (pdfResult.ok && pdfResult.pdfUrl) {
              const sendResult = await sendWhatsappIdCardTemplate({
                toMobileNumber: memberPhone,
                pdfUrl: pdfResult.pdfUrl,
                cardType: `${session.unionDisplayName || session.unionName} ID`,
                organizationName: jp?.linkedTenantName || jp?.organization || 'Journalist Union',
                documentType: `${session.unionDisplayName || session.unionName} ID Card`,
                pdfFilename: `Press_ID_${card.cardNumber}.pdf`,
              });
              if (sendResult.ok) {
                await reply(memberPhone,
                  `🎉 *${memberName} గారికి అభినందనలు!*

` +
                  `✅ మీ KYC అప్రూవ్ అయింది. మీ ID కార్డ్ ఇప్పుడు *WhatsApp ద్వారా పంపబడింది*. మీరు దానిని త్వరలో చూడవచ్చు.
` +
                  `🛡️ ఇన్సూరెన్స్ వివరాలు కూడా త్వరలో అందుతాయి.`
                );
              } else {
                console.error('[WhatsApp Bot] Approved card send failed:', sendResult.error, sendResult.details);
                await reply(memberPhone,
                  `🎉 *${memberName} గారికి అభినందనలు!*

` +
                  `✅ మీ KYC అప్రూవ్ అయింది. మీ ID కార్డ్ PDF రూపొందించబడింది, కానీ పంపడంలో సమస్య వచ్చింది. అడ్మిన్‌ను సంప్రదించండి.`
                );
              }
            } else {
              await reply(memberPhone,
                `🎉 *${memberName} గారికి అభినందనలు!*

` +
                `✅ మీ KYC అప్రూవ్ అయింది. మీరు ప్రస్తుతం అందుబాటులో ఫోటో లేకపోవడం లేదా సిస్టమ్ కారణంగా ID కార్డ్ పంపలేకపోయాము. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి లేదా అడ్మిన్‌ని సంప్రదించండి.`
              );
            }
          } else {
            await reply(memberPhone,
              `🎉 మీ KYC అప్రూవ్ అయింది!\n` +
              `మీ ID కార్డ్ త్వరలో అందుతుంది. దయచేసి 24 గంటల తర్వాత తిరిగి సందేశం పంపండి.`
            );
          }
        }
        await reply(phone, `✅ *KYC అప్రూవ్ చేయబడింది!*\n👤 ${jp?.user?.profile?.fullName || pid.slice(-6)}`);
        await advanceStep('AWAIT_KYC_LIST', { adminPage: 0 });
        await sendKycList(phone, data.adminUnion as string, data.adminState as string | null, 0);
        return;
      }

      if (input.startsWith('kyc_reject:')) {
        const pid = input.replace('kyc_reject:', '');
        await (prisma as any).journalistProfile.update({
          where: { id: pid },
          data: { rejectedAt: new Date(), kycNote: 'Rejected via WhatsApp admin review' },
        });
        const jp = await (prisma as any).journalistProfile.findUnique({
          where: { id: pid },
          include: { user: { include: { profile: true } } },
        }).catch(() => null);
        if (jp?.user?.mobileNumber) {
          const memberPhone = jp.user.mobileNumber.length === 10 ? `91${jp.user.mobileNumber}` : jp.user.mobileNumber;
          await reply(memberPhone,
            `⚠️ *KYC రిజెక్ట్ చేయబడింది.*\n\n` +
            `మీ పత్రాలు అంగీకరించబడలేదు. దయచేసి సరైన పత్రాలు తిరిగి సమర్పించండి.\n` +
            `*DJFW* పంపి KYC అప్‌డేట్ చేయండి.`
          );
        }
        await reply(phone, `❌ *KYC రిజెక్ట్ చేయబడింది.*\n👤 ${jp?.user?.profile?.fullName || pid.slice(-6)}`);
        await advanceStep('AWAIT_KYC_LIST', { adminPage: 0 });
        await sendKycList(phone, data.adminUnion as string, data.adminState as string | null, 0);
        return;
      }

      // Back
      await advanceStep('AWAIT_KYC_LIST', { adminPage: 0 });
      await sendKycList(phone, data.adminUnion as string, data.adminState as string | null, 0);
      break;
    }

    // ── MEMBER BROWSE (district/mandal wise) ──────────────────────────────────
    case 'AWAIT_MEMBER_BROWSE': {
      if (inputLower === 'admin_back' || inputLower === 'admin_menu') {
        await advanceStep('PRESIDENT_MENU', {});
        await showPresidentMenuByStep(phone, data);
        return;
      }

      if (input === 'browse_all') {
        // Summary across all districts
        const members: any[] = await (prisma as any).journalistProfile.findMany({
          where: {
            unionName: data.adminUnion as string,
            ...(data.adminState ? { state: { contains: data.adminState as string, mode: 'insensitive' } } : {}),
          },
          select: { district: true, mandal: true, approved: true },
        });
        const byDist: Record<string, { total: number; approved: number }> = {};
        for (const m of members) {
          const d = m.district || 'ఇతర';
          if (!byDist[d]) byDist[d] = { total: 0, approved: 0 };
          byDist[d].total++;
          if (m.approved) byDist[d].approved++;
        }
        const lines = Object.entries(byDist)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([d, s]) => `📍 *${d}*: ${s.total} మంది (✅${s.approved} / ⏳${s.total - s.approved})`)
          .join('\n');
        await reply(phone,
          `📊 *${data.adminUnion} — జిల్లాల సారాంశం*\n` +
          `మొత్తం: *${members.length}* మంది\n\n${lines || 'డేటా లేదు.'}`
        );
        await replyButtons(phone, 'మళ్ళీ చూడాలా?', [{ id: 'admin_members', title: '📋 జిల్లా ఎంచుకోండి' }, { id: 'admin_back', title: '🔙 అడ్మిన్ మెనూ' }]);
        return;
      }

      if (input.startsWith('browse_district:')) {
        const districtId = input.replace('browse_district:', '');
        const district = await prisma.district.findUnique({ where: { id: districtId }, select: { name: true } });
        const members: any[] = await (prisma as any).journalistProfile.findMany({
          where: {
            unionName: data.adminUnion as string,
            district: { contains: district?.name || '', mode: 'insensitive' },
          },
          select: {
            mandal: true, currentNewspaper: true, organization: true,
            currentDesignation: true, designation: true, approved: true,
            user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
          },
          orderBy: [{ mandal: 'asc' }],
          take: 50,
        });
        if (!members.length) {
          await reply(phone, `ℹ️ ${district?.name || districtId} జిల్లాలో సభ్యులు లేరు.`);
          return;
        }
        const byMandal: Record<string, any[]> = {};
        for (const m of members) {
          const mandal = m.mandal || 'ఇతర';
          if (!byMandal[mandal]) byMandal[mandal] = [];
          byMandal[mandal].push(m);
        }
        await reply(phone, `📍 *${district?.name || 'జిల్లా'} — ${members.length} మంది సభ్యులు*`);
        for (const [mandal, list] of Object.entries(byMandal)) {
          let chunk = `🔹 *${mandal}* (${list.length})\n`;
          for (const m of list) {
            const name = m.user?.profile?.fullName || 'N/A';
            const mob = m.user?.mobileNumber || '';
            const paper = m.currentNewspaper || m.organization || '';
            const pos = m.currentDesignation || m.designation || '';
            const status = m.approved ? '✅' : '⏳';
            chunk += `${status} ${name} | 📱${mob}${paper ? ` | ${paper}` : ''}${pos ? ` | ${pos}` : ''}\n`;
          }
          await reply(phone, chunk.trim());
        }
        await replyButtons(phone, 'మరో జిల్లా చూడాలా?',
          [{ id: 'admin_members', title: '📋 జిల్లా ఎంచుకోండి' }, { id: 'admin_back', title: '🔙 అడ్మిన్ మెనూ' }]
        );
        return;
      }

      // Default — re-show district list
      await advanceStep('AWAIT_MEMBER_BROWSE', { adminUnion: data.adminUnion, adminState: data.adminState });
      const stateDistricts = await prisma.district.findMany({
        where: data.adminState
          ? { state: { name: { contains: data.adminState as string, mode: 'insensitive' } }, isDeleted: false }
          : { isDeleted: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 9,
      });
      await replyList(phone, '📋 జిల్లా ఎంచుకోండి:', 'జిల్లా',
        [...stateDistricts.map(d => ({ id: `browse_district:${d.id}`, title: d.name })), { id: 'browse_all', title: '📊 Summary' }]
      );
      break;
    }

    // ── EXPERIENCE ─────────────────────────────────────────────────────────────
    case 'AWAIT_EXPERIENCE': {
      let expYears: number | null = null;
      if (input.startsWith('exp:')) {
        const parsed = parseInt(input.replace('exp:', ''), 10);
        expYears = isNaN(parsed) ? null : parsed;
      } else if (/^\d+$/.test(input)) {
        expYears = parseInt(input, 10);
      }
      // SKIP or unrecognised → expYears stays null
      await advanceStep('AWAIT_STATE_SELECT', { totalExperienceYears: expYears });
      await replyButtons(phone,
        `✅ అనుభవం: *${expYears !== null ? expYears + '+ సంవత్సరాలు' : 'N/A'}*\n\n📍 *దశ 5/6* — మీరు ఏ రాష్ట్రంలో పని చేస్తున్నారు?`,
        [
          { id: 'state:Andhra Pradesh', title: '🏛️ ఆంధ్రప్రదేశ్' },
          { id: 'state:Telangana', title: '🏛️ తెలంగాణ' },
          { id: 'state:OTHER', title: '🗺️ ఇతర రాష్ట్రం' },
        ]
      );
      break;
    }

    // ── ID CARD: collect passport photo when none on profile / user / reporter ─
    case 'AWAIT_ID_CARD_PHOTO': {
      // New union registration (non-reporter): photo is last step before president approval
      if (data.registrationMode === 'simple') {
        if (!mediaId) {
          await reply(
            phone,
            '📸 *దశ 5/5* — దయచేసి మీ *రిపోర్టర్ ID / పాస్‌పోర్ట్ సైజ్ ఫోటో* ఇక్కడ *ఇమేజ్‌గా* పంపండి.',
          );
          return;
        }
        const photoUrl = await uploadBotMedia(mediaId, `${phone}/union-reg-photo`);
        if (!photoUrl) {
          await reply(phone, '❌ ఫోటో అప్‌లోడ్ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.');
          return;
        }
        await completeSimpleUnionRegistration(phone, session, { ...data, profilePhotoUrl: photoUrl }, unionCardName);
        return;
      }

      const pid = (data.journalistProfileId as string) || '';
      const resumeStep = ((data.idCardPhotoResumeStep as string) || 'MEMBER_MENU') as BotStep;
      const uCard = (data.unionCardName as string) || 'యూనియన్';

      if (['cancel', 'రద్దు', 'skip', 'stop'].includes(inputLower)) {
        const { idCardPhotoResumeStep: _drop, ...rest } = data;
        await advanceStep(resumeStep, rest);
        await reply(phone, 'సరే — ID కార్డ్ ఫోటో అప్‌లోడ్ రద్దు. మళ్ళీ కావాలంటే మెనూలో *ID కార్డ్ డౌన్‌లోడ్* నొక్కండి.');
        if (resumeStep === 'PRESIDENT_MENU') await showPresidentMenuByStep(phone, rest);
        else {
          const jpC = await (prisma as any).journalistProfile
            .findUnique({ where: { id: rest.journalistProfileId as string }, select: { approved: true } })
            .catch(() => null);
          await replyButtons(phone, 'మీరు ఏమి చేయాలనుకుంటున్నారు?', buildJournalistMemberWaButtons(!!jpC?.approved));
        }
        return;
      }

      if (!pid) {
        await reply(phone, '⚠️ సెషన్ లోపం. *DJFW* పంపి మళ్ళీ ప్రయత్నించండి.');
        return;
      }

      const jpPhoto = await (prisma as any).journalistProfile
        .findUnique({ where: { id: pid }, select: { approved: true } })
        .catch(() => null);
      if (!jpPhoto?.approved) {
        const { idCardPhotoResumeStep: _d, ...rest } = data;
        await advanceStep(resumeStep, rest);
        await reply(
          phone,
          '⚠️ *ID కార్డ్ ఫోటో* — అప్రూవ్ అయిన సభ్యులకు మాత్రమే. మీ సభ్యత్వం అప్రూవ్ అయ్యాక మళ్ళీ ప్రయత్నించండి.',
        );
        if (resumeStep === 'PRESIDENT_MENU') await showPresidentMenuByStep(phone, rest);
        else await replyButtons(phone, 'మీరు ఏమి చేయాలనుకుంటున్నారు?', buildJournalistMemberWaButtons(false));
        return;
      }

      if (!mediaId) {
        await reply(phone,
          '📸 *ID కార్డ్ ఫోటో*\n\n' +
            'దయచేసి *పాస్‌పోర్ట్ సైజ్ ఫోటో* ఒకటి ఇక్కడ WhatsApp లో *ఇమేజ్‌గా* పంపండి (సెల్ఫీ కాకుండా ముందువైపు చూస్తూ ఉన్న ఫోటో మేలు).\n\n' +
            'రద్దు చేయాలంటే *రద్దు* అని పంపండి.',
        );
        return;
      }

      const url = await uploadBotMedia(mediaId, `${pid}/press_card_photo`);
      if (!url) {
        await reply(phone, '❌ ఫోటో అప్‌లోడ్ విఫలమైంది. మళ్ళీ ఇమేజ్ పంపండి.');
        return;
      }
      await (prisma as any).journalistProfile
        .update({ where: { id: pid }, data: { photoUrl: url } })
        .catch((e: any) => console.error('[WhatsApp Bot] press card photoUrl update failed:', e?.message));
      await (prisma as any).journalistCard
        .updateMany({ where: { profileId: pid }, data: { pdfUrl: null } })
        .catch(() => null);

      const { idCardPhotoResumeStep: _r, ...rest } = data;
      await advanceStep(resumeStep, rest);
      await reply(phone, '✅ ఫోటో సేవ్ అయింది. ID కార్డ్ తయారు చేస్తున్నాం...');
      const sent = await deliverJournalistPressIdCardWhatsapp(phone, pid, uCard);
      if (!sent.ok) await reply(phone, '⚠️ ID కార్డ్ జనరేట్ చేయడం సాధ్యం కాలేదు. మళ్ళీ డౌన్‌లోడ్ ప్రయత్నించండి లేదా అడ్మిన్‌ని సంప్రదించండి.');
      if (resumeStep === 'PRESIDENT_MENU') {
        await replyButtons(phone, 'అడ్మిన్ మెనూకు?', [{ id: 'admin_back', title: '🔙 అడ్మిన్ మెనూ' }]);
      } else {
        await replyButtons(phone, 'మరేమైనా చేయాలా?', buildJournalistMemberWaButtons(!!jpPhoto?.approved));
      }
      return;
    }

    // ── MEMBER MENU (registered member action hub) ────────────────────────────
    case 'MEMBER_MENU': {
      const profileId = data.journalistProfileId as string;
      const uCardName = (data.unionCardName as string) || 'యూనియన్';

      if (inputLower === 'download_id_card') {
        const jp = await (prisma as any).journalistProfile.findUnique({
          where: { id: profileId },
          include: { card: { select: { id: true, pdfUrl: true, status: true } } },
        }).catch(() => null);
        if (!jp?.approved) {
          await reply(
            phone,
            '⚠️ *ID కార్డ్ డౌన్‌లోడ్* — అప్రూవ్ అయిన సభ్యులకు మాత్రమే.\n\nమీ సభ్యత్వం అడ్మిన్ అప్రూవ్ అయ్యే వరకు దయచేసి వేచి ఉండండి.',
          );
          await replyButtons(phone, 'మీరు ఏమి చేయాలనుకుంటున్నారు?', buildJournalistMemberWaButtons(false));
          return;
        }
        const pdfUrl: string | null = jp?.card?.pdfUrl || null;
        const hasUnionCardPhoto = !!(jp?.photoUrl && String(jp.photoUrl).trim());
        if (!pdfUrl) {
          if (!hasUnionCardPhoto) {
            await advanceStep('AWAIT_ID_CARD_PHOTO', {
              ...data,
              journalistProfileId: profileId,
              idCardPhotoResumeStep: 'MEMBER_MENU',
            });
            await reply(
              phone,
              '📸 *ID కార్డ్ కోసం ఫోటో*\n\n' +
                'మీ *యూనియన్ ID కార్డ్ ఫోటో* ఇంకా లేదు.\n' +
                'ముందు *పాస్‌పోర్ట్ సైజ్ ఫోటో* ఒకటి ఇక్కడ *ఇమేజ్‌గా* పంపండి — అప్‌లోడ్ అయిన తర్వాత ID కార్డ్ ఆటోమేటిక్‌గా జనరేట్ అవుతుంది.',
            );
            await replyButtons(phone, 'రద్దు చేయాలా?', [{ id: 'cancel', title: '❌ రద్దు' }]);
            return;
          }
          await reply(phone, `⏳ మీ *${uCardName} ID కార్డ్* తయారు చేస్తున్నాం...`);
        }
        const sent = await deliverJournalistPressIdCardWhatsapp(phone, profileId, uCardName);
        if (!sent.ok && !pdfUrl) {
          await reply(
            phone,
            jp.approved
              ? `⚠️ ID కార్డ్ ఇప్పుడు జనరేట్ చేయడం సాధ్యం కాలేదు. అడ్మిన్‌ని సంప్రదించండి.`
              : `⚠️ ID కార్డ్ *అప్రూవ్ అయిన సభ్యులకు* మాత్రమే.`,
          );
        }
        await replyButtons(phone, 'మరేమైనా చేయాలా?', buildJournalistMemberWaButtons(!!jp.approved));
        return;
      }

      if (inputLower === 'insurance_active') {
        const ins = await (prisma as any).journalistInsurance
          .findFirst({
            where: { profileId, isActive: true },
            select: { policyNumber: true, insurer: true },
            orderBy: { createdAt: 'desc' },
          })
          .catch(() => null);
        if (ins?.policyNumber) {
          await reply(
            phone,
            `🛡️ *మీ ఇన్సూరెన్స్ యాక్టివ్!*\n\n📋 పాలసీ: *${ins.policyNumber}*${ins.insurer ? ` (${ins.insurer})` : ''}`,
          );
        } else {
          await reply(
            phone,
            `🛡️ *ఇన్సూరెన్స్*\n\nమీ ఇన్సూరెన్స్ ఇంకా యాక్టివేట్ కాలేదు. వివరాలు & యాప్ లో చూడండి:`,
          );
        }
        await sendKaburluAndroidAppLink(phone);
        const jpIns = await (prisma as any).journalistProfile
          .findUnique({ where: { id: profileId }, select: { approved: true } })
          .catch(() => null);
        await replyButtons(phone, 'మీరు ఏమి చేయాలనుకుంటున్నారు?', buildJournalistMemberWaButtons(!!jpIns?.approved));
        return;
      }

      // Default — show menu again
      const jpMenu = await (prisma as any).journalistProfile
        .findUnique({ where: { id: profileId }, select: { approved: true } })
        .catch(() => null);
      await replyButtons(phone, 'మీరు ఏమి చేయాలనుకుంటున్నారు?', buildJournalistMemberWaButtons(!!jpMenu?.approved));
      break;
    }

    // ── UPDATE NOMINEE ────────────────────────────────────────────────────────
    case 'AWAIT_UPDATE_NOMINEE': {
      if (inputLower === 'skip' || inputLower === 'cancel' || inputLower === '\u0c30\u0c26\u0c4d\u0c26\u0c41') {
        await (prisma as any).whatsappBotSession.delete({ where: { phone } }).catch(() => {});
        await reply(phone, '✅ సరే! మళ్ళీ *DJFW* పంపి అప్‌డేట్ చేయవచ్చు.');
        return;
      }
      if (input.length < 2) {
        await replyButtons(phone,
          '📝 *నామినీ అప్‌డేట్* — మీ నామినీ పేరు నమోదు చేయండి:',
          [{ id: 'SKIP', title: 'రద్దు' }]
        );
        return;
      }
      if (data.journalistProfileId) {
        await (prisma as any).journalistProfile.update({
          where: { id: data.journalistProfileId },
          data: { nomineeName: input },
        }).catch((e: any) => console.error('[WhatsApp Bot] nominee update failed:', e?.message));
      }
      await (prisma as any).whatsappBotSession.delete({ where: { phone } }).catch(() => {});
      await reply(phone, `✅ *నామినీ అప్‌డేట్ విజయవంతం!*\n\n👥 నామినీ: *${input}*\n\nమళ్ళీ మెనూ కోసం *DJFW* పంపండి.`);
      break;
    }

    case 'KYC_SUBMITTED':
    case 'DONE':
      await reply(phone,
        `✅ మీ దరఖాస్తు సమీక్షలో ఉంది.\n\n` +
        `⏳ అడ్మిన్ మీ KYC వెరిఫై చేసిన తర్వాత, మీ *${unionCardName} ID కార్డ్* ఇక్కడ WhatsApp లో పంపబడుతుంది.\n\n` +
        `🛡️ *ఇన్సూరెన్స్ బెనిఫిట్స్:*\n` +
        `• అపఘాత బీమా: *₹5 లక్షలు*\n` +
        `• కుటుంబ ఆరోగ్య బీమా: *₹3 లక్షలు*\n\n` +
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
  // Check if insurance already assigned
  const existInsurance = data.journalistProfileId
    ? await (prisma as any).journalistInsurance.findFirst({
        where: { profileId: data.journalistProfileId, isActive: true },
        select: { policyNumber: true, insurer: true },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null)
    : null;

  let insuranceNote = '';
  if (existInsurance?.policyNumber) {
    insuranceNote =
      `\n\n🛡️ *ఇన్సూరెన్స్ యాక్టివ్!*\n` +
      `📋 పాలసీ నంబర్: *${existInsurance.policyNumber}*${existInsurance.insurer ? ` (${existInsurance.insurer})` : ''}`;
  } else {
    insuranceNote =
      `\n\n🛡️ *ఇన్సూరెన్స్ బెనిఫిట్స్:*\n` +
      `• అపఘాత బీమా: *₹5 లక్షలు*\n` +
      `• కుటుంబ ఆరోగ్య బీమా: *₹3 లక్షలు*\n\n` +
      `⏳ మీ KYC వెరిఫికేషన్ పూర్తైన తర్వాత ఇన్సూరెన్స్ యాక్టివేట్ అవుతుంది.`;
  }

  await reply(phone,
    `🎉 *ఇన్సూరెన్స్ KYC సమర్పించబడింది!*\n\n` +
    `ధన్యవాదాలు, *${data.fullName || 'సభ్యుడు'}*!\n\n` +
    `📋 మీ డాక్యుమెంట్లు సమీక్షలో ఉన్నాయి. అడ్మిన్ వెరిఫై చేసిన తర్వాత మీకు నిర్ధారణ వస్తుంది.\n` +
    `⏳ సాధారణంగా *1–3 పని దినాలు* పడుతుంది.` +
    insuranceNote
  );
}

// ─── WhatsApp phone → User (handles 10-digit vs 91… stored formats) ───────────
async function findUserByWaPhone(phone: string): Promise<{ id: string } | null> {
  const d = String(phone || '').replace(/\D/g, '');
  const tries = new Set<string>();
  if (d.length >= 10) tries.add(d.slice(-10));
  if (d.startsWith('91') && d.length >= 12) tries.add(d);
  for (const mobileNumber of tries) {
    const u = await prisma.user.findUnique({ where: { mobileNumber }, select: { id: true } }).catch(() => null);
    if (u) return u;
  }
  return null;
}

/** 10-digit Indian mobile inferred only from WhatsApp `from` (anti-spoof: registration must match this). */
function whatsappSenderMobile10(waFrom: string): string | null {
  const d = String(waFrom || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  const mobile10 = d.slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile10)) return null;
  return mobile10;
}

/** Union admin row OR elected president-style post holder → president WhatsApp menu (even without JournalistProfile). */
async function tryResolvePresidentMenuContext(userId: string): Promise<{ profileId: string | null; unionName: string; state: string | null } | null> {
  const adminRow = await (prisma as any).journalistUnionAdmin.findFirst({ where: { userId } }).catch(() => null);
  if (adminRow?.unionName) {
    const jp = await (prisma as any).journalistProfile.findUnique({ where: { userId }, select: { id: true, state: true } }).catch(() => null);
    return { profileId: jp?.id ?? null, unionName: adminRow.unionName, state: adminRow.state ?? jp?.state ?? null };
  }
  const presidentOr = [
    { post: { title: { contains: 'President', mode: 'insensitive' as const } } },
    { post: { nativeTitle: { contains: 'President', mode: 'insensitive' as const } } },
  ];
  const holder = await (prisma as any).journalistUnionPostHolder.findFirst({
    where: { isActive: true, profile: { userId }, OR: presidentOr },
    include: { profile: { select: { id: true, state: true, unionName: true } } },
    orderBy: { post: { sortOrder: 'asc' } },
  }).catch(() => null);
  if (holder) {
    const unionName = holder.unionName || holder.profile?.unionName;
    if (!unionName) return null;
    return { profileId: holder.profileId, unionName, state: holder.profile?.state ?? null };
  }
  return null;
}

// ─── Admin/President authority check ─────────────────────────────────────────
async function checkIsAdminOrPresident(userId: string, profileId: string, unionName: string): Promise<boolean> {
  const anyUnionAdmin = await (prisma as any).journalistUnionAdmin.findFirst({ where: { userId } }).catch(() => null);
  if (anyUnionAdmin) return true;

  if (!profileId) return false;

  const postHolder = await (prisma as any).journalistUnionPostHolder.findFirst({
    where: {
      profileId,
      isActive: true,
      OR: [
        { post: { title: { contains: 'President', mode: 'insensitive' } } },
        { post: { nativeTitle: { contains: 'President', mode: 'insensitive' } } },
      ],
    },
  }).catch(() => null);
  return !!postHolder;
}

/** Own-press-card download allowed only for approved journalist profiles. */
async function isApprovedForJournalistIdCard(phone: string, profileId: string, userId?: string): Promise<boolean> {
  const pid = (profileId || '').trim();
  if (pid) {
    const jp = await (prisma as any).journalistProfile
      .findUnique({ where: { id: pid }, select: { approved: true } })
      .catch(() => null);
    return !!jp?.approved;
  }
  let uid = (userId || '').trim();
  if (!uid) {
    const u = await findUserByWaPhone(phone);
    uid = u?.id || '';
  }
  if (!uid) return false;
  const jp = await (prisma as any).journalistProfile
    .findUnique({ where: { userId: uid }, select: { approved: true } })
    .catch(() => null);
  return !!jp?.approved;
}

// ─── Show president/admin menu ────────────────────────────────────────────────
async function showPresidentMenu(phone: string, userId: string, profileId: string, unionName: string, state: string | null, displayName: string) {
  const pending = await (prisma as any).journalistProfile.count({
    where: {
      unionName,
      ...(state ? { state: { contains: state, mode: 'insensitive' } } : {}),
      OR: [
        { aadhaarUrl: { not: null }, kycVerified: false },
        { approved: false, aadhaarUrl: { not: null } },
      ],
    },
  }).catch(() => 0);

  const total = await (prisma as any).journalistProfile.count({
    where: { unionName, ...(state ? { state: { contains: state, mode: 'insensitive' } } : {}) },
  }).catch(() => 0);

  // Post label (profileId empty = union admin without member profile — resolve via userId)
  let postTitle = 'Union Administrator';
  if (profileId) {
    const postHolder = await (prisma as any).journalistUnionPostHolder.findFirst({
      where: { profileId, isActive: true },
      include: { post: { select: { title: true } } },
    }).catch(() => null);
    postTitle = postHolder?.post?.title || postTitle;
  } else {
    const holder = await (prisma as any).journalistUnionPostHolder.findFirst({
      where: {
        isActive: true,
        profile: { userId },
        OR: [
          { post: { title: { contains: 'President', mode: 'insensitive' } } },
          { post: { nativeTitle: { contains: 'President', mode: 'insensitive' } } },
        ],
      },
      include: { post: { select: { title: true } } },
      orderBy: { post: { sortOrder: 'asc' } },
    }).catch(() => null);
    postTitle = holder?.post?.title || postTitle;
  }

  await (prisma as any).whatsappBotSession.upsert({
    where: { phone },
    create: {
      phone, step: 'PRESIDENT_MENU', unionName,
      data: { journalistProfileId: profileId, adminUnion: unionName, adminState: state, unionCardName: displayName },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
    update: {
      step: 'PRESIDENT_MENU',
      data: { journalistProfileId: profileId, adminUnion: unionName, adminState: state, unionCardName: displayName },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  const showMyCard = await isApprovedForJournalistIdCard(phone, profileId, userId);
  const row1: { id: string; title: string }[] = [];
  if (showMyCard) row1.push({ id: 'admin_my_card', title: '🪪 నా ID కార్డ్ డౌన్‌లోడ్' });
  row1.push({ id: 'admin_kyc_list', title: `⏳ KYC అప్రూవల్ (${pending})` });

  await replyButtons(phone,
    `👑 *${displayName} — ${postTitle}*\n` +
    `${state ? `📍 ${state}` : '🌐 అన్ని రాష్ట్రాలు'}\n\n` +
    `📊 మొత్తం సభ్యులు: *${total}*\n` +
    `⏳ KYC పెండింగ్: *${pending}*\n\n` +
    `మీరు ఏమి చేయాలనుకుంటున్నారు?`,
    row1,
  );
  // Send second row as separate message (WA only allows 3 buttons)
  await replyButtons(phone, 'మరిన్ని ఆప్షన్లు:', [
    { id: 'admin_members', title: '📋 సభ్యుల జాబితా' },
  ]);
}

async function showPresidentMenuByStep(phone: string, data: Record<string, any>) {
  const profileId = data.journalistProfileId as string || '';
  const unionName = data.adminUnion as string || '';
  const state = data.adminState as string | null || null;
  const displayName = data.unionCardName as string || 'DJFW';
  const userId = '';

  const pending = await (prisma as any).journalistProfile.count({
    where: {
      unionName,
      ...(state ? { state: { contains: state, mode: 'insensitive' } } : {}),
      OR: [{ aadhaarUrl: { not: null }, kycVerified: false }],
    },
  }).catch(() => 0);

  const total = await (prisma as any).journalistProfile.count({
    where: { unionName, ...(state ? { state: { contains: state, mode: 'insensitive' } } : {}) },
  }).catch(() => 0);

  const showMyCard = await isApprovedForJournalistIdCard(phone, profileId, '');
  const row1: { id: string; title: string }[] = [];
  if (showMyCard) row1.push({ id: 'admin_my_card', title: '🪪 నా ID కార్డ్' });
  row1.push({ id: 'admin_kyc_list', title: `⏳ KYC అప్రూవల్ (${pending})` });

  await replyButtons(phone,
    `👑 *${displayName} — అడ్మిన్ మెనూ*\n` +
    `${state ? `📍 ${state}` : '🌐 అన్ని రాష్ట్రాలు'}\n\n` +
    `📊 మొత్తం: *${total}* | ⏳ KYC పెండింగ్: *${pending}*`,
    row1,
  );
  await replyButtons(phone, 'మరిన్ని ఆప్షన్లు:', [{ id: 'admin_members', title: '📋 సభ్యుల జాబితా' }]);
}

// ─── Send KYC pending list ────────────────────────────────────────────────────
async function sendKycList(phone: string, unionName: string, state: string | null, page: number) {
  const PAGE_SIZE = 5;
  const pendingMembers: any[] = await (prisma as any).journalistProfile.findMany({
    where: {
      unionName,
      ...(state ? { state: { contains: state, mode: 'insensitive' } } : {}),
      kycVerified: false,
      aadhaarUrl: { not: null },
    },
    include: {
      user: { include: { profile: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  }).catch(() => []);

  const totalPending = await (prisma as any).journalistProfile.count({
    where: {
      unionName,
      ...(state ? { state: { contains: state, mode: 'insensitive' } } : {}),
      kycVerified: false,
      aadhaarUrl: { not: null },
    },
  }).catch(() => 0);

  if (totalPending === 0) {
    await reply(phone, '✅ KYC పెండింగ్ అభ్యర్థనలు లేవు!');
    await replyButtons(phone, 'అడ్మిన్ మెనూకు తిరిగి:', [{ id: 'admin_back', title: '🔙 అడ్మిన్ మెనూ' }]);
    return;
  }

  if (pendingMembers.length === 0) {
    await reply(phone, `ℹ️ ఈ పేజీలో ఫలితాలు లేవు.`);
    await replyButtons(phone, '', [{ id: 'admin_back', title: '🔙 అడ్మిన్ మెనూ' }]);
    return;
  }

  await reply(phone,
    `⏳ *KYC పెండింగ్ — ${state || 'అన్ని'} (${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + pendingMembers.length} / ${totalPending})*\n\n` +
    pendingMembers.map((m, i) => {
      const name = m.user?.profile?.fullName || 'N/A';
      const mob = m.user?.mobileNumber || '';
      const dist = m.district || '';
      const docs = [m.aadhaarUrl ? '🪪 ఆధార్' : '', m.panCardUrl ? '💳 PAN' : '', m.nomineeName ? '👥 నామినీ' : ''].filter(Boolean).join(', ');
      return `${page * PAGE_SIZE + i + 1}. *${name}* | 📱${mob} | ${dist}\n   📄 ${docs || 'ఆధార్ మాత్రమే'}`;
    }).join('\n\n') +
    `\n\nసమీక్షించడానికి నంబర్ పంపండి (1–${pendingMembers.length}):`
  );

  // Store list in session for numeric selection
  const session = await (prisma as any).whatsappBotSession.findUnique({ where: { phone } });
  if (session) {
    const sessionData = (session.data as Record<string, any>) || {};
    await (prisma as any).whatsappBotSession.update({
      where: { phone },
      data: {
        step: 'AWAIT_KYC_LIST',
        data: JSON.parse(JSON.stringify({ ...sessionData, kycPageItems: pendingMembers.map((m: any) => m.id), adminPage: page })),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
  }

  const navButtons: { id: string; title: string }[] = [];
  if (page > 0) navButtons.push({ id: `kyc_page:${page - 1}`, title: '◀️ మునుపటి' });
  if ((page + 1) * PAGE_SIZE < totalPending) navButtons.push({ id: `kyc_page:${page + 1}`, title: '▶️ తర్వాత' });
  navButtons.push({ id: 'admin_back', title: '🔙 అడ్మిన్ మెనూ' });
  await replyButtons(phone, 'లేదా పేజ్ నావిగేట్ చేయండి:', navButtons.slice(0, 3));
}

// ─── Send KYC review detail for a member ────────────────────────────────────
async function sendKycReviewDetail(phone: string, profileId: string) {
  const jp = await (prisma as any).journalistProfile.findUnique({
    where: { id: profileId },
    include: {
      user: { include: { profile: { select: { fullName: true, dob: true } } } },
    },
  }).catch(() => null);

  if (!jp) {
    await reply(phone, '⚠️ సభ్యుడి వివరాలు కనుగొనలేదు.');
    return;
  }

  const name = jp.user?.profile?.fullName || 'N/A';
  const mob = jp.user?.mobileNumber || '';
  const dob = jp.user?.profile?.dob ? new Date(jp.user.profile.dob).toLocaleDateString('te-IN') : 'N/A';
  const lines = [
    `👤 *పేరు:* ${name}`,
    `📱 *మొబైల్:* ${mob}`,
    `🎂 *జన్మ తేదీ:* ${dob}`,
    `🏷️ *హోదా:* ${jp.currentDesignation || jp.designation || 'N/A'}`,
    `📰 *పేపర్:* ${jp.currentNewspaper || jp.organization || 'N/A'}`,
    `📍 *ప్రాంతం:* ${jp.mandal ? jp.mandal + ', ' : ''}${jp.district || 'N/A'}${jp.state ? ', ' + jp.state : ''}`,
    `🪪 *ఆధార్:* ${jp.aadhaarUrl ? '✅ అందుబాటులో' : '❌ లేదు'}`,
    `💳 *PAN:* ${jp.panCardUrl ? '✅ అందుబాటులో' : '❌ లేదు'}`,
    `👥 *నామినీ:* ${jp.nomineeName || '❌ లేదు'}`,
    `🔏 *KYC స్థితి:* ${jp.kycVerified ? '✅ వెరిఫైడ్' : '⏳ పెండింగ్'}`,
  ];
  await reply(phone, `📋 *KYC సమీక్ష*\n\n${lines.join('\n')}`);

  // Send document links
  if (jp.aadhaarUrl) await reply(phone, `🪪 *ఆధార్ ముందు భాగం:*\n${jp.aadhaarUrl}`);
  if (jp.aadhaarBackUrl) await reply(phone, `🪪 *ఆధార్ వెనక భాగం:*\n${jp.aadhaarBackUrl}`);
  if (jp.panCardUrl) await reply(phone, `💳 *PAN కార్డ్:*\n${jp.panCardUrl}`);

  await replyButtons(phone, 'ఈ సభ్యుని KYC ని అప్రూవ్ చేయాలా లేదా రిజెక్ట్ చేయాలా?',
    [
      { id: `kyc_approve:${profileId}`, title: '✅ అప్రూవ్ చేయి' },
      { id: `kyc_reject:${profileId}`, title: '❌ రిజెక్ట్ చేయి' },
    ]
  );
  await replyButtons(phone, '', [{ id: 'admin_back', title: '🔙 జాబితాకు తిరిగి' }]);
}

// ─── handleAdminMenuRequest (keyword shortcut) ────────────────────────────────
// Checks mobile number → if president/admin: show admin menu
//                       → if regular member: show member menu
//                       → if unregistered: show join prompt
async function handleAdminMenuRequest(phone: string) {
  const user = await findUserByWaPhone(phone);

  // Not registered at all — show join prompt
  if (!user) {
    const firstUnion = await (prisma as any).journalistUnionSettings.findFirst({ select: { displayName: true, unionName: true } }).catch(() => null);
    const displayName = firstUnion?.displayName || 'DJFW';
    await replyButtons(phone,
      `👋 *${displayName}‌కు స్వాగతం!*\n\nమీ *${displayName} ID కార్డ్* పొందడానికి సభ్యుడిగా చేరండి.\n\n*JOIN* లేదా *DJFW* పంపండి.`,
      [{ id: 'JOIN', title: '📋 ఇప్పుడే నమోదు చేయండి' }]
    );
    return;
  }

  const profile = await (prisma as any).journalistProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, unionName: true, state: true, currentDesignation: true, designation: true, approved: true },
  }).catch(() => null);

  const presCtx = await tryResolvePresidentMenuContext(user.id);
  if (presCtx) {
    const settings = await (prisma as any).journalistUnionSettings.findFirst({
      where: { unionName: presCtx.unionName },
      select: { displayName: true },
    }).catch(() => null);
    const displayName = settings?.displayName || presCtx.unionName;
    await showPresidentMenu(phone, user.id, presCtx.profileId || '', presCtx.unionName, presCtx.state, displayName);
    return;
  }

  // No journalist profile — show join prompt
  if (!profile) {
    const firstUnion = await (prisma as any).journalistUnionSettings.findFirst({ select: { displayName: true, unionName: true } }).catch(() => null);
    const displayName = firstUnion?.displayName || 'DJFW';
    await replyButtons(phone,
      `👋 *${displayName}‌కు స్వాగతం!*\n\nమీ *${displayName} ID కార్డ్* పొందడానికి సభ్యుడిగా చేరండి.`,
      [{ id: 'JOIN', title: '📋 ఇప్పుడే నమోదు చేయండి' }]
    );
    return;
  }

  const settings = await (prisma as any).journalistUnionSettings.findFirst({
    where: { unionName: profile.unionName },
    select: { displayName: true },
  }).catch(() => null);
  const displayName = settings?.displayName || profile.unionName || 'DJFW';

  // Check president / admin
  const isAdmin = await checkIsAdminOrPresident(user.id, profile.id, profile.unionName || '');
  if (isAdmin) {
    await showPresidentMenu(phone, user.id, profile.id, profile.unionName || '', profile.state || null, displayName);
    return;
  }

  // Regular member — show member menu
  const statusLine = profile.approved ? '✅ సభ్యత్వం అప్రూవ్ అయింది' : '⏳ అప్రూవల్ పెండింగ్';
  const positionLine = profile.currentDesignation || profile.designation || '';
  await replyButtons(phone,
    `👋 స్వాగతం!\n\n${statusLine}${positionLine ? `\n🏷️ ${positionLine}` : ''}${profile.state ? ` | 📍 ${profile.state}` : ''}\n\nమీరు ఏమి చేయాలనుకుంటున్నారు?`,
    buildJournalistMemberWaButtons(!!profile.approved),
  );
}

// ─── My Team handler (president/union-admin feature) ──────────────────────────
async function handleMyTeamRequest(phone: string) {
  const mobile10 = phone.startsWith('91') && phone.length === 12 ? phone.slice(2) : phone;

  const requestingUser = await prisma.user.findUnique({
    where: { mobileNumber: mobile10 },
    select: { id: true },
  }).catch(() => null);

  if (!requestingUser) {
    await reply(phone, '⚠️ మీ నంబర్ నమోదు కాలేదు. ముందు *DJFW* పంపి సభ్యుడిగా నమోదు చేయండి.');
    return;
  }

  const profile = await (prisma as any).journalistProfile.findUnique({
    where: { userId: requestingUser.id },
    select: { id: true, unionName: true, state: true },
  }).catch(() => null);

  if (!profile) {
    await reply(phone, '⚠️ జర్నలిస్ట్ ప్రొఫైల్ కనుగొనలేదు. అడ్మిన్‌ని సంప్రదించండి.');
    return;
  }

  // Check authority — post holder (President/Secretary) or union admin
  const postHolder = await (prisma as any).journalistUnionPostHolder.findFirst({
    where: {
      profileId: profile.id,
      isActive: true,
      post: { title: { contains: 'President', mode: 'insensitive' } },
    },
    select: { id: true },
  }).catch(() => null);

  const unionAdmin = await (prisma as any).journalistUnionAdmin.findFirst({
    where: { userId: requestingUser.id, unionName: profile.unionName },
    select: { state: true, unionName: true },
  }).catch(() => null);

  if (!postHolder && !unionAdmin) {
    await reply(phone, '⚠️ మీకు టీమ్ వివరాలు చూసే అనుమతి లేదు. అడ్మిన్‌ని సంప్రదించండి.');
    return;
  }

  const state: string | null = unionAdmin?.state || profile.state || null;
  const unionName: string = profile.unionName || '';

  await reply(phone, `⏳ మీ టీమ్ వివరాలు సేకరిస్తున్నాం...`);

  const stateFilter = state
    ? { state: { contains: state, mode: 'insensitive' as const } }
    : {};

  const members: any[] = await (prisma as any).journalistProfile.findMany({
    where: { unionName, ...stateFilter },
    select: {
      district: true,
      mandal: true,
      currentNewspaper: true,
      organization: true,
      currentDesignation: true,
      designation: true,
      approved: true,
      user: {
        select: {
          mobileNumber: true,
          profile: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ district: 'asc' }, { mandal: 'asc' }],
    take: 300,
  }).catch(() => []);

  if (members.length === 0) {
    await reply(phone, `ℹ️ ${state ? state + ' లో' : 'మీ యూనియన్‌లో'} సభ్యులు కనుగొనలేదు.`);
    return;
  }

  // Group by district
  const byDistrict: Record<string, any[]> = {};
  for (const m of members) {
    const dist = m.district || 'ఇతర';
    if (!byDistrict[dist]) byDistrict[dist] = [];
    byDistrict[dist].push(m);
  }

  await reply(phone,
    `📋 *${unionName} — ${state || 'అన్ని రాష్ట్రాలు'} సభ్యుల జాబితా*\n` +
    `🔢 మొత్తం: *${members.length}* మంది | జిల్లాలు: *${Object.keys(byDistrict).length}*`
  );

  for (const [district, distMembers] of Object.entries(byDistrict)) {
    let chunk = `📍 *${district}* (${distMembers.length} మంది)\n`;
    for (const m of distMembers) {
      const name = m.user?.profile?.fullName || 'N/A';
      const mob = m.user?.mobileNumber || '';
      const paper = m.currentNewspaper || m.organization || '';
      const position = m.currentDesignation || m.designation || '';
      const mandalTag = m.mandal ? ` [${m.mandal}]` : '';
      const status = m.approved ? '✅' : '⏳';
      const line = `${status} ${name} | 📱${mob}${paper ? ` | ${paper}` : ''}${position ? ` | ${position}` : ''}${mandalTag}\n`;
      if ((chunk + line).length > 3500) {
        await reply(phone, chunk.trim());
        chunk = line;
      } else {
        chunk += line;
      }
    }
    if (chunk.trim()) await reply(phone, chunk.trim());
  }

  await reply(phone, `✅ జాబితా పూర్తైంది.\n📝 మళ్ళీ *my team* పంపి తాజా జాబితా చూడవచ్చు.`);
}

export default router;