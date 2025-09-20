
import { Router } from 'express';
import passport from 'passport';
import { ArticleReadController } from './articleRead.controller';
import { validationMiddleware } from '../middlewares/validation.middleware';

const router = Router();
const controller = new ArticleReadController();

// Swagger documentation removed: Article read tracking endpoints fully deprecated in favor of ShortNews read tracking.

/**
 * @swagger
 * /articles/read/simple/mark:
 *   post:
 *     summary: Minimal mark-as-read (no timing) for an article (alias convenience).
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
 *                 description: Article ID to mark as read
 *     responses:
 *       201:
 *         description: Marked as read
 */
router.post('/simple/mark', passport.authenticate('jwt', { session: false }), async (req, res) => {
	try {
		if (!req.user || typeof req.user !== 'object' || !('id' in req.user)) return res.status(401).json({ error: 'Unauthorized' });
		const { articleId } = req.body || {};
		if (!articleId) return res.status(400).json({ error: 'articleId required' });
		const controller = new ArticleReadController();
		// Reuse markAsRead logic (it upserts and returns 201 semantics)
		(req as any).body.articleId = articleId;
		return controller.markAsRead(req, res);
	} catch (e) {
		return res.status(500).json({ error: (e as Error).message });
	}
});

// Legacy simple endpoint (deprecated) - prefer /progress or /batch
router.post('/', passport.authenticate('jwt', { session: false }), validationMiddleware, (req, res) => controller.markAsRead(req, res));
// Legacy status (deprecated) - prefer /status/multi
router.get('/:articleId', passport.authenticate('jwt', { session: false }), validationMiddleware, (req, res) => controller.getReadStatus(req, res));

// New batched progress submission
// Replacement notice handlers
const gone = (_req: any, res: any) => res.status(410).json({
	success: false,
	error: 'Article read tracking endpoints are deprecated. Use /shortnews/read/progress for current tracking.'
});
router.post('/batch', passport.authenticate('jwt', { session: false }), gone);
router.post('/progress', passport.authenticate('jwt', { session: false }), gone);
router.get('/status/multi', passport.authenticate('jwt', { session: false }), gone);
router.get('/aggregate/article/:articleId', passport.authenticate('jwt', { session: false }), gone);
router.get('/aggregate/author/:authorId', passport.authenticate('jwt', { session: false }), gone);

export default router;
