
import { Router } from 'express';
import passport from 'passport';
import { createCommentController, getCommentsController, updateCommentController, deleteCommentController } from './comments.controller';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "clxxx123"
 *         content:
 *           type: string
 *           example: "Great article!"
 *         articleId:
 *           type: string
 *           nullable: true
 *         shortNewsId:
 *           type: string
 *           nullable: true
 *         parentId:
 *           type: string
 *           nullable: true
 *           description: Parent comment ID for nested replies
 *         userId:
 *           type: string
 *         user:
 *           type: object
 *           properties:
 *             id: { type: string }
 *             displayName: { type: string }
 *             photoUrl: { type: string, nullable: true }
 *         replies:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Comment'
 *         createdAt:
 *           type: string
 *           format: date-time
 *     CreateComment:
 *       type: object
 *       required: [content, userId]
 *       properties:
 *         content:
 *           type: string
 *           example: "Great article!"
 *         articleId:
 *           type: string
 *           description: Provide exactly one of articleId or shortNewsId
 *           example: "clxxx123"
 *         shortNewsId:
 *           type: string
 *           description: Provide exactly one of articleId or shortNewsId
 *         parentId:
 *           type: string
 *           description: Optional - ID of parent comment for nested reply
 *     UpdateComment:
 *       type: object
 *       properties:
 *         content:
 *           type: string
 *           example: "Updated comment text"
 *     ReactionData:
 *       type: object
 *       properties:
 *         reaction:
 *           type: string
 *           enum: [LIKE, DISLIKE, NONE]
 *           nullable: true
 *           description: The current user's reaction
 *         likeCount:
 *           type: integer
 *           example: 42
 *         dislikeCount:
 *           type: integer
 *           example: 3
 *         articleId:
 *           type: string
 *           nullable: true
 *         shortNewsId:
 *           type: string
 *           nullable: true
 */


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
