
import { Router } from 'express';
import passport from 'passport';
import { ArticleReadController } from './articleRead.controller';
import { validationMiddleware } from '../middlewares/validation.middleware';

const router = Router();
const controller = new ArticleReadController();

/**
 * @swagger
 * tags:
 *   - name: Engagement - Read Tracking
 *     description: "Track article read progress, time-on-article, completion and aggregates."
 *
 * /articles/read (legacy):
 *   post:
 *     deprecated: true
 *     summary: (Deprecated) Mark article as read (basic) — use /articles/read/progress or /articles/read/batch.
 *     tags: [Engagement - Read Tracking]
 *
 * /articles/read/progress:
 *   post:
 *     summary: Submit a single progress update for one article.
 *     tags: [Engagement - Read Tracking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [articleId]
 *             properties:
 *               articleId:
 *                 type: string
 *               deltaTimeMs:
 *                 type: integer
 *                 description: Milliseconds of active read time since last report.
 *                 example: 3200
 *               maxScrollPercent:
 *                 type: number
 *                 format: float
 *                 example: 47.5
 *               ended:
 *                 type: boolean
 *                 description: True if a reading session ended (e.g., swipe away).
 *     responses:
 *       200:
 *         description: Updated metrics.
 *
 * /articles/read/batch:
 *   post:
 *     summary: Submit batched progress updates for multiple articles (preferred for performance).
 *     tags: [Engagement - Read Tracking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reads]
 *             properties:
 *               reads:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [articleId]
 *                   properties:
 *                     articleId:
 *                       type: string
 *                     deltaTimeMs:
 *                       type: integer
 *                       example: 2500
 *                     maxScrollPercent:
 *                       type: number
 *                       example: 60.2
 *                     ended:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Batch update result
 *
 * /articles/read/status/multi:
 *   get:
 *     summary: Get read status for multiple articles (current user).
 *     tags: [Engagement - Read Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ids
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma separated article IDs
 *     responses:
 *       200:
 *         description: Array of read statuses
 *
 * /articles/read/aggregate/article/{articleId}:
 *   get:
 *     summary: Aggregate read metrics for a single article.
 *     tags: [Engagement - Read Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Aggregated metrics
 *
 * /articles/read/aggregate/author/{authorId}:
 *   get:
 *     summary: Aggregate read metrics across all articles for an author.
 *     tags: [Engagement - Read Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: authorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Aggregated metrics
 */

// Legacy simple endpoint (deprecated) - prefer /progress or /batch
router.post('/', passport.authenticate('jwt', { session: false }), validationMiddleware, (req, res) => controller.markAsRead(req, res));
// Legacy status (deprecated) - prefer /status/multi
router.get('/:articleId', passport.authenticate('jwt', { session: false }), validationMiddleware, (req, res) => controller.getReadStatus(req, res));

// New batched progress submission
router.post('/batch', passport.authenticate('jwt', { session: false }), (req, res) => controller.recordBatchProgress(req, res));
// Single progress (wraps batch)
router.post('/progress', passport.authenticate('jwt', { session: false }), (req, res) => controller.recordSingleProgress(req, res));
// Multi status
router.get('/status/multi', passport.authenticate('jwt', { session: false }), (req, res) => controller.getMultiStatus(req, res));
// Aggregate by article
router.get('/aggregate/article/:articleId', passport.authenticate('jwt', { session: false }), (req, res) => controller.aggregateArticle(req, res));
// Aggregate by author
router.get('/aggregate/author/:authorId', passport.authenticate('jwt', { session: false }), (req, res) => controller.aggregateAuthor(req, res));

export default router;
