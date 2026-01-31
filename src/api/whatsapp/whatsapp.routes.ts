import { Router } from 'express';
import passport from 'passport';
import axios from 'axios';
import prisma from '../../lib/prisma';
import { config } from '../../config/env';

const router = Router();

/**
 * Fetch templates from Meta WhatsApp Business API
 * GET https://graph.facebook.com/v20.0/{WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates
 */
async function fetchTemplatesFromMeta(): Promise<{
  ok: boolean;
  templates?: any[];
  error?: string;
  details?: any;
}> {
  const accessToken = config.whatsapp.accessToken;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!accessToken) {
    return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };
  }
  if (!businessAccountId) {
    return { ok: false, error: 'WHATSAPP_BUSINESS_ACCOUNT_ID not configured' };
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${businessAccountId}/message_templates`;
    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { limit: 100 },
      timeout: 30000,
    });

    const templates = resp.data?.data || [];
    console.log(`[WhatsApp] Fetched ${templates.length} templates from Meta API`);
    return { ok: true, templates };
  } catch (e: any) {
    const details = e?.response?.data;
    const msg = e?.message || 'Failed to fetch templates from Meta';
    console.error('[WhatsApp] Fetch templates error:', msg, details);
    return { ok: false, error: msg, details };
  }
}

/**
 * Parse Meta template to our DB format
 */
function parseMetaTemplate(t: any) {
  const components = t.components || [];

  // Find header, body, footer, buttons
  const header = components.find((c: any) => c.type === 'HEADER');
  const body = components.find((c: any) => c.type === 'BODY');
  const footer = components.find((c: any) => c.type === 'FOOTER');
  const buttons = components.find((c: any) => c.type === 'BUTTONS');

  return {
    templateId: String(t.id),
    name: t.name,
    language: t.language || 'en_US',
    category: t.category || null,
    status: t.status || 'UNKNOWN',
    headerType: header?.format || null,
    headerText: header?.text || null,
    bodyText: body?.text || null,
    footerText: footer?.text || null,
    buttonsJson: buttons?.buttons || null,
    componentsJson: components,
    qualityScore: t.quality_score?.score || null,
    rejectedReason: t.rejected_reason || null,
    lastSyncedAt: new Date(),
  };
}

/**
 * @swagger
 * tags:
 *   - name: WhatsApp Templates
 *     description: Manage WhatsApp message templates
 */

/**
 * @swagger
 * /whatsapp/templates:
 *   get:
 *     summary: List all WhatsApp templates from database
 *     tags: [WhatsApp Templates]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [APPROVED, PENDING, REJECTED, DISABLED] }
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [AUTHENTICATION, MARKETING, UTILITY] }
 *     responses:
 *       200:
 *         description: List of templates
 */
router.get('/templates', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { status, category } = req.query as { status?: string; category?: string };
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const templates = await (prisma as any).whatsappTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      count: templates.length,
      templates,
    });
  } catch (e: any) {
    console.error('[WhatsApp] List templates error:', e);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

/**
 * @swagger
 * /whatsapp/templates/{name}:
 *   get:
 *     summary: Get a specific template by name
 *     tags: [WhatsApp Templates]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get('/templates/:name', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const template = await (prisma as any).whatsappTemplate.findUnique({
      where: { name: req.params.name },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (e: any) {
    console.error('[WhatsApp] Get template error:', e);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

/**
 * @swagger
 * /whatsapp/templates/sync:
 *   post:
 *     summary: Sync templates from Meta WhatsApp Business API
 *     description: |
 *       Fetches all templates from Meta API and upserts them into the database.
 *       Requires WHATSAPP_BUSINESS_ACCOUNT_ID env variable.
 *     tags: [WhatsApp Templates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 synced: { type: number }
 *                 created: { type: number }
 *                 updated: { type: number }
 *                 templates: { type: array }
 *       400:
 *         description: Configuration missing
 */
router.post('/templates/sync', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    // Check admin role
    const user = req.user as any;
    const role = user?.role?.name?.toUpperCase() || '';
    if (!['SUPER_ADMIN', 'ADMIN', 'TENANT_ADMIN'].includes(role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await fetchTemplatesFromMeta();
    if (!result.ok) {
      return res.status(400).json({ error: result.error, details: result.details });
    }

    const templates = result.templates || [];
    let created = 0;
    let updated = 0;

    for (const t of templates) {
      const data = parseMetaTemplate(t);

      const existing = await (prisma as any).whatsappTemplate.findUnique({
        where: { templateId: data.templateId },
      });

      if (existing) {
        await (prisma as any).whatsappTemplate.update({
          where: { templateId: data.templateId },
          data,
        });
        updated++;
      } else {
        await (prisma as any).whatsappTemplate.create({ data });
        created++;
      }
    }

    console.log(`[WhatsApp] Sync complete: ${created} created, ${updated} updated`);

    // Return synced templates
    const allTemplates = await (prisma as any).whatsappTemplate.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({
      synced: templates.length,
      created,
      updated,
      templates: allTemplates,
    });
  } catch (e: any) {
    console.error('[WhatsApp] Sync templates error:', e);
    res.status(500).json({ error: 'Failed to sync templates' });
  }
});

/**
 * @swagger
 * /whatsapp/templates/fetch-live:
 *   get:
 *     summary: Fetch templates directly from Meta API (without saving)
 *     tags: [WhatsApp Templates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Live templates from Meta
 */
router.get('/templates/fetch-live', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const result = await fetchTemplatesFromMeta();
    if (!result.ok) {
      return res.status(400).json({ error: result.error, details: result.details });
    }

    res.json({
      count: result.templates?.length || 0,
      templates: result.templates,
    });
  } catch (e: any) {
    console.error('[WhatsApp] Fetch live templates error:', e);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * @swagger
 * /whatsapp/config:
 *   get:
 *     summary: Get WhatsApp configuration status
 *     tags: [WhatsApp Templates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Configuration status
 */
router.get('/config', passport.authenticate('jwt', { session: false }), async (_req, res) => {
  const hasAccessToken = !!config.whatsapp.accessToken;
  const hasPhoneNumberId = !!config.whatsapp.phoneNumberId;
  const hasBusinessAccountId = !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  res.json({
    enabled: config.whatsapp.enabled,
    configured: hasAccessToken && hasPhoneNumberId,
    canSyncTemplates: hasAccessToken && hasBusinessAccountId,
    phoneNumberId: hasPhoneNumberId ? '***configured***' : null,
    businessAccountId: hasBusinessAccountId ? '***configured***' : null,
    defaultCountryCode: config.whatsapp.defaultCountryCode,
    templates: {
      otp: {
        name: config.whatsapp.otpTemplateName,
        language: config.whatsapp.otpTemplateLang,
      },
      idCard: {
        name: config.whatsapp.idCardTemplateName,
        language: config.whatsapp.idCardTemplateLang,
      },
    },
  });
});

export default router;
