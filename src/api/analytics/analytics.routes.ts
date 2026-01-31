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
    
    if (roleName === 'SUPER_ADMIN') {
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

/**
 * @swagger
 * /analytics/desk-editors:
 *   get:
 *     summary: Get DESK_EDITOR login stats, working hours, and epaper page counts (SUPER_ADMIN only)
 *     description: |
 *       Returns login tracking, working hours, and daily epaper page post counts for all DESK_EDITOR users.
 *       
 *       **Returns for each DESK_EDITOR:**
 *       - User details (id, mobile, email, fullName)
 *       - lastLoginAt, loginCount
 *       - Working hours (from session tracking)
 *       - Daily epaper page counts (EpaperEdition.totalPages)
 *       - Total pages designed
 *     tags: [Analytics]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: "Specific date for daily stats (YYYY-MM-DD). Defaults to today."
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 7 }
 *         description: "Number of days to include in breakdown (max 30)"
 *     responses:
 *       200:
 *         description: DESK_EDITOR stats with working hours
 *         content:
 *           application/json:
 *             example:
 *               dateRange: { start: "2026-01-25", end: "2026-01-31", days: 7 }
 *               editors:
 *                 - id: "user_123"
 *                   fullName: "రాజేష్ కుమార్"
 *                   lastLoginAt: "2026-01-31T08:30:00.000Z"
 *                   loginCount: 45
 *                   workingHours:
 *                     totalMinutes: 2400
 *                     totalHours: 40
 *                     dailyBreakdown:
 *                       "2026-01-31": { minutes: 480, hours: 8 }
 *                       "2026-01-30": { minutes: 420, hours: 7 }
 *                   totalEditions: 25
 *                   totalPages: 200
 *               summary:
 *                 totalEditors: 3
 *                 totalPages: 600
 *                 totalWorkingHours: 120
 *       403:
 *         description: Forbidden - SUPER_ADMIN only
 */
router.get('/desk-editors', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '').toUpperCase();

    // Only SUPER_ADMIN can access this
    if (roleName !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: SUPER_ADMIN only' });
    }

    const daysParam = Math.min(30, Math.max(1, parseInt(String(req.query.days || '7'), 10) || 7));
    const dateParam = req.query.date ? new Date(String(req.query.date)) : new Date();

    // Find DESK_EDITOR role
    const deskEditorRole = await prisma.role.findFirst({ where: { name: 'DESK_EDITOR' } });
    if (!deskEditorRole) {
      return res.json({ editors: [], message: 'No DESK_EDITOR role found' });
    }

    // Get all DESK_EDITOR users with login tracking
    const editors: any[] = await (prisma as any).user.findMany({
      where: { roleId: deskEditorRole.id },
      select: {
        id: true,
        mobileNumber: true,
        email: true,
        status: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        profile: { select: { fullName: true, profilePhotoUrl: true } },
      },
      orderBy: { lastLoginAt: 'desc' },
    });

    // Calculate date range for breakdown
    const endDate = new Date(dateParam);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - daysParam + 1);
    startDate.setHours(0, 0, 0, 0);

    // Get epaper page counts per editor (EpaperPageLayout created by them)
    // Since EpaperPageLayout doesn't have a direct userId, we track via EpaperEdition.generatedBy or NewspaperArticle.authorId
    const editorIds = editors.map((e: any) => e.id);

    // Get EpaperEdition counts per editor with totalPages (this is the actual page count)
    const editionsByEditor = await (prisma as any).epaperEdition.findMany({
      where: {
        generatedBy: { in: editorIds },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        generatedBy: true,
        totalPages: true,
        editionDate: true,
        createdAt: true,
        status: true,
      },
    }).catch(() => []);

    // Get total editions and pages per editor (all time)
    const totalEditions = await (prisma as any).epaperEdition.findMany({
      where: { generatedBy: { in: editorIds } },
      select: { generatedBy: true, totalPages: true },
    }).catch(() => []);

    // Build lookup maps
    const totalByEditor: Record<string, { editions: number; pages: number }> = {};
    for (const row of totalEditions) {
      if (!row.generatedBy) continue;
      if (!totalByEditor[row.generatedBy]) totalByEditor[row.generatedBy] = { editions: 0, pages: 0 };
      totalByEditor[row.generatedBy].editions += 1;
      totalByEditor[row.generatedBy].pages += row.totalPages || 0;
    }

    // Build daily breakdown per editor (pages per day)
    const dailyByEditor: Record<string, Record<string, { editions: number; pages: number }>> = {};
    for (const row of editionsByEditor) {
      if (!row.generatedBy) continue;
      const dateKey = new Date(row.editionDate || row.createdAt).toISOString().split('T')[0];
      if (!dailyByEditor[row.generatedBy]) dailyByEditor[row.generatedBy] = {};
      if (!dailyByEditor[row.generatedBy][dateKey]) dailyByEditor[row.generatedBy][dateKey] = { editions: 0, pages: 0 };
      dailyByEditor[row.generatedBy][dateKey].editions += 1;
      dailyByEditor[row.generatedBy][dateKey].pages += row.totalPages || 0;
    }

    // Fetch working hours from UserLoginSession
    const sessions = await (prisma as any).userLoginSession.findMany({
      where: {
        userId: { in: editorIds },
        loginAt: { gte: startDate, lte: endDate },
      },
      select: {
        userId: true,
        loginAt: true,
        logoutAt: true,
        lastActivityAt: true,
        durationMinutes: true,
      },
    }).catch(() => []);

    // Calculate working hours per editor (daily and total)
    const workingHoursByEditor: Record<string, { totalMinutes: number; dailyBreakdown: Record<string, { minutes: number; sessions: number }> }> = {};
    for (const session of sessions) {
      if (!session.userId) continue;
      if (!workingHoursByEditor[session.userId]) {
        workingHoursByEditor[session.userId] = { totalMinutes: 0, dailyBreakdown: {} };
      }

      // Calculate duration: use durationMinutes if available (closed session), 
      // otherwise estimate from loginAt to lastActivityAt (open session)
      let duration = session.durationMinutes || 0;
      if (!duration && session.loginAt) {
        const endTime = session.logoutAt || session.lastActivityAt || session.loginAt;
        duration = Math.round((new Date(endTime).getTime() - new Date(session.loginAt).getTime()) / 60000);
      }

      workingHoursByEditor[session.userId].totalMinutes += duration;

      const dateKey = new Date(session.loginAt).toISOString().split('T')[0];
      if (!workingHoursByEditor[session.userId].dailyBreakdown[dateKey]) {
        workingHoursByEditor[session.userId].dailyBreakdown[dateKey] = { minutes: 0, sessions: 0 };
      }
      workingHoursByEditor[session.userId].dailyBreakdown[dateKey].minutes += duration;
      workingHoursByEditor[session.userId].dailyBreakdown[dateKey].sessions += 1;
    }

    // Format response
    const result = editors.map((editor: any) => {
      const wh = workingHoursByEditor[editor.id];
      // Format daily breakdown with hours
      const dailyWorkingHours: Record<string, { minutes: number; hours: number; sessions: number }> = {};
      if (wh) {
        for (const [date, data] of Object.entries(wh.dailyBreakdown)) {
          dailyWorkingHours[date] = {
            minutes: data.minutes,
            hours: Math.round((data.minutes / 60) * 100) / 100,
            sessions: data.sessions,
          };
        }
      }

      return {
        id: editor.id,
        mobileNumber: editor.mobileNumber,
        email: editor.email,
        status: editor.status,
        fullName: editor.profile?.fullName || null,
        profilePhotoUrl: editor.profile?.profilePhotoUrl || null,
        createdAt: editor.createdAt,
        // Login tracking
        lastLoginAt: editor.lastLoginAt,
        loginCount: editor.loginCount || 0,
        // Working hours
        workingHours: {
          totalMinutes: wh?.totalMinutes || 0,
          totalHours: wh ? Math.round((wh.totalMinutes / 60) * 100) / 100 : 0,
          dailyBreakdown: dailyWorkingHours,
        },
        // Epaper page counts (actual pages designed)
        totalEditions: totalByEditor[editor.id]?.editions || 0,
        totalPages: totalByEditor[editor.id]?.pages || 0,
        // Daily breakdown (pages per day)
        dailyPageBreakdown: dailyByEditor[editor.id] || {},
      };
    });

    // Calculate totals
    let totalEditionsSum = 0;
    let totalPagesSum = 0;
    let totalWorkingMinutes = 0;
    for (const stats of Object.values(totalByEditor)) {
      totalEditionsSum += stats.editions;
      totalPagesSum += stats.pages;
    }
    for (const wh of Object.values(workingHoursByEditor)) {
      totalWorkingMinutes += wh.totalMinutes;
    }

    return res.json({
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: daysParam,
      },
      editors: result,
      summary: {
        totalEditors: editors.length,
        activeToday: editors.filter((e: any) => e.lastLoginAt && new Date(e.lastLoginAt).toDateString() === new Date().toDateString()).length,
        totalEditions: totalEditionsSum,
        totalPages: totalPagesSum,
        totalWorkingMinutes,
        totalWorkingHours: Math.round((totalWorkingMinutes / 60) * 100) / 100,
      },
    });
  } catch (e: any) {
    console.error('[Analytics] Desk editors error:', e);
    return res.status(500).json({ error: 'Failed to fetch desk editor analytics', details: e.message });
  }
});

export default router;
