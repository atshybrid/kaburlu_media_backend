
import { Router } from 'express';
import passport from 'passport';
import { createCommentController, getCommentsController, updateCommentController, deleteCommentController } from './comments.controller';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * /comments:
 *   get:
 *     summary: Get comments for an Article or ShortNews (nested replies included)
 *     tags: [Engagement - Comments]
 *     parameters:
 *       - in: query
 *         name: articleId
 *         schema:
 *           type: string
 *         description: Article ID (mutually exclusive with shortNewsId)
 *       - in: query
 *         name: shortNewsId
 *         schema:
 *           type: string
 *         description: ShortNews ID (mutually exclusive with articleId)
 *     responses:
 *       200:
 *         description: Top-level comments with nested replies.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 */
router.get('/', getCommentsController);

/**
 * @swagger
 * /comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Engagement - Comments]
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
 * /comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Engagement - Comments]
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
 *     tags: [Engagement - Comments]
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
