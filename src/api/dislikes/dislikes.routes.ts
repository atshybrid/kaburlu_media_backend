import { Router } from 'express';
import { dislikeArticleController, removeDislikeController, getDislikesForArticleController } from './dislikes.controller';

const router = Router();

// DEPRECATED: Dislikes API replaced by unified /reactions
router.post('/', (_req, res) => {
	return res.status(410).json({ success: false, error: 'Deprecated. Use PUT /reactions with reaction "DISLIKE".' });
});
router.delete('/', (_req, res) => {
	return res.status(410).json({ success: false, error: 'Deprecated. Use PUT /reactions with reaction "NONE" to clear.' });
});
router.get('/:articleId', (_req, res) => {
	return res.status(410).json({ success: false, error: 'Deprecated endpoint. Aggregate counts available via future reactions analytics.' });
});

export default router;
