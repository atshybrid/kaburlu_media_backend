/**
 * Article Quota Management Routes (Admin)
 * Tenant admins can set quotas for reporters
 */
import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { getReporterQuotaLimits, getReporterDailyUsage } from '../../lib/articleQuota';

const router = Router();

/**
 * @swagger
 * /tenants/{tenantId}/article-quota:
 *   get:
 *     summary: Get tenant default article quota settings
 *     tags: [TenantAdmins]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant quota settings
 */
router.get('/tenants/:tenantId/article-quota', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const user = req.user as any;

    // Access control: Super admin or tenant admin of this tenant
    const userRole = user?.role?.name?.toUpperCase() || '';
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
    if (!isSuperAdmin) {
      const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'ADMIN';
      if (!isTenantAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      // Verify admin belongs to this tenant
      const adminReporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id, tenantId },
        select: { id: true }
      }).catch(() => null);
      if (!adminReporter) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }
    }

    let quota = await (prisma as any).tenantArticleQuota.findUnique({
      where: { tenantId },
      select: {
        maxPriority1Daily: true,
        maxPriority2Daily: true,
        maxPriority3Daily: true,
        maxTotalDaily: true,
        enforceQuota: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Create default if doesn't exist
    if (!quota) {
      quota = await (prisma as any).tenantArticleQuota.create({
        data: {
          tenantId,
          maxPriority1Daily: 5,
          maxPriority2Daily: 10,
          maxPriority3Daily: 20,
          maxTotalDaily: 30,
          enforceQuota: true
        }
      });
    }

    res.json(quota);
  } catch (e: any) {
    console.error('get tenant quota error', e);
    res.status(500).json({ error: 'Failed to get quota settings' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/article-quota:
 *   put:
 *     summary: Update tenant default article quota settings
 *     tags: [TenantAdmins]
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
 *               maxPriority1Daily: { type: integer, example: 5 }
 *               maxPriority2Daily: { type: integer, example: 10 }
 *               maxPriority3Daily: { type: integer, example: 20 }
 *               maxTotalDaily: { type: integer, example: 30 }
 *               enforceQuota: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Quota updated
 */
router.put('/tenants/:tenantId/article-quota', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const user = req.user as any;
    const { maxPriority1Daily, maxPriority2Daily, maxPriority3Daily, maxTotalDaily, enforceQuota } = req.body;

    // Access control
    const userRole = user?.role?.name?.toUpperCase() || '';
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
    if (!isSuperAdmin) {
      const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'ADMIN';
      if (!isTenantAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const adminReporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id, tenantId },
        select: { id: true }
      }).catch(() => null);
      if (!adminReporter) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }
    }

    const updateData: any = {};
    if (typeof maxPriority1Daily === 'number') updateData.maxPriority1Daily = maxPriority1Daily;
    if (typeof maxPriority2Daily === 'number') updateData.maxPriority2Daily = maxPriority2Daily;
    if (typeof maxPriority3Daily === 'number') updateData.maxPriority3Daily = maxPriority3Daily;
    if (typeof maxTotalDaily === 'number') updateData.maxTotalDaily = maxTotalDaily;
    if (typeof enforceQuota === 'boolean') updateData.enforceQuota = enforceQuota;

    const quota = await (prisma as any).tenantArticleQuota.upsert({
      where: { tenantId },
      update: updateData,
      create: {
        tenantId,
        maxPriority1Daily: maxPriority1Daily ?? 5,
        maxPriority2Daily: maxPriority2Daily ?? 10,
        maxPriority3Daily: maxPriority3Daily ?? 20,
        maxTotalDaily: maxTotalDaily ?? 30,
        enforceQuota: enforceQuota ?? true
      }
    });

    res.json({ success: true, quota });
  } catch (e: any) {
    console.error('update tenant quota error', e);
    res.status(500).json({ error: 'Failed to update quota settings' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{reporterId}/article-quota:
 *   get:
 *     summary: Get reporter-specific quota override
 *     tags: [TenantAdmins]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Reporter quota
 */
router.get('/tenants/:tenantId/reporters/:reporterId/article-quota', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, reporterId } = req.params;
    const user = req.user as any;

    // Access control
    const userRole = user?.role?.name?.toUpperCase() || '';
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
    if (!isSuperAdmin) {
      const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'ADMIN';
      if (!isTenantAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const adminReporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id, tenantId },
        select: { id: true }
      }).catch(() => null);
      if (!adminReporter) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }
    }

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id: reporterId, tenantId },
      select: {
        id: true,
        articleQuota: {
          select: {
            maxPriority1Daily: true,
            maxPriority2Daily: true,
            maxPriority3Daily: true,
            maxTotalDaily: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (!reporter) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    const effectiveQuota = await getReporterQuotaLimits(reporterId);

    res.json({
      reporterQuota: reporter.articleQuota,
      effectiveQuota
    });
  } catch (e: any) {
    console.error('get reporter quota error', e);
    res.status(500).json({ error: 'Failed to get reporter quota' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{reporterId}/article-quota:
 *   put:
 *     summary: Set reporter-specific quota override
 *     tags: [TenantAdmins]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxPriority1Daily: { type: integer, nullable: true }
 *               maxPriority2Daily: { type: integer, nullable: true }
 *               maxPriority3Daily: { type: integer, nullable: true }
 *               maxTotalDaily: { type: integer, nullable: true }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Quota updated
 */
router.put('/tenants/:tenantId/reporters/:reporterId/article-quota', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, reporterId } = req.params;
    const user = req.user as any;
    const { maxPriority1Daily, maxPriority2Daily, maxPriority3Daily, maxTotalDaily, isActive } = req.body;

    // Access control
    const userRole = user?.role?.name?.toUpperCase() || '';
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
    if (!isSuperAdmin) {
      const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'ADMIN';
      if (!isTenantAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const adminReporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id, tenantId },
        select: { id: true }
      }).catch(() => null);
      if (!adminReporter) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }
    }

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id: reporterId, tenantId },
      select: { id: true }
    });

    if (!reporter) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    const updateData: any = {};
    if (maxPriority1Daily !== undefined) updateData.maxPriority1Daily = maxPriority1Daily;
    if (maxPriority2Daily !== undefined) updateData.maxPriority2Daily = maxPriority2Daily;
    if (maxPriority3Daily !== undefined) updateData.maxPriority3Daily = maxPriority3Daily;
    if (maxTotalDaily !== undefined) updateData.maxTotalDaily = maxTotalDaily;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const quota = await (prisma as any).reporterArticleQuota.upsert({
      where: { reporterId },
      update: updateData,
      create: {
        reporterId,
        ...updateData,
        isActive: isActive ?? true
      }
    });

    res.json({ success: true, quota });
  } catch (e: any) {
    console.error('update reporter quota error', e);
    res.status(500).json({ error: 'Failed to update reporter quota' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/article-quota-summary:
 *   get:
 *     summary: Get all reporters quota usage summary
 *     tags: [TenantAdmins]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Date for usage stats (YYYY-MM-DD), defaults to today
 *     responses:
 *       200:
 *         description: Quota summary for all reporters
 */
router.get('/tenants/:tenantId/reporters/article-quota-summary', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { date } = req.query;
    const user = req.user as any;

    // Access control
    const userRole = user?.role?.name?.toUpperCase() || '';
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
    if (!isSuperAdmin) {
      const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'ADMIN';
      if (!isTenantAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const adminReporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id, tenantId },
        select: { id: true }
      }).catch(() => null);
      if (!adminReporter) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }
    }

    const targetDate = date ? new Date(String(date)) : new Date();

    const tenantQuota = await (prisma as any).tenantArticleQuota.findUnique({
      where: { tenantId },
      select: {
        maxPriority1Daily: true,
        maxPriority2Daily: true,
        maxPriority3Daily: true,
        maxTotalDaily: true,
        enforceQuota: true
      }
    });

    const reporters = await (prisma as any).reporter.findMany({
      where: { tenantId, active: true },
      select: {
        id: true,
        user: {
          select: {
            profile: {
              select: { fullName: true }
            }
          }
        },
        articleQuota: {
          select: {
            maxPriority1Daily: true,
            maxPriority2Daily: true,
            maxPriority3Daily: true,
            maxTotalDaily: true,
            isActive: true
          }
        }
      }
    });

    const summary = await Promise.all(reporters.map(async (reporter: any) => {
      const quota = await getReporterQuotaLimits(reporter.id);
      const usage = await getReporterDailyUsage(reporter.id, targetDate);
      
      return {
        reporterId: reporter.id,
        name: reporter.user?.profile?.fullName || 'Unknown',
        quota,
        usage,
        remaining: {
          priority1: Math.max(0, quota.maxPriority1Daily - usage.priority1Count),
          priority2: Math.max(0, quota.maxPriority2Daily - usage.priority2Count),
          priority3: Math.max(0, quota.maxPriority3Daily - usage.priority3Count),
          total: Math.max(0, quota.maxTotalDaily - usage.totalCount)
        }
      };
    }));

    res.json({
      date: targetDate.toISOString().split('T')[0],
      tenantDefaults: tenantQuota,
      reporters: summary
    });
  } catch (e: any) {
    console.error('quota summary error', e);
    res.status(500).json({ error: 'Failed to get quota summary' });
  }
});

export default router;
