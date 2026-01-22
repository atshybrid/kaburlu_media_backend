import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

/**
 * REPORTER ARTICLES CONTROLLER
 * 
 * Dedicated API for reporter dashboard - filters strictly by authorId from JWT.
 * 
 * Design Principles:
 * - No tenantId logic (reporter sees only their own articles)
 * - Clean Prisma queries with authorId filter only
 * - Supports all article types: newspaper, web, shortNews
 * - Used exclusively for reporter UI
 */

/**
 * GET /reporter/articles
 * List reporter's own articles across all types
 */
export const listReporterArticles = async (req: Request, res: Response) => {
  try {
    const user: any = (req as any).user;
    const authorId = user?.id;

    if (!authorId) {
      return res.status(401).json({ error: 'Unauthorized - no user ID' });
    }

    // Query params
    const {
      type,  // newspaper, web, shortNews, all
      status,
      fromDate,
      toDate,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Date filters
    const dateFilter: any = {};
    if (fromDate) {
      dateFilter.gte = new Date(String(fromDate));
    }
    if (toDate) {
      const to = new Date(String(toDate));
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }

    const articleType = String(type || 'all').toLowerCase();

    const results: any = {
      newspaper: null,
      web: null,
      shortNews: null
    };

    // ========== NEWSPAPER ARTICLES ==========
    if (articleType === 'all' || articleType === 'newspaper') {
      const where: any = { authorId };
      if (status) where.status = String(status).toUpperCase();
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

      const [items, total] = await Promise.all([
        prisma.newspaperArticle.findMany({
          where,
          orderBy: { [String(sortBy)]: sortOrder === 'asc' ? 'asc' : 'desc' },
          skip: articleType === 'newspaper' ? skip : 0,
          take: articleType === 'newspaper' ? limitNum : 5,
          select: {
            id: true,
            title: true,
            heading: true,
            status: true,
            languageId: true,
            featuredImageUrl: true,
            createdAt: true,
            updatedAt: true,
            category: { select: { id: true, name: true } }
          }
        }),
        prisma.newspaperArticle.count({ where })
      ]);
      results.newspaper = { items, total, page: pageNum, limit: limitNum };
    }

    // ========== WEB ARTICLES ==========
    if (articleType === 'all' || articleType === 'web') {
      const where: any = { authorId };
      if (status) where.status = String(status).toUpperCase();
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

      const [items, total] = await Promise.all([
        prisma.tenantWebArticle.findMany({
          where,
          orderBy: { [String(sortBy)]: sortOrder === 'asc' ? 'asc' : 'desc' },
          skip: articleType === 'web' ? skip : 0,
          take: articleType === 'web' ? limitNum : 5,
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            languageId: true,
            coverImageUrl: true,
            createdAt: true,
            publishedAt: true,
            category: { select: { id: true, name: true } }
          }
        }),
        prisma.tenantWebArticle.count({ where })
      ]);
      results.web = { items, total, page: pageNum, limit: limitNum };
    }

    // ========== SHORT NEWS ==========
    if (articleType === 'all' || articleType === 'shortnews') {
      const where: any = { authorId };
      if (status) where.status = String(status).toUpperCase();
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

      const [items, total] = await Promise.all([
        prisma.shortNews.findMany({
          where,
          orderBy: { [String(sortBy)]: sortOrder === 'asc' ? 'asc' : 'desc' },
          skip: articleType === 'shortnews' ? skip : 0,
          take: articleType === 'shortnews' ? limitNum : 5,
          select: {
            id: true,
            title: true,
            summary: true,
            status: true,
            language: true,
            featuredImage: true,
            createdAt: true,
            publishDate: true,
            categoryId: true
          }
        }),
        prisma.shortNews.count({ where })
      ]);
      results.shortNews = { items, total, page: pageNum, limit: limitNum };
    }

    return res.json({
      success: true,
      authorId,
      type: articleType,
      filters: {
        status: status || null,
        fromDate: fromDate || null,
        toDate: toDate || null
      },
      data: results
    });

  } catch (e: any) {
    console.error('[ReporterArticles] List Error:', e);
    return res.status(500).json({ error: 'Failed to list articles', details: e.message });
  }
};

/**
 * GET /reporter/articles/:id
 * Get single article by ID (reporter can only view own articles)
 */
export const getReporterArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const user: any = (req as any).user;
    const authorId = user?.id;

    if (!authorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Article ID is required' });
    }

    const articleType = String(type || 'newspaper').toLowerCase();
    let article: any = null;

    if (articleType === 'newspaper') {
      article = await prisma.newspaperArticle.findFirst({
        where: { id, authorId },
        include: {
          category: { select: { id: true, name: true } },
          language: { select: { id: true, code: true, name: true } }
        }
      });
    } else if (articleType === 'web') {
      article = await prisma.tenantWebArticle.findFirst({
        where: { id, authorId },
        include: {
          domain: { select: { id: true, domain: true } },
          category: { select: { id: true, name: true } }
        }
      });
    } else if (articleType === 'shortnews') {
      article = await prisma.shortNews.findFirst({
        where: { id, authorId }
      });
    } else {
      return res.status(400).json({ error: 'Invalid type. Use: newspaper, web, or shortNews' });
    }

    if (!article) {
      return res.status(404).json({ error: 'Article not found or not owned by you' });
    }

    return res.json({
      success: true,
      type: articleType,
      data: article
    });

  } catch (e: any) {
    console.error('[ReporterArticles] Get Error:', e);
    return res.status(500).json({ error: 'Failed to get article', details: e.message });
  }
};

/**
 * GET /reporter/articles/stats
 * Get article counts by status for reporter dashboard
 */
export const getReporterArticleStats = async (req: Request, res: Response) => {
  try {
    const user: any = (req as any).user;
    const authorId = user?.id;

    if (!authorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Count articles by status for each type
    const [
      newspaperDraft,
      newspaperPending,
      newspaperPublished,
      newspaperRejected,
      webDraft,
      webPending,
      webPublished,
      webArchived,
      shortNewsPending,
      shortNewsApproved,
      shortNewsRejected
    ] = await Promise.all([
      prisma.newspaperArticle.count({ where: { authorId, status: 'DRAFT' } }),
      prisma.newspaperArticle.count({ where: { authorId, status: 'PENDING' } }),
      prisma.newspaperArticle.count({ where: { authorId, status: 'PUBLISHED' } }),
      prisma.newspaperArticle.count({ where: { authorId, status: 'REJECTED' } }),
      prisma.tenantWebArticle.count({ where: { authorId, status: 'DRAFT' } }),
      prisma.tenantWebArticle.count({ where: { authorId, status: 'PENDING' } }),
      prisma.tenantWebArticle.count({ where: { authorId, status: 'PUBLISHED' } }),
      prisma.tenantWebArticle.count({ where: { authorId, status: 'ARCHIVED' } }),
      prisma.shortNews.count({ where: { authorId, status: 'PENDING' } }),
      prisma.shortNews.count({ where: { authorId, status: { in: ['AI_APPROVED', 'DESK_APPROVED', 'APPROVED'] } } }),
      prisma.shortNews.count({ where: { authorId, status: 'REJECTED' } })
    ]);

    return res.json({
      success: true,
      authorId,
      stats: {
        newspaper: {
          draft: newspaperDraft,
          pending: newspaperPending,
          published: newspaperPublished,
          rejected: newspaperRejected,
          total: newspaperDraft + newspaperPending + newspaperPublished + newspaperRejected
        },
        web: {
          draft: webDraft,
          pending: webPending,
          published: webPublished,
          archived: webArchived,
          total: webDraft + webPending + webPublished + webArchived
        },
        shortNews: {
          pending: shortNewsPending,
          approved: shortNewsApproved,
          rejected: shortNewsRejected,
          total: shortNewsPending + shortNewsApproved + shortNewsRejected
        },
        totalArticles: (newspaperDraft + newspaperPending + newspaperPublished + newspaperRejected) +
                       (webDraft + webPending + webPublished + webArchived) +
                       (shortNewsPending + shortNewsApproved + shortNewsRejected)
      }
    });

  } catch (e: any) {
    console.error('[ReporterArticles] Stats Error:', e);
    return res.status(500).json({ error: 'Failed to get stats', details: e.message });
  }
};
