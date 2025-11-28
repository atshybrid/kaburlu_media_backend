import { Router } from 'express';
import { dislikeArticleController, removeDislikeController, getDislikesForArticleController } from './dislikes.controller';

const router = Router();
/**
 * @swagger
 * tags:
 *   - name: Dislikes (Deprecated)
 *     description: Legacy dislikes endpoints. Use unified Reactions API instead.
 */

/**
 * @swagger
 * /dislikes:
 *   post:
 *     deprecated: true
 *     summary: (Deprecated) Set a dislike on an article
 *     description: Replaced by PUT /reactions with reaction DISLIKE.
 *     tags: [Dislikes (Deprecated)]
 *     responses:
 *       410: { description: Gone - use /reactions }
 */
// DEPRECATED: Dislikes API replaced by unified /reactions
router.post('/', (_req, res) => {
	return res.status(410).json({ success: false, error: 'Deprecated. Use PUT /reactions with reaction "DISLIKE".' });
});
router.delete('/', (_req, res) => {
	return res.status(410).json({ success: false, error: 'Deprecated. Use PUT /reactions with reaction "NONE" to clear.' });
});
/**
 * @swagger
 * /dislikes/{articleId}:
 *   get:
 *     deprecated: true
 *     summary: (Deprecated) Get dislikes for article
 *     description: Use reactions aggregation endpoints (future) instead.
 *     tags: [Dislikes (Deprecated)]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       410: { description: Gone - use /reactions }
 */
router.get('/:articleId', (_req, res) => {
	return res.status(410).json({ success: false, error: 'Deprecated endpoint. Aggregate counts available via future reactions analytics.' });
});

export default router;
