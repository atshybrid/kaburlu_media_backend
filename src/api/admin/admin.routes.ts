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

export default router;