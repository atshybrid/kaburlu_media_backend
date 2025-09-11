import { Router } from 'express';
import { dislikeArticleController, removeDislikeController, getDislikesForArticleController } from './dislikes.controller';

const router = Router();

// Add a dislike
router.post('/', dislikeArticleController);
// Remove a dislike
router.delete('/', removeDislikeController);
// Get dislikes for an article
router.get('/:articleId', getDislikesForArticleController);

export default router;
