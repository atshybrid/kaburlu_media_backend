import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperAdmin } from '../middlewares/authz';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Platform-wide administrative endpoints
 */

/**
 * @swagger
 * /admin/razorpay-config/global:
 *   post:
 *     summary: Create global Razorpay keys (SUPER_ADMIN)
 *     description: Fails if a global config already exists. Use PUT to update.
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [keyId, keySecret]
 *             properties:
 *               keyId: { type: string }
 *               keySecret: { type: string }
 *               active: { type: boolean, default: true }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       409: { description: Already exists }
 *   put:
 *     summary: Upsert global Razorpay keys (SUPER_ADMIN)
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [keyId, keySecret]
 *             properties:
 *               keyId: { type: string }
 *               keySecret: { type: string }
 *               active: { type: boolean, default: true }
 *     responses:
 *       200: { description: Global config upserted }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   get:
 *     summary: Get global Razorpay config (SUPER_ADMIN)
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Global config (masked) }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.put('/razorpay-config/global', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { keyId, keySecret, active = true } = req.body || {};
    if (!keyId || !keySecret) return res.status(400).json({ error: 'keyId and keySecret are required' });
    console.log('[ADMIN] Upserting global RazorpayConfig');
    // Because tenantId is nullable and @@unique([tenantId]) allows many NULLs in Postgres, we cannot rely on upsert by tenantId:null.
    // Instead fetch first existing global row (tenantId == null) and update by id, else create new.
    const existing = await (prisma as any).razorpayConfig.findFirst({ where: { tenantId: null }, orderBy: { createdAt: 'asc' } });
    let config;
    if (existing) {
      config = await (prisma as any).razorpayConfig.update({
        where: { id: existing.id },
        data: { keyId, keySecret, active: Boolean(active) }
      });
    } else {
      config = await (prisma as any).razorpayConfig.create({
        data: { tenantId: null, keyId, keySecret, active: Boolean(active) }
      });
    }
    res.json({
      id: config.id,
      tenantId: config.tenantId,
      keyId: config.keyId,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    });
  } catch (e: any) {
    console.error('global razorpay-config upsert error (admin router)', e);
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate global Razorpay config' });
    }
    res.status(500).json({ error: 'Failed to upsert global Razorpay config' });
  }
});

router.post('/razorpay-config/global', auth, requireSuperAdmin, async (req, res) => {
  try {
    // Cannot use findUnique with tenantId:null reliably; use findFirst to detect existing global row.
    const existing = await (prisma as any).razorpayConfig.findFirst({ where: { tenantId: null } });
    if (existing) return res.status(409).json({ error: 'Global Razorpay config already exists. Use PUT to update.' });
    const { keyId, keySecret, active = true } = req.body || {};
    if (!keyId || !keySecret) return res.status(400).json({ error: 'keyId and keySecret are required' });
    const created = await (prisma as any).razorpayConfig.create({ data: { tenantId: null, keyId, keySecret, active: Boolean(active) } });
    res.status(201).json({
      id: created.id,
      tenantId: created.tenantId,
      keyId: created.keyId,
      active: created.active,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    });
  } catch (e: any) {
    console.error('global razorpay-config post error', e);
    if (e.code === 'P2002') return res.status(409).json({ error: 'Duplicate global Razorpay config' });
    res.status(500).json({ error: 'Failed to create global Razorpay config' });
  }
});

router.get('/razorpay-config/global', auth, requireSuperAdmin, async (_req, res) => {
  try {
    console.log('[ADMIN] Fetching global RazorpayConfig');
    // Use findFirst because findUnique rejects nullable unique field queries with null
    const config = await (prisma as any).razorpayConfig.findFirst({ where: { tenantId: null } });
    if (!config) return res.status(404).json({ error: 'Global Razorpay config not set' });
    const maskedSecret = config.keySecret ? `${config.keySecret.slice(0,4)}***${config.keySecret.slice(-2)}` : null;
    res.json({
      id: config.id,
      tenantId: config.tenantId,
      keyId: config.keyId,
      keySecretMasked: maskedSecret,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    });
  } catch (e) {
    console.error('global razorpay-config get error (admin router)', e);
    res.status(500).json({ error: 'Failed to fetch global Razorpay config' });
  }
});

// Debug endpoint: list all RazorpayConfig rows (SUPER_ADMIN only)
/**
 * @swagger
 * /admin/razorpay-config/_debug/list:
 *   get:
 *     summary: DEBUG ONLY - List all RazorpayConfig rows
 *     tags: [Razorpay Config]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of configs }
 */
router.get('/razorpay-config/_debug/list', auth, requireSuperAdmin, async (_req, res) => {
  try {
    const rows = await (prisma as any).razorpayConfig.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenantId,
      keyId: r.keyId,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    })));
  } catch (e) {
    console.error('debug list razorpay-config error', e);
    res.status(500).json({ error: 'Failed to list configs' });
  }
});

/**
 * @swagger
 * /admin/ai/usage:
 *   get:
 *     summary: List AI usage events (SUPER_ADMIN)
 *     tags: [AI Rewrite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: Usage events }
 */
router.get('/ai/usage', auth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = String((req.query as any).tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const limitRaw = Number((req.query as any).limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 50;

    const rows = await (prisma as any).aiUsageEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return res.json({ tenantId, count: rows.length, items: rows });
  } catch (e) {
    console.error('admin ai usage list error', e);
    return res.status(500).json({ error: 'Failed to list AI usage' });
  }
});

/**
 * @swagger
 * /admin/ai/usage/summary:
 *   get:
 *     summary: Summarize AI usage (SUPER_ADMIN)
 *     tags: [AI Rewrite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         required: false
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         required: false
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: Totals }
 */
router.get('/ai/usage/summary', auth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = String((req.query as any).tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const fromRaw = (req.query as any).from ? String((req.query as any).from) : '';
    const toRaw = (req.query as any).to ? String((req.query as any).to) : '';
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if (from && Number.isNaN(from.getTime())) return res.status(400).json({ error: 'Invalid from date' });
    if (to && Number.isNaN(to.getTime())) return res.status(400).json({ error: 'Invalid to date' });

    const where: any = { tenantId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const agg = await (prisma as any).aiUsageEvent.aggregate({
      where,
      _count: { _all: true },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
    });

    return res.json({
      tenantId,
      range: { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null },
      count: agg?._count?._all || 0,
      tokens: {
        prompt: agg?._sum?.promptTokens || 0,
        completion: agg?._sum?.completionTokens || 0,
        total: agg?._sum?.totalTokens || 0,
      }
    });
  } catch (e) {
    console.error('admin ai usage summary error', e);
    return res.status(500).json({ error: 'Failed to summarize AI usage' });
  }
});

/**
 * @swagger
 * /admin/tenants/{tenantId}/ai-billing:
 *   patch:
 *     summary: Configure tenant AI billing enforcement (SUPER_ADMIN)
 *     tags: [AI Rewrite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               aiBillingEnabled: { type: boolean }
 *               aiMonthlyTokenLimit: { type: integer, nullable: true, description: 'Monthly token cap. Null disables cap (even if billing enabled).' }
 *           examples:
 *             enableCap:
 *               value: { aiBillingEnabled: true, aiMonthlyTokenLimit: 200000 }
 *             disableBilling:
 *               value: { aiBillingEnabled: false, aiMonthlyTokenLimit: null }
 *     responses:
 *       200: { description: Updated flags }
 */
router.patch('/tenants/:tenantId/ai-billing', auth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = String((req.params as any).tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

    const aiBillingEnabled = typeof req.body?.aiBillingEnabled === 'boolean' ? req.body.aiBillingEnabled : undefined;
    const aiMonthlyTokenLimitRaw = req.body?.aiMonthlyTokenLimit;
    const aiMonthlyTokenLimit = aiMonthlyTokenLimitRaw === null || typeof aiMonthlyTokenLimitRaw === 'undefined'
      ? null
      : Number(aiMonthlyTokenLimitRaw);

    if (typeof aiBillingEnabled === 'undefined') {
      return res.status(400).json({ error: 'aiBillingEnabled boolean required' });
    }
    if (aiMonthlyTokenLimit !== null) {
      if (!Number.isFinite(aiMonthlyTokenLimit) || aiMonthlyTokenLimit < 0) {
        return res.status(400).json({ error: 'aiMonthlyTokenLimit must be a non-negative integer or null' });
      }
    }

    const upserted = await (prisma as any).tenantFeatureFlags.upsert({
      where: { tenantId },
      update: {
        aiBillingEnabled,
        aiMonthlyTokenLimit: aiMonthlyTokenLimit === null ? null : Math.floor(aiMonthlyTokenLimit),
      },
      create: {
        tenantId,
        aiBillingEnabled,
        aiMonthlyTokenLimit: aiMonthlyTokenLimit === null ? null : Math.floor(aiMonthlyTokenLimit),
      },
    });

    return res.json({ tenantId, flags: upserted });
  } catch (e) {
    console.error('admin tenant ai-billing patch error', e);
    return res.status(500).json({ error: 'Failed to update tenant AI billing' });
  }
});

/**
 * @swagger
 * /admin/tenants/{tenantId}/ai-billing/status:
 *   get:
 *     summary: Get tenant AI billing status (SUPER_ADMIN)
 *     tags: [AI Rewrite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Billing status with current month token usage }
 */
router.get('/tenants/:tenantId/ai-billing/status', auth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = String((req.params as any).tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

    const flags = await (prisma as any).tenantFeatureFlags.findUnique({ where: { tenantId } }).catch(() => null);
    const billingEnabled = flags?.aiBillingEnabled === true;
    const limit = typeof flags?.aiMonthlyTokenLimit === 'number' ? flags.aiMonthlyTokenLimit : null;

    const nowUtc = new Date();
    const monthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0, 0, 0, 0));
    const usedAgg = await (prisma as any).aiUsageEvent?.aggregate?.({
      where: { tenantId, createdAt: { gte: monthStart } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }).catch(() => null);

    const used = Number(usedAgg?._sum?.totalTokens || 0);
    const count = Number(usedAgg?._count?._all || 0);
    const remaining = limit && limit > 0 ? Math.max(0, limit - used) : null;
    const exceeded = limit && limit > 0 ? used >= limit : false;

    return res.json({
      tenantId,
      flags: {
        aiBillingEnabled: billingEnabled,
        aiMonthlyTokenLimit: limit,
      },
      currentMonth: {
        monthStartUtc: monthStart.toISOString(),
        usageEvents: count,
        usedTokens: used,
        remainingTokens: remaining,
        exceeded,
      }
    });
  } catch (e) {
    console.error('admin tenant ai-billing status error', e);
    return res.status(500).json({ error: 'Failed to fetch tenant AI billing status' });
  }
});

export default router;