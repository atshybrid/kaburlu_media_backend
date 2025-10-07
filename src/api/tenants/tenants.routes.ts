import { Router } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Tenants
 *     description: Tenant CRUD & PRGI fields
 */

/**
 * @swagger
 * /api/v1/tenants:
 *   get:
 *     summary: List tenants
 *     tags: [Tenants]
 *     responses:
 *       200:
 *         description: List of tenants
 */
router.get('/', async (_req, res) => {
  const tenants = await (prisma as any).tenant.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
  res.json(tenants);
});

/**
 * @swagger
 * /api/v1/tenants/{id}:
 *   get:
 *     summary: Get tenant by id
 *     tags: [Tenants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tenant }
 *       404: { description: Not found }
 */
router.get('/:id', async (req, res) => {
  const t = await (prisma as any).tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

export default router;
