import { Router } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: PRGI Verification
 *     description: Submit, verify or reject tenant PRGI compliance
 */

/**
 * @swagger
 * /api/v1/prgi/{tenantId}:
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

export default router;
