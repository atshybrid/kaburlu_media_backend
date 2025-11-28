import { Router } from 'express';
import prisma from '../../lib/prisma';
import passport from 'passport';
import { requireSuperAdmin } from '../middlewares/authz';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * tags:
 *   - name: PRGI Verification
 *     description: Submit, verify or reject tenant PRGI compliance
 */

/**
 * @swagger
 * /prgi/{tenantId}:
 *   get:
 *     summary: Get PRGI status for tenant (demo)
 *     tags: [PRGI Verification]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tenant PRGI info }
 */
router.get('/:tenantId', async (req, res) => {
  const tenant = await (prisma as any).tenant.findUnique({ where: { id: req.params.tenantId } });
  if (!tenant) return res.status(404).json({ error: 'Not found' });
  res.json({ id: tenant.id, prgiNumber: tenant.prgiNumber, prgiStatus: tenant.prgiStatus });
});

/**
 * @swagger
 * /prgi/{tenantId}/submit:
 *   post:
 *     summary: Mark PRGI as submitted for a tenant [Superadmin]
 *     tags: [PRGI Verification]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated PRGI status }
 */
router.post('/:tenantId/submit', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: { prgiStatus: 'SUBMITTED', prgiSubmittedAt: new Date(), prgiRejectedAt: null, prgiRejectionReason: null },
      select: { id: true, prgiNumber: true, prgiStatus: true, prgiSubmittedAt: true }
    }).catch(() => null);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (e) {
    console.error('PRGI submit error', e);
    res.status(500).json({ error: 'Failed to update PRGI status' });
  }
});

/**
 * @swagger
 * /prgi/{tenantId}/verify:
 *   post:
 *     summary: Verify PRGI for a tenant (activate) [Superadmin]
 *     tags: [PRGI Verification]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated PRGI status }
 */
router.post('/:tenantId/verify', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: { prgiStatus: 'VERIFIED', prgiVerifiedAt: new Date(), prgiRejectedAt: null, prgiRejectionReason: null },
      select: { id: true, prgiNumber: true, prgiStatus: true, prgiVerifiedAt: true }
    }).catch(() => null);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (e) {
    console.error('PRGI verify error', e);
    res.status(500).json({ error: 'Failed to update PRGI status' });
  }
});

/**
 * @swagger
 * /prgi/{tenantId}/reject:
 *   post:
 *     summary: Reject PRGI for a tenant [Superadmin]
 *     tags: [PRGI Verification]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Updated PRGI status }
 */
router.post('/:tenantId/reject', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const reason = (req.body?.reason as string) || null;
    const tenant = await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: { prgiStatus: 'REJECTED', prgiRejectedAt: new Date(), prgiRejectionReason: reason },
      select: { id: true, prgiNumber: true, prgiStatus: true, prgiRejectedAt: true, prgiRejectionReason: true }
    }).catch(() => null);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (e) {
    console.error('PRGI reject error', e);
    res.status(500).json({ error: 'Failed to update PRGI status' });
  }
});

export default router;
