/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Analytics
 *     description: Tenant and reporter analytics with article counts and breakdowns
 */

/**
 * @swagger
 * /analytics/tenant:
 *   get:
 *     summary: Get tenant analytics with all reporters breakdown
 *     description: |
 *       **TENANT ANALYTICS**
 *       
 *       Returns tenant-wide statistics and individual reporter breakdowns.
 *       
 *       **Access Control:**
 *       - TENANT_ADMIN: Gets their tenant's analytics
 *       - REPORTER: Gets only their own analytics (single reporter)
 *       - SUPER_ADMIN: Can pass tenantId query param
 *       
 *       **Returns:**
 *       - Total articles count (tenant-wide)
 *       - Total published count (tenant-wide)
 *       - Monthly breakdown (tenant-wide)
 *       - Per-reporter breakdown with individual stats
 *       
 *       **Each Reporter Includes:**
 *       - Reporter details (name, designation, location)
 *       - Total articles
 *       - Total published articles
 *       - Monthly breakdown (day-wise)
 *       - Status breakdown (PUBLISHED, PENDING, DRAFT)
 *     tags: [Analytics]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: "Required for SUPER_ADMIN. Optional for TENANT_ADMIN (uses their tenant)."
 *       - in: query
 *         name: month
 *         schema: { type: string }
 *         description: "Month in YYYY-MM format. Defaults to current month."
 *         example: "2026-01"
 *     responses:
 *       200:
 *         description: Tenant analytics with reporter breakdowns
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 month:
 *                   type: string
 *                 tenantId:
 *                   type: string
 *                 tenantStats:
 *                   type: object
 *                   properties:
 *                     totalArticles:
 *                       type: integer
 *                     totalPublished:
 *                       type: integer
 *                     totalPending:
 *                       type: integer
 *                     totalDraft:
 *                       type: integer
 *                     monthlyBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           day: { type: integer }
 *                           articles: { type: integer }
 *                           published: { type: integer }
 *                 reporters:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       reporter:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           fullName: { type: string }
 *                           designation: { type: string }
 *                           location: { type: string }
 *                           mobile: { type: string }
 *                       stats:
 *                         type: object
 *                         properties:
 *                           totalArticles: { type: integer }
 *                           totalPublished: { type: integer }
 *                           totalPending: { type: integer }
 *                           totalDraft: { type: integer }
 *                           monthlyBreakdown:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 day: { type: integer }
 *                                 articles: { type: integer }
 *             examples:
 *               tenantAdmin:
 *                 value:
 *                   success: true
 *                   month: "2026-01"
 *                   tenantId: "tenant_xyz"
 *                   tenantStats:
 *                     totalArticles: 150
 *                     totalPublished: 120
 *                     totalPending: 25
 *                     totalDraft: 5
 *                     monthlyBreakdown:
 *                       - { day: 1, articles: 5, published: 4 }
 *                       - { day: 2, articles: 6, published: 5 }
 *                   reporters:
 *                     - reporter:
 *                         id: "rep_123"
 *                         fullName: "రాజేష్ కుమార్"
 *                         designation: "సీనియర్ రిపోర్టర్"
 *                         location: "విజయవాడ"
 *                         mobile: "+91 9876543210"
 *                       stats:
 *                         totalArticles: 45
 *                         totalPublished: 40
 *                         totalPending: 5
 *                         totalDraft: 0
 *                         monthlyBreakdown:
 *                           - { day: 1, articles: 2 }
 *                           - { day: 2, articles: 1 }
 */
router.get('/tenant', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '').toUpperCase();
    const { tenantId: queryTenantId, month } = req.query;
    
    // Resolve tenant
    let tenantId: string | null = null;
    
    if (roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN') {
      if (!queryTenantId) {
        return res.status(400).json({ error: 'SUPER_ADMIN must provide tenantId query parameter' });
      }
      tenantId = String(queryTenantId);
    } else if (roleName === 'TENANT_ADMIN') {
      // Get from user's reporter record (tenant admins are stored as reporters)
      const reporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id },
        select: { tenantId: true }
      });
      tenantId = reporter?.tenantId || (queryTenantId ? String(queryTenantId) : null);
    } else if (roleName === 'REPORTER') {
      // Get from reporter profile
      const reporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id },
        select: { tenantId: true }
      });
      tenantId = reporter?.tenantId || null;
    }
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Could not determine tenant' });
    }
    
    // Parse month
    let targetMonth: Date;
    let monthEnd: Date;
    
    if (month) {
      const [year, monthNum] = String(month).split('-').map(Number);
      targetMonth = new Date(year, monthNum - 1, 1);
      monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      targetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    
    const monthStart = targetMonth;
    const daysInMonth = monthEnd.getDate();
    
    // If reporter, only show their own stats
    let reporters: any[];
    if (roleName === 'REPORTER') {
      reporters = await (prisma as any).reporter.findMany({
        where: { userId: user.id, tenantId },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              mobileNumber: true,
              profile: { select: { fullName: true, designation: true, location: true } }
            }
          }
        }
      });
    } else {
      // Tenant admin or super admin - get all reporters for tenant
      reporters = await (prisma as any).reporter.findMany({
        where: { tenantId },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              mobileNumber: true,
              profile: { select: { fullName: true, designation: true, location: true } }
            }
          }
        }
      });
    }
    
    // Calculate stats for each reporter
    const reporterStats = await Promise.all(reporters.map(async (reporter: any) => {
      const articles = await (prisma as any).newspaperArticle.findMany({
        where: {
          authorId: reporter.userId,
          tenantId,
          createdAt: { gte: monthStart, lte: monthEnd }
        },
        select: {
          id: true,
          status: true,
          createdAt: true
        }
      });
      
      const totalArticles = articles.length;
      const totalPublished = articles.filter((a: any) => a.status === 'PUBLISHED').length;
      const totalPending = articles.filter((a: any) => a.status === 'PENDING').length;
      const totalDraft = articles.filter((a: any) => a.status === 'DRAFT').length;
      
      // Monthly breakdown
      const monthlyBreakdown: { day: number; articles: number }[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dayArticles = articles.filter((art: any) => {
          const artDay = new Date(art.createdAt).getDate();
          return artDay === day;
        });
        monthlyBreakdown.push({ day, articles: dayArticles.length });
      }
      
      return {
        reporter: {
          id: reporter.id,
          fullName: reporter.user?.profile?.fullName || 'N/A',
          designation: reporter.user?.profile?.designation || 'Reporter',
          location: reporter.user?.profile?.location || 'N/A',
          mobile: reporter.user?.mobileNumber || 'N/A'
        },
        stats: {
          totalArticles,
          totalPublished,
          totalPending,
          totalDraft,
          monthlyBreakdown
        }
      };
    }));
    
    // Calculate tenant-wide stats
    const tenantArticles = await (prisma as any).newspaperArticle.findMany({
      where: {
        tenantId,
        createdAt: { gte: monthStart, lte: monthEnd }
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    });
    
    const tenantTotalArticles = tenantArticles.length;
    const tenantTotalPublished = tenantArticles.filter((a: any) => a.status === 'PUBLISHED').length;
    const tenantTotalPending = tenantArticles.filter((a: any) => a.status === 'PENDING').length;
    const tenantTotalDraft = tenantArticles.filter((a: any) => a.status === 'DRAFT').length;
    
    // Tenant monthly breakdown
    const tenantMonthlyBreakdown: { day: number; articles: number; published: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayArticles = tenantArticles.filter((art: any) => {
        const artDay = new Date(art.createdAt).getDate();
        return artDay === day;
      });
      const dayPublished = dayArticles.filter((a: any) => a.status === 'PUBLISHED').length;
      tenantMonthlyBreakdown.push({ 
        day, 
        articles: dayArticles.length, 
        published: dayPublished 
      });
    }
    
    return res.json({
      success: true,
      month: `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`,
      tenantId,
      tenantStats: {
        totalArticles: tenantTotalArticles,
        totalPublished: tenantTotalPublished,
        totalPending: tenantTotalPending,
        totalDraft: tenantTotalDraft,
        monthlyBreakdown: tenantMonthlyBreakdown
      },
      reporters: reporterStats
    });
    
  } catch (e: any) {
    console.error('[Analytics] Tenant error:', e);
    return res.status(500).json({ error: 'Failed to fetch analytics', details: e.message });
  }
});

/**
 * @swagger
 * /analytics/reporter:
 *   get:
 *     summary: Get reporter's own analytics (reporter token only)
 *     description: |
 *       **REPORTER ANALYTICS**
 *       
 *       Returns individual reporter's statistics.
 *       
 *       **Access:** REPORTER role only (uses token to identify reporter)
 *       
 *       **Returns:**
 *       - Total articles
 *       - Total published
 *       - Status breakdown
 *       - Monthly day-wise breakdown
 *       - Weekly breakdown
 *     tags: [Analytics]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: string }
 *         description: "Month in YYYY-MM format. Defaults to current month."
 *     responses:
 *       200:
 *         description: Reporter analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 month: { type: string }
 *                 reporter:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     fullName: { type: string }
 *                     designation: { type: string }
 *                     location: { type: string }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalArticles: { type: integer }
 *                     totalPublished: { type: integer }
 *                     totalPending: { type: integer }
 *                     totalDraft: { type: integer }
 *                     monthlyBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           day: { type: integer }
 *                           articles: { type: integer }
 *                           published: { type: integer }
 */
router.get('/reporter', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user: any = (req as any).user;
    const { month } = req.query;
    
    // Get reporter profile
    const reporter = await (prisma as any).reporter.findFirst({
      where: { userId: user.id },
      select: {
        id: true,
        tenantId: true,
        user: {
          select: {
            mobileNumber: true,
            profile: { select: { fullName: true, designation: true, location: true } }
          }
        }
      }
    });
    
    if (!reporter) {
      return res.status(404).json({ error: 'Reporter profile not found' });
    }
    
    // Parse month
    let targetMonth: Date;
    let monthEnd: Date;
    
    if (month) {
      const [year, monthNum] = String(month).split('-').map(Number);
      targetMonth = new Date(year, monthNum - 1, 1);
      monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      targetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    
    const monthStart = targetMonth;
    const daysInMonth = monthEnd.getDate();
    
    // Get articles
    const articles = await (prisma as any).newspaperArticle.findMany({
      where: {
        authorId: user.id,
        tenantId: reporter.tenantId,
        createdAt: { gte: monthStart, lte: monthEnd }
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    });
    
    const totalArticles = articles.length;
    const totalPublished = articles.filter((a: any) => a.status === 'PUBLISHED').length;
    const totalPending = articles.filter((a: any) => a.status === 'PENDING').length;
    const totalDraft = articles.filter((a: any) => a.status === 'DRAFT').length;
    
    // Monthly breakdown
    const monthlyBreakdown: { day: number; articles: number; published: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayArticles = articles.filter((art: any) => {
        const artDay = new Date(art.createdAt).getDate();
        return artDay === day;
      });
      const dayPublished = dayArticles.filter((a: any) => a.status === 'PUBLISHED').length;
      monthlyBreakdown.push({ 
        day, 
        articles: dayArticles.length,
        published: dayPublished
      });
    }
    
    return res.json({
      success: true,
      month: `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`,
      reporter: {
        id: reporter.id,
        fullName: reporter.user?.profile?.fullName || 'N/A',
        designation: reporter.user?.profile?.designation || 'Reporter',
        location: reporter.user?.profile?.location || 'N/A'
      },
      stats: {
        totalArticles,
        totalPublished,
        totalPending,
        totalDraft,
        monthlyBreakdown
      }
    });
    
  } catch (e: any) {
    console.error('[Analytics] Reporter error:', e);
    return res.status(500).json({ error: 'Failed to fetch reporter analytics', details: e.message });
  }
});

export default router;
