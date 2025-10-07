import { Router } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Reporters
 *     description: Reporter hierarchy & roles
 */

/**
 * @swagger
 * /api/v1/reporters:
 *   get:
 *     summary: List reporters (demo)
 *     tags: [Reporters]
 *     responses:
 *       200: { description: List reporters }
 */
router.get('/', async (_req, res) => {
  const reporters = await (prisma as any).reporter.findMany({ take: 200, orderBy: { createdAt: 'desc' } });
  res.json(reporters);
});

export default router;
