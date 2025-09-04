
import { Router } from 'express';
import passport from 'passport';
import {
  createCommentController,
  getCommentsByArticleController,
  updateCommentController,
  deleteCommentController,
} from './comments.controller';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

// Route to get all comments for a specific article (public)
router.get('/article/:articleId', getCommentsByArticleController);

// Route to create a new comment (protected)
router.post('/', auth, createCommentController);

// Routes for a specific comment by its ID (protected)
router.route('/:id')
  .put(auth, updateCommentController)
  .delete(auth, deleteCommentController);

export default router;
