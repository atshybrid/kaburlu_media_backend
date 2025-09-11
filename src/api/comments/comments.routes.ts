
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

/**
 * @swagger
 * /api/comments/article/{articleId}:
 *   get:
 *     summary: Get all comments for a specific article
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the article.
 *     responses:
 *       200:
 *         description: A list of comments for the article.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 */
router.get('/article/:articleId', getCommentsByArticleController);

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateComment'
 *     responses:
 *       201:
 *         description: Comment created successfully.
 */
router.post('/', auth, createCommentController);

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the comment to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateComment'
 *     responses:
 *       200:
 *         description: Comment updated successfully.
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the comment to delete.
 *     responses:
 *       200:
 *         description: Comment deleted successfully.
 */
router.route('/:id')
  .put(auth, updateCommentController)
  .delete(auth, deleteCommentController);

export default router;
