import { Router, Request, Response } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Article Listing & Filters
 *   description: Role-based article listing with advanced filters
 */

/**
 * Helper: Get reporter profile for authenticated user
 */
async function getReporterProfile(userId: string) {
  return await prisma.reporter.findFirst({
    where: { userId },
    select: {
      id: true,
      tenantId: true,
      stateId: true,
      districtId: true,
      mandalId: true,
    },
  });
}

/**
 * Helper: Build Prisma where clause for location hierarchy
 */
function buildLocationFilter(stateId?: string, districtId?: string, mandalId?: string) {
  const locationFilter: any = {};

  if (mandalId) {
    // Mandal filter - must match exact mandal
    locationFilter.mandal = { id: mandalId };
  } else if (districtId) {
    // District filter - match district or any mandal in that district
    locationFilter.OR = [
      { district: { id: districtId } },
      { mandal: { districtId: districtId } },
    ];
  } else if (stateId) {
    // State filter - match state or any district/mandal in that state
    locationFilter.OR = [
      { state: { id: stateId } },
      { district: { stateId: stateId } },
      { mandal: { district: { stateId: stateId } } },
    ];
  }

  return Object.keys(locationFilter).length > 0 ? locationFilter : undefined;
}

/**
 * @swagger
 * /api/v1/articles/list/superadmin:
 *   get:
 *     summary: Get articles (Super Admin & Desk Editor)
 *     description: |
 *       Super Admin and Desk Editor can view all articles with filters:
 *       - Tenant-wise filter
 *       - State/District/Mandal hierarchy filter
 *       - Reporter filter
 *       - Priority filter
 *       - Date filter (defaults to current date)
 *       - Character count filter (min/max)
 *     tags: [Article Listing & Filters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         description: Filter by tenant ID
 *       - in: query
 *         name: stateId
 *         schema:
 *           type: string
 *         description: Filter by state (includes all districts/mandals in state)
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *         description: Filter by district (includes all mandals in district)
 *       - in: query
 *         name: mandalId
 *         schema:
 *           type: string
 *         description: Filter by specific mandal
 *       - in: query
 *         name: reporterId
 *         schema:
 *           type: string
 *         description: Filter by reporter ID
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *         description: Filter by priority (1=high, 2=medium, 3=low)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by creation date (YYYY-MM-DD, defaults to today)
 *       - in: query
 *         name: minChars
 *         schema:
 *           type: integer
 *         description: Minimum character count in content
 *       - in: query
 *         name: maxChars
 *         schema:
 *           type: integer
 *         description: Maximum character count in content
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page (max 200)
 *     responses:
 *       200:
 *         description: Article list with metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 articles:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       403:
 *         description: Forbidden - Super Admin or Desk Editor only
 */
router.get('/superadmin', passport.authenticate('jwt', { session: false }), async (req: Request, res: Response) => {
  try {
    const user: any = (req as any).user;
    if (!user || !user.role) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = user.role.name?.toUpperCase();
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
    const isDeskEditor = userRole === 'DESK_EDITOR';

    if (!isSuperAdmin && !isDeskEditor) {
      return res.status(403).json({ error: 'Forbidden: Super Admin or Desk Editor only' });
    }

    // Parse filters
    const {
      tenantId,
      stateId,
      districtId,
      mandalId,
      reporterId,
      priority,
      date,
      minChars,
      maxChars,
      page = 1,
      limit = 50,
    } = req.query;

    // Parse date (default to today)
    let targetDate = new Date();
    if (date && typeof date === 'string') {
      targetDate = new Date(date);
    }
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build where clause
    const where: any = {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (priority) {
      where.priority = parseInt(priority as string);
    }

    // Location hierarchy filter (only if reporter location data exists)
    if (reporterId) {
      where.authorId = reporterId;
    } else if (stateId || districtId || mandalId) {
      // We need to filter by reporter's location
      const locationFilter = buildLocationFilter(
        stateId as string | undefined,
        districtId as string | undefined,
        mandalId as string | undefined
      );

      if (locationFilter) {
        where.author = {
          reporterProfile: locationFilter,
        };
      }
    }

    // Character count filter
    if (minChars || maxChars) {
      // Use raw SQL for character count filtering
      const charCountFilter: any = {};
      if (minChars) charCountFilter.gte = parseInt(minChars as string);
      if (maxChars) charCountFilter.lte = parseInt(maxChars as string);

      // We'll filter this in memory after fetch for simplicity
      // OR use raw query if performance is critical
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Fetch articles
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          type: true,
          priority: true,
          viewCount: true,
          isBreakingNews: true,
          isTrending: true,
          tags: true,
          images: true,
          author: {
            select: {
              id: true,
              mobileNumber: true,
              email: true,
              reporterProfile: {
                select: {
                  id: true,
                  level: true,
                  state: { select: { id: true, name: true } },
                  district: { select: { id: true, name: true } },
                  mandal: { select: { id: true, name: true } },
                  designation: { select: { name: true, nativeName: true } },
                },
              },
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.article.count({ where }),
    ]);

    // Apply character count filter in memory if needed
    let filteredArticles = articles;
    if (minChars || maxChars) {
      filteredArticles = articles.filter((article) => {
        const charCount = article.content?.length || 0;
        if (minChars && charCount < parseInt(minChars as string)) return false;
        if (maxChars && charCount > parseInt(maxChars as string)) return false;
        return true;
      });
    }

    return res.json({
      articles: filteredArticles.map((a) => ({
        ...a,
        characterCount: a.content?.length || 0,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      filters: {
        tenantId,
        stateId,
        districtId,
        mandalId,
        reporterId,
        priority,
        date: targetDate.toISOString().split('T')[0],
        minChars,
        maxChars,
      },
    });
  } catch (error: any) {
    console.error('[Article List SuperAdmin] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch articles', details: error.message });
  }
});

/**
 * @swagger
 * /api/v1/articles/list/tenant:
 *   get:
 *     summary: Get articles (Tenant Admin)
 *     description: |
 *       Tenant Admin can view articles only within their tenant.
 *       Filters: state/district/mandal, reporter, priority, date, character count.
 *     tags: [Article Listing & Filters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stateId
 *         schema:
 *           type: string
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *       - in: query
 *         name: mandalId
 *         schema:
 *           type: string
 *       - in: query
 *         name: reporterId
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: minChars
 *         schema:
 *           type: integer
 *       - in: query
 *         name: maxChars
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Article list
 *       403:
 *         description: Forbidden
 */
router.get('/tenant', passport.authenticate('jwt', { session: false }), async (req: Request, res: Response) => {
  try {
    const user: any = (req as any).user;
    if (!user || !user.role) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = user.role.name?.toUpperCase();
    const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'ADMIN';

    if (!isTenantAdmin) {
      return res.status(403).json({ error: 'Forbidden: Tenant Admin only' });
    }

    // Get reporter profile to determine tenant
    const reporter = await getReporterProfile(user.id);
    if (!reporter) {
      return res.status(403).json({ error: 'Tenant Admin profile missing reporter linkage' });
    }

    const tenantId = reporter.tenantId;

    // Parse filters
    const {
      stateId,
      districtId,
      mandalId,
      reporterId,
      priority,
      date,
      minChars,
      maxChars,
      page = 1,
      limit = 50,
    } = req.query;

    // Parse date (default to today)
    let targetDate = new Date();
    if (date && typeof date === 'string') {
      targetDate = new Date(date);
    }
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build where clause (scoped to tenant)
    const where: any = {
      tenantId, // Always scoped to tenant
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (priority) {
      where.priority = parseInt(priority as string);
    }

    // Location hierarchy filter
    if (reporterId) {
      where.authorId = reporterId;
    } else if (stateId || districtId || mandalId) {
      const locationFilter = buildLocationFilter(
        stateId as string | undefined,
        districtId as string | undefined,
        mandalId as string | undefined
      );

      if (locationFilter) {
        where.author = {
          reporterProfile: locationFilter,
        };
      }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Fetch articles
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          type: true,
          priority: true,
          viewCount: true,
          isBreakingNews: true,
          isTrending: true,
          tags: true,
          images: true,
          author: {
            select: {
              id: true,
              mobileNumber: true,
              email: true,
              reporterProfile: {
                select: {
                  id: true,
                  level: true,
                  state: { select: { id: true, name: true } },
                  district: { select: { id: true, name: true } },
                  mandal: { select: { id: true, name: true } },
                  designation: { select: { name: true, nativeName: true } },
                },
              },
            },
          },
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.article.count({ where }),
    ]);

    // Apply character count filter
    let filteredArticles = articles;
    if (minChars || maxChars) {
      filteredArticles = articles.filter((article) => {
        const charCount = article.content?.length || 0;
        if (minChars && charCount < parseInt(minChars as string)) return false;
        if (maxChars && charCount > parseInt(maxChars as string)) return false;
        return true;
      });
    }

    return res.json({
      articles: filteredArticles.map((a) => ({
        ...a,
        characterCount: a.content?.length || 0,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      filters: {
        tenantId,
        stateId,
        districtId,
        mandalId,
        reporterId,
        priority,
        date: targetDate.toISOString().split('T')[0],
        minChars,
        maxChars,
      },
    });
  } catch (error: any) {
    console.error('[Article List Tenant] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch articles', details: error.message });
  }
});

/**
 * @swagger
 * /api/v1/articles/list/reporter:
 *   get:
 *     summary: Get my articles (Reporter)
 *     description: |
 *       Reporter can view only their own articles.
 *       Filters: priority, date (defaults to today), character count.
 *     tags: [Article Listing & Filters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *         description: Filter by priority
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by date (YYYY-MM-DD, defaults to today)
 *       - in: query
 *         name: minChars
 *         schema:
 *           type: integer
 *       - in: query
 *         name: maxChars
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Reporter's article list
 *       403:
 *         description: Forbidden
 */
router.get('/reporter', passport.authenticate('jwt', { session: false }), async (req: Request, res: Response) => {
  try {
    const user: any = (req as any).user;
    if (!user || !user.role) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = user.role.name?.toUpperCase();
    const isReporter = userRole === 'REPORTER';

    if (!isReporter) {
      return res.status(403).json({ error: 'Forbidden: Reporter only' });
    }

    // Parse filters
    const {
      priority,
      date,
      minChars,
      maxChars,
      page = 1,
      limit = 50,
    } = req.query;

    // Parse date (default to today)
    let targetDate = new Date();
    if (date && typeof date === 'string') {
      targetDate = new Date(date);
    }
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build where clause (scoped to reporter's own articles)
    const where: any = {
      authorId: user.id,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (priority) {
      where.priority = parseInt(priority as string);
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Fetch articles
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          type: true,
          priority: true,
          viewCount: true,
          isBreakingNews: true,
          isTrending: true,
          tags: true,
          images: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.article.count({ where }),
    ]);

    // Apply character count filter
    let filteredArticles = articles;
    if (minChars || maxChars) {
      filteredArticles = articles.filter((article) => {
        const charCount = article.content?.length || 0;
        if (minChars && charCount < parseInt(minChars as string)) return false;
        if (maxChars && charCount > parseInt(maxChars as string)) return false;
        return true;
      });
    }

    return res.json({
      articles: filteredArticles.map((a) => ({
        ...a,
        characterCount: a.content?.length || 0,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      filters: {
        priority,
        date: targetDate.toISOString().split('T')[0],
        minChars,
        maxChars,
      },
    });
  } catch (error: any) {
    console.error('[Article List Reporter] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch articles', details: error.message });
  }
});

export default router;
