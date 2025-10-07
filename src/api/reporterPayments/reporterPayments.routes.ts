import { Router } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Reporter Payments
 *     description: Annual subscription/payment tracking
 */

/**
 * @swagger
 * /api/v1/reporter-payments:
 *   get:
 *     summary: List reporter payments (demo)
 *     tags: [Reporter Payments]
 *     responses:
 *       200: { description: List payments }
 */
router.get('/', async (_req, res) => {
  const payments = await (prisma as any).reporterPayment.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
  res.json(payments);
});

export default router;
