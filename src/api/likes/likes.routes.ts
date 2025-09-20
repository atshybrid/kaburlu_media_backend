
import { Router } from 'express';
import passport from 'passport';

// Original like handlers imported (kept in case of internal fallback) but not used now.
import {
  likeArticleController,
  unlikeArticleController,
  getLikesForArticleController,
} from './likes.controller';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

// DEPRECATED: Likes API replaced by unified /reactions (PUT /reactions with {articleId, reaction})
// Hidden from swagger by removing annotation. Returns HTTP 410 Gone.
router.get('/:articleId', (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'The /likes API is deprecated. Use PUT /reactions with { articleId, reaction: "LIKE" | "DISLIKE" | "NONE" }.'
  });
});

router.post('/', auth, (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Deprecated. Use PUT /reactions with { articleId, reaction: "LIKE" }.'
  });
});

router.delete('/', auth, (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Deprecated. Use PUT /reactions with { articleId, reaction: "NONE" } to clear.'
  });
});

export default router;
