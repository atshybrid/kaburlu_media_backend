import { Router } from 'express';
import passport from 'passport';
import { listReporterArticles, getReporterArticle, getReporterArticleStats } from './reporter.controller';

const router = Router();

/**
 * @swagger
 * /reporter/articles:
 *   get:
 *     summary: List reporter's own articles
 *     description: |
 *       **REPORTER DASHBOARD API**
 *       
 *       Lists all articles created by the authenticated reporter.
 *       Filters strictly by authorId from JWT token - no tenantId logic.
 *       
 *       **Use Case:** Reporter UI dashboard to view their submitted articles.
 *       
 *       **Type Options:**
 *       - `all` - Returns summary of all 3 types (default)
 *       - `newspaper` - Only NewspaperArticle with pagination
 *       - `web` - Only TenantWebArticle with pagination
 *       - `shortNews` - Only ShortNews with pagination
 *     tags: [News Room]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [all, newspaper, web, shortNews] }
 *         description: Article type to fetch (default all)
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by status (DRAFT, PENDING, PUBLISHED, REJECTED, etc.)
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date }
 *         description: From date (YYYY-MM-DD)
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *         description: To date (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, default: createdAt }
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Reporter's articles list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 authorId: { type: string }
 *                 type: { type: string }
 *                 filters: { type: object }
 *                 data:
 *                   type: object
 *                   properties:
 *                     newspaper:
 *                       type: object
 *                       properties:
 *                         items: { type: array }
 *                         total: { type: integer }
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                     web:
 *                       type: object
 *                     shortNews:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/articles',
  passport.authenticate('jwt', { session: false }),
  listReporterArticles
);

/**
 * @swagger
 * /reporter/articles/stats:
 *   get:
 *     summary: Get article statistics for reporter dashboard
 *     description: |
 *       **REPORTER DASHBOARD STATS**
 *       
 *       Returns article counts by status for each article type.
 *       Useful for dashboard widgets showing pending, published, rejected counts.
 *     tags: [News Room]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Article statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 authorId: { type: string }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     newspaper:
 *                       type: object
 *                       properties:
 *                         draft: { type: integer }
 *                         pending: { type: integer }
 *                         published: { type: integer }
 *                         rejected: { type: integer }
 *                         total: { type: integer }
 *                     web:
 *                       type: object
 *                     shortNews:
 *                       type: object
 *                     totalArticles: { type: integer }
 */
router.get(
  '/articles/stats',
  passport.authenticate('jwt', { session: false }),
  getReporterArticleStats
);

/**
 * @swagger
 * /reporter/articles/{id}:
 *   get:
 *     summary: Get single article by ID (own articles only)
 *     description: |
 *       **GET REPORTER'S ARTICLE**
 *       
 *       Fetch a single article by ID. Reporter can only view their own articles.
 *       Use `type` query param to specify article type.
 *     tags: [News Room]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Article ID
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [newspaper, web, shortNews] }
 *         description: Article type (default newspaper)
 *     responses:
 *       200:
 *         description: Article details
 *       403:
 *         description: Not authorized (article belongs to another reporter)
 *       404:
 *         description: Article not found or not owned by you
 */
router.get(
  '/articles/:id',
  passport.authenticate('jwt', { session: false }),
  getReporterArticle
);

export default router;
