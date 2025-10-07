import { Router } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Tenant Theme
 *     description: Branding assets & colors per tenant
 */

/**
 * @swagger
 * /api/v1/tenant-theme/{tenantId}:
 *   get:
 *     summary: Get tenant theme (demo)
 *     tags: [Tenant Theme]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Theme or null }
 */
router.get('/:tenantId', async (req, res) => {
  const theme = await (prisma as any).tenantTheme.findUnique({ where: { tenantId: req.params.tenantId } });
  res.json(theme || null);
});

export default router;
