/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Leaderboard
 *     description: Reporter monthly leaderboard and rankings
 */

/**
 * @swagger
 * /leaderboard/reporters/monthly:
 *   get:
 *     summary: Get monthly reporter leaderboard with rankings (1-30)
 *     description: |
 *       **MONTHLY REPORTER LEADERBOARD**
 *       
 *       Shows top reporters ranked by article count and views for the current month.
 *       
 *       **Modes:**
 *       - All Tenants: Leave tenantId empty to see top reporters across all tenants
 *       - Single Tenant: Pass tenantId to see rankings within specific tenant
 *       
 *       **Ranking Criteria:**
 *       - Primary: Total articles posted in current month
 *       - Secondary: Total article views
 *       
 *       **Returns (for each reporter):**
 *       - Rank (1-30)
 *       - Full name, designation, location
 *       - Tenant name and logo
 *       - Total articles posted (month)
 *       - Total article views (month)
 *       - Top article details
 *       - Daily breakdown (1st to 30th)
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: "Optional - Filter by specific tenant. Omit to see all tenants."
 *       - in: query
 *         name: month
 *         schema: { type: string, format: date }
 *         description: "Optional - Month in YYYY-MM format. Defaults to current month."
 *         example: "2026-01"
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 30 }
 *         description: "Max number of reporters to return (1-100)"
 *     responses:
 *       200:
 *         description: Monthly leaderboard with reporter rankings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 month:
 *                   type: string
 *                   example: "2026-01"
 *                 tenantId:
 *                   type: string
 *                   nullable: true
 *                 scope:
 *                   type: string
 *                   enum: [all_tenants, single_tenant]
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:
 *                         type: integer
 *                         example: 1
 *                       reporter:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           fullName: { type: string }
 *                           designation: { type: string }
 *                           location: { type: string }
 *                           mobile: { type: string }
 *                       tenant:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string }
 *                           nativeName: { type: string }
 *                           logoUrl: { type: string }
 *                       stats:
 *                         type: object
 *                         properties:
 *                           totalArticles: { type: integer }
 *                           totalViews: { type: integer }
 *                           topArticle:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               title: { type: string }
 *                               views: { type: integer }
 *                           dailyBreakdown:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 day: { type: integer }
 *                                 articles: { type: integer }
 *             examples:
 *               allTenants:
 *                 value:
 *                   success: true
 *                   month: "2026-01"
 *                   tenantId: null
 *                   scope: "all_tenants"
 *                   leaderboard:
 *                     - rank: 1
 *                       reporter:
 *                         id: "rep_123"
 *                         fullName: "రాజేష్ కుమార్"
 *                         designation: "సీనియర్ రిపోర్టర్"
 *                         location: "విజయవాడ, కృష్ణా జిల్లా"
 *                         mobile: "+91 9876543210"
 *                       tenant:
 *                         id: "tenant_xyz"
 *                         name: "Kaburlu Today"
 *                         nativeName: "కబుర్లు టుడే"
 *                         logoUrl: "https://cdn.kaburlu.com/logos/tenant.png"
 *                       stats:
 *                         totalArticles: 45
 *                         totalViews: 12500
 *                         topArticle:
 *                           id: "art_456"
 *                           title: "వైద్య నిర్లక్ష్యం కేసు"
 *                           views: 3200
 *                         dailyBreakdown:
 *                           - { day: 1, articles: 2 }
 *                           - { day: 2, articles: 1 }
 */
router.get('/reporters/monthly', async (req, res) => {
  try {
    const { tenantId, month, limit = '30' } = req.query;
    
    // Parse month (default to current month)
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
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 30));
    
    // Build where clause for articles
    const articleWhere: any = {
      createdAt: {
        gte: monthStart,
        lte: monthEnd
      },
      status: 'PUBLISHED'
    };
    
    if (tenantId) {
      articleWhere.tenantId = String(tenantId);
    }
    
    // Get all reporters with their articles for the month
    const reporters = await (prisma as any).reporter.findMany({
      where: tenantId ? { tenantId: String(tenantId) } : {},
      select: {
        id: true,
        userId: true,
        tenantId: true,
        kycData: true,
        user: {
          select: {
            id: true,
            mobileNumber: true,
            profile: {
              select: {
                fullName: true,
                designation: true,
                location: true
              }
            }
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            nativeName: true,
            theme: {
              select: {
                logoUrl: true
              }
            }
          }
        }
      }
    });
    
    // Calculate stats for each reporter
    const leaderboardData = await Promise.all(reporters.map(async (reporter: any) => {
      // Get article stats
      const articles = await (prisma as any).newspaperArticle.findMany({
        where: {
          authorId: reporter.userId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          },
          status: 'PUBLISHED'
        },
        select: {
          id: true,
          title: true,
          viewCount: true,
          createdAt: true
        }
      });
      
      const totalArticles = articles.length;
      const totalViews = articles.reduce((sum: number, art: any) => sum + (art.viewCount || 0), 0);
      
      // Find top article
      const topArticle = articles.length > 0
        ? articles.reduce((max: any, art: any) => (art.viewCount || 0) > (max.viewCount || 0) ? art : max)
        : null;
      
      // Daily breakdown
      const dailyBreakdown: { day: number; articles: number }[] = [];
      const daysInMonth = monthEnd.getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dayArticles = articles.filter((art: any) => {
          const artDay = new Date(art.createdAt).getDate();
          return artDay === day;
        });
        dailyBreakdown.push({ day, articles: dayArticles.length });
      }
      
      return {
        reporterId: reporter.id,
        reporter: {
          id: reporter.id,
          fullName: reporter.user?.profile?.fullName || 'N/A',
          designation: reporter.user?.profile?.designation || reporter.kycData?.designation || 'Reporter',
          location: reporter.user?.profile?.location || reporter.kycData?.location || 'N/A',
          mobile: reporter.user?.mobileNumber || 'N/A'
        },
        tenant: {
          id: reporter.tenant?.id || '',
          name: reporter.tenant?.name || 'N/A',
          nativeName: reporter.tenant?.nativeName || 'N/A',
          logoUrl: reporter.tenant?.theme?.logoUrl || null
        },
        stats: {
          totalArticles,
          totalViews,
          topArticle: topArticle ? {
            id: topArticle.id,
            title: topArticle.title,
            views: topArticle.viewCount || 0
          } : null,
          dailyBreakdown
        }
      };
    }));
    
    // Filter out reporters with 0 articles and sort by totalArticles (desc) then totalViews (desc)
    const sortedLeaderboard = leaderboardData
      .filter(item => item.stats.totalArticles > 0)
      .sort((a, b) => {
        if (b.stats.totalArticles !== a.stats.totalArticles) {
          return b.stats.totalArticles - a.stats.totalArticles;
        }
        return b.stats.totalViews - a.stats.totalViews;
      })
      .slice(0, limitNum)
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }));
    
    // Remove reporterId from final response
    const finalLeaderboard = sortedLeaderboard.map(({ reporterId, ...rest }) => rest);
    
    return res.json({
      success: true,
      month: `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`,
      tenantId: tenantId ? String(tenantId) : null,
      scope: tenantId ? 'single_tenant' : 'all_tenants',
      leaderboard: finalLeaderboard
    });
    
  } catch (e: any) {
    console.error('[Leaderboard] Monthly error:', e);
    return res.status(500).json({ error: 'Failed to fetch leaderboard', details: e.message });
  }
});

/**
 * @swagger
 * /leaderboard/reporters/daily:
 *   get:
 *     summary: Get daily reporter performance (current day)
 *     description: |
 *       Shows today's top reporters by article count and views.
 *       Useful for real-time daily tracking.
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: "Optional - Date in YYYY-MM-DD format. Defaults to today."
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Daily leaderboard
 */
router.get('/reporters/daily', async (req, res) => {
  try {
    const { tenantId, date, limit = '30' } = req.query;
    
    // Parse date (default to today)
    let targetDate: Date;
    if (date) {
      targetDate = new Date(String(date));
    } else {
      targetDate = new Date();
    }
    
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 30));
    
    // Get reporters with articles today
    const reporters = await (prisma as any).reporter.findMany({
      where: tenantId ? { tenantId: String(tenantId) } : {},
      select: {
        id: true,
        userId: true,
        tenantId: true,
        user: {
          select: {
            mobileNumber: true,
            profile: { select: { fullName: true, designation: true, location: true } }
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            nativeName: true,
            theme: { select: { logoUrl: true } }
          }
        }
      }
    });
    
    const leaderboardData = await Promise.all(reporters.map(async (reporter: any) => {
      const articles = await (prisma as any).newspaperArticle.findMany({
        where: {
          authorId: reporter.userId,
          createdAt: { gte: dayStart, lte: dayEnd },
          status: 'PUBLISHED'
        },
        select: {
          id: true,
          title: true,
          viewCount: true
        }
      });
      
      return {
        reporter: {
          id: reporter.id,
          fullName: reporter.user?.profile?.fullName || 'N/A',
          designation: reporter.user?.profile?.designation || 'Reporter',
          location: reporter.user?.profile?.location || 'N/A'
        },
        tenant: {
          id: reporter.tenant?.id || '',
          name: reporter.tenant?.name || 'N/A',
          nativeName: reporter.tenant?.nativeName || 'N/A',
          logoUrl: reporter.tenant?.theme?.logoUrl || null
        },
        stats: {
          totalArticles: articles.length,
          totalViews: articles.reduce((sum: number, art: any) => sum + (art.viewCount || 0), 0)
        }
      };
    }));
    
    const sortedLeaderboard = leaderboardData
      .filter(item => item.stats.totalArticles > 0)
      .sort((a, b) => {
        if (b.stats.totalArticles !== a.stats.totalArticles) {
          return b.stats.totalArticles - a.stats.totalArticles;
        }
        return b.stats.totalViews - a.stats.totalViews;
      })
      .slice(0, limitNum)
      .map((item, index) => ({ rank: index + 1, ...item }));
    
    return res.json({
      success: true,
      date: targetDate.toISOString().split('T')[0],
      tenantId: tenantId ? String(tenantId) : null,
      leaderboard: sortedLeaderboard
    });
    
  } catch (e: any) {
    console.error('[Leaderboard] Daily error:', e);
    return res.status(500).json({ error: 'Failed to fetch daily leaderboard', details: e.message });
  }
});

export default router;
