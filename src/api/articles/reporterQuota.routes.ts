/**
 * Reporter Article Quota Routes (Reporter Self-Service)
 * Reporters can check their own quota and usage
 */
import { Router } from 'express';
import passport from 'passport';
import { getReporterQuotaLimits, getReporterDailyUsage } from '../../lib/articleQuota';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * /reporter/article-quota:
 *   get:
 *     summary: Get my article quota and usage
 *     tags: [Article Quota Management]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Date for usage stats (YYYY-MM-DD), defaults to today
 *     responses:
 *       200:
 *         description: My quota and usage
 */
router.get('/reporter/article-quota', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    const { date } = req.query;

    const reporter = await (prisma as any).reporter.findFirst({
      where: { userId: user.id },
      select: { id: true }
    });

    if (!reporter) {
      return res.status(404).json({ error: 'Reporter profile not found' });
    }

    const targetDate = date ? new Date(String(date)) : new Date();
    const quota = await getReporterQuotaLimits(reporter.id);
    const usage = await getReporterDailyUsage(reporter.id, targetDate);

    const remaining = {
      priority1: Math.max(0, quota.maxPriority1Daily - usage.priority1Count),
      priority2: Math.max(0, quota.maxPriority2Daily - usage.priority2Count),
      priority3: Math.max(0, quota.maxPriority3Daily - usage.priority3Count),
      total: Math.max(0, quota.maxTotalDaily - usage.totalCount)
    };

    const canPost = {
      priority1: remaining.priority1 > 0 && remaining.total > 0,
      priority2: remaining.priority2 > 0 && remaining.total > 0,
      priority3: remaining.priority3 > 0 && remaining.total > 0
    };

    res.json({
      date: targetDate.toISOString().split('T')[0],
      quota,
      usage,
      remaining,
      canPost
    });
  } catch (e: any) {
    console.error('reporter quota check error', e);
    res.status(500).json({ error: 'Failed to get quota information' });
  }
});

export default router;
