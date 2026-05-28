/**
 * WhatsApp Business API — templates (request, sync, approval) + send messages.
 */
import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { config } from '../../config/env';
import { requireSuperAdmin } from '../middlewares/authz';
import {
  sendWhatsappOtpTemplate,
  sendWhatsappIdCardTemplate,
  sendWhatsappTextMessage,
  uploadWhatsappMedia,
} from '../../lib/whatsapp';
import {
  createMetaMessageTemplate,
  deleteMetaMessageTemplate,
  fetchMetaMessageTemplates,
  getWhatsappMetaConfig,
  sendMetaTemplateMessage,
  type CreateTemplateInput,
} from '../../lib/whatsappMeta';
import {
  getApprovedTemplate,
  syncAllTemplatesFromMeta,
  updateTemplateStatusByName,
  upsertTemplateFromMeta,
} from '../../lib/whatsappTemplateDb';

const router = Router();
const p: any = prisma;
const jwtAuth = passport.authenticate('jwt', { session: false });

function handleError(res: Response, e: any, fallback = 'Request failed') {
  const msg = e?.message || fallback;
  console.error('[whatsapp]', msg, e?.details || '');
  return res.status(500).json({ success: false, error: msg, details: e?.details });
}

function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  const role = user?.role?.name?.toUpperCase() || '';
  if (!['SUPER_ADMIN', 'ADMIN', 'TENANT_ADMIN'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  return next();
}

/**
 * @swagger
 * tags:
 *   - name: WhatsApp
 *     description: |
 *       WhatsApp Cloud API — template create/request, sync after Meta approval, send OTP/ID card/custom templates.
 *       Requires env WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID.
 */

/**
 * @swagger
 * /whatsapp/config:
 *   get:
 *     summary: WhatsApp configuration status (keys masked)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/config', jwtAuth, async (_req, res) => {
  const c = getWhatsappMetaConfig();
  res.json({
    success: true,
    enabled: c.enabled,
    configured: !!(c.accessToken && c.phoneNumberId),
    canManageTemplates: !!(c.accessToken && c.businessAccountId),
    graphVersion: c.graphVersion,
    phoneNumberId: c.phoneNumberId ? '***set***' : null,
    businessAccountId: c.businessAccountId ? '***set***' : null,
    appId: c.appId ? '***set***' : null,
    defaultCountryCode: c.defaultCountryCode,
    webhookVerifyToken: config.whatsapp.webhookVerifyToken ? '***set***' : null,
    templates: {
      otp: { name: config.whatsapp.otpTemplateName, language: config.whatsapp.otpTemplateLang },
      idCard: { name: config.whatsapp.idCardTemplateName, language: config.whatsapp.idCardTemplateLang },
    },
  });
});

/**
 * @swagger
 * /whatsapp/templates/fetch-live:
 *   get:
 *     summary: Fetch templates directly from Meta (no DB save)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/templates/fetch-live', jwtAuth, requireAdminRole, async (_req, res) => {
  const result = await fetchMetaMessageTemplates();
  if (!result.ok) return res.status(400).json({ success: false, error: result.error, details: result.details });
  return res.json({ success: true, count: result.data.length, templates: result.data });
});

/**
 * @swagger
 * /whatsapp/templates/sync:
 *   post:
 *     summary: Sync all templates from Meta into database (after approval in Meta Business)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/templates/sync', jwtAuth, requireAdminRole, async (_req, res) => {
  try {
    const result = await fetchMetaMessageTemplates();
    if (!result.ok) return res.status(400).json({ success: false, error: result.error, details: result.details });
    const sync = await syncAllTemplatesFromMeta(result.data);
    return res.json({ success: true, ...sync });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /whatsapp/templates/request:
 *   post:
 *     summary: Submit new template to Meta for approval (Super Admin)
 *     description: |
 *       Creates template in Meta with status PENDING. After Meta approves, call POST /templates/sync
 *       or wait for webhook `message_template_status_update`.
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: kaburlu_survey_reminder
 *             language: en_US
 *             category: UTILITY
 *             components:
 *               - type: BODY
 *                 text: "Hi {{1}}, please complete your union survey by {{2}}."
 *     responses:
 *       201:
 *         description: Submitted to Meta
 */
router.post('/templates/request', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const body = req.body as CreateTemplateInput;
    if (!body?.name || !body?.category || !Array.isArray(body.components)) {
      return res.status(400).json({
        success: false,
        error: 'name, category, and components[] are required',
      });
    }

    const result = await createMetaMessageTemplate(body);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error, details: result.details });
    }

    const meta = result.data;
    const row = await upsertTemplateFromMeta({
      id: meta?.id || `pending_${body.name}`,
      name: body.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      language: body.language || 'en_US',
      category: body.category,
      status: meta?.status || 'PENDING',
      components: body.components,
    });

    return res.status(201).json({
      success: true,
      message: 'Template submitted to Meta. Status is usually PENDING until approved (24–48h).',
      meta: result.data,
      template: row,
      nextSteps: [
        'Subscribe webhook field message_template_status_update in Meta App',
        'POST /whatsapp/templates/sync after approval',
      ],
    });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /whatsapp/templates:
 *   get:
 *     summary: List templates from database
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [APPROVED, PENDING, REJECTED, DISABLED] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 */
router.get('/templates', jwtAuth, async (req, res) => {
  try {
    const { status, category } = req.query as { status?: string; category?: string };
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    const templates = await p.whatsappTemplate.findMany({ where, orderBy: { name: 'asc' } });
    return res.json({ success: true, count: templates.length, templates });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /whatsapp/templates/{name}:
 *   get:
 *     summary: Get template by name from DB
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     summary: Delete template from Meta + DB (Super Admin)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/templates/:name', jwtAuth, async (req, res) => {
  try {
    const template = await p.whatsappTemplate.findUnique({ where: { name: req.params.name } });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    return res.json({ success: true, template });
  } catch (e: any) {
    return handleError(res, e);
  }
});

router.delete('/templates/:name', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const name = req.params.name;
    const del = await deleteMetaMessageTemplate(name);
    if (!del.ok) {
      return res.status(400).json({ success: false, error: del.error, details: del.details });
    }
    await p.whatsappTemplate.deleteMany({ where: { name } }).catch(() => null);
    return res.json({ success: true, deleted: name });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /whatsapp/messages/template:
 *   post:
 *     summary: Send approved template message (Super Admin / manual test)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             to: "9392010248"
 *             templateName: kaburlu_app_otp
 *             languageCode: en_US
 *             bodyParams: ["123456", "Login", "10 minutes", "9392010248"]
 *             urlButtonParam: "123456"
 */
router.post('/messages/template', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const {
      to,
      toMobileNumber,
      templateName,
      languageCode,
      bodyParams,
      header,
      urlButtonParam,
      urlButtonIndex,
      skipApprovalCheck,
    } = req.body || {};

    const mobile = toMobileNumber || to;
    if (!mobile || !templateName) {
      return res.status(400).json({ success: false, error: 'to and templateName are required' });
    }

    if (!skipApprovalCheck) {
      const approved = await getApprovedTemplate(templateName, languageCode);
      if (!approved) {
        return res.status(400).json({
          success: false,
          error: `Template "${templateName}" is not APPROVED in DB. Sync templates or wait for Meta approval.`,
          hint: 'POST /whatsapp/templates/sync',
        });
      }
    }

    const lang = languageCode || (await getApprovedTemplate(templateName))?.language || 'en_US';
    const result = await sendMetaTemplateMessage({
      toMobileNumber: mobile,
      templateName,
      languageCode: lang,
      bodyParams: Array.isArray(bodyParams) ? bodyParams.map(String) : undefined,
      header,
      urlButtonParam,
      urlButtonIndex,
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error, details: result.details });
    }
    return res.json({ success: true, messageId: result.messageId });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /whatsapp/messages/otp:
 *   post:
 *     summary: Send OTP via configured WhatsApp template
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/messages/otp', jwtAuth, requireSuperAdmin, async (req, res) => {
  const { to, otp, purpose } = req.body || {};
  if (!to || !otp) return res.status(400).json({ success: false, error: 'to and otp required' });
  const result = await sendWhatsappOtpTemplate({
    toMobileNumber: to,
    otp: String(otp),
    purpose: purpose || 'Login',
    ttlText: config.whatsapp.ttlText,
    supportMobile: config.whatsapp.supportMobile || to,
  });
  if (!result.ok) return res.status(400).json({ success: false, ...result });
  return res.json({ success: true, messageId: result.messageId });
});

/**
 * @swagger
 * /whatsapp/messages/id-card:
 *   post:
 *     summary: Send reporter ID card PDF via WhatsApp template
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/messages/id-card', jwtAuth, requireSuperAdmin, async (req, res) => {
  const { to, pdfUrl, organizationName, cardType, documentType, pdfFilename } = req.body || {};
  if (!to || !pdfUrl || !organizationName) {
    return res.status(400).json({ success: false, error: 'to, pdfUrl, organizationName required' });
  }
  const result = await sendWhatsappIdCardTemplate({
    toMobileNumber: to,
    pdfUrl,
    organizationName,
    cardType,
    documentType,
    pdfFilename,
  });
  if (!result.ok) return res.status(400).json({ success: false, ...result });
  return res.json({ success: true, messageId: result.messageId });
});

/**
 * @swagger
 * /whatsapp/messages/text:
 *   post:
 *     summary: Send plain text (24h window only — user must have messaged you first)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/messages/text', jwtAuth, requireSuperAdmin, async (req, res) => {
  const { to, text } = req.body || {};
  if (!to || !text) return res.status(400).json({ success: false, error: 'to and text required' });
  const result = await sendWhatsappTextMessage({ to, text });
  if (!result.ok) return res.status(400).json({ success: false, ...result });
  return res.json({ success: true, messageId: result.messageId });
});

/**
 * @swagger
 * /whatsapp/media/upload:
 *   post:
 *     summary: Upload media URL to WhatsApp (get media_id for template header)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/media/upload', jwtAuth, requireSuperAdmin, async (req, res) => {
  const { fileUrl, mimeType } = req.body || {};
  if (!fileUrl || !mimeType) {
    return res.status(400).json({ success: false, error: 'fileUrl and mimeType required' });
  }
  const result = await uploadWhatsappMedia({ fileUrl, mimeType });
  if (!result.ok) return res.status(400).json({ success: false, ...result });
  return res.json({ success: true, mediaId: result.mediaId });
});

/**
 * @swagger
 * /whatsapp/webhook-events:
 *   get:
 *     summary: Recent webhook events (debug delivery / incoming)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/webhook-events', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(String(req.query.limit || 30), 10));
    const events = await p.whatsappWebhookEvent.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, count: events.length, events });
  } catch (e: any) {
    return handleError(res, e);
  }
});

export default router;
