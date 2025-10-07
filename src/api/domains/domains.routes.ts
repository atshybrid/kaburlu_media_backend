import { Router } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Domains
 *     description: Domain verification & status management
 */

/**
 * @swagger
 * /api/v1/domains:
 *   get:
 *     summary: List domains
 *     tags: [Domains]
 *     responses:
 *       200: { description: List domains }
 */
router.get('/', async (_req, res) => {
  const domains = await (prisma as any).domain.findMany({ include: { tenant: true }, take: 200 });
  res.json(domains);
});

export default router;
