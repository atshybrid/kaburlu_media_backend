
import { Router } from 'express';
import passport from 'passport';
import { createArticleController } from './articles.controller';

const router = Router();

import { getPaginatedArticleController, getSingleArticleController } from './articles.controller';

/**
 * @swagger
 * tags:
 *   - name: Articles
 *     description: "APIs for fetching articles, including paginated and single article endpoints for swipeable UI."
 *   - name: Engagement - Comments
 *     description: "Comment and reply APIs."
 *   - name: Engagement - Likes
 *     description: "Like APIs."
 *   - name: Engagement - Dislikes
 *     description: "Dislike APIs."
 *   - name: Engagement - Reads
 *     description: "Read tracking APIs."
 */

/**
 * @swagger
 * /articles:
 *   get:
 *     summary: Get paginated articles (for swipe UI)
 *     tags: [Articles]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Number of articles to fetch (usually 1 for swipe)
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor for next article (article ID)
 *     responses:
 *       200:
 *         description: Paginated article(s) and next cursor
 *
 * /articles/{id}:
 *   get:
 *     summary: Get single article by ID
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Single article
 */

router.get('/', getPaginatedArticleController);
router.get('/:id', getSingleArticleController);

/**
 * @swagger
 * /articles:
 *   post:
 *     summary: Create a new article
 *     tags: [Articles]
 *     description: >
 *       Creates a new article and associates it with one or more categories. The author will be the currently authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateArticleDto'
 *     responses:
 *       201:
 *         description: Article created successfully.
 *       400:
 *         description: Bad request (e.g., validation error or non-existent category).
 *       401:
 *         description: Unauthorized.
 */
router.post('/', passport.authenticate('jwt', { session: false }), createArticleController);



/**
 * @swagger
 * components:
 *   schemas:
 *     CreateArticleDto:
 *       type: object
 *       required:
 *         - title
 *         - content
 *         - categoryIds
 *       properties:
	*         title:
	*           type: string
	*           example: 'The Future of AI in Journalism'
	*         content:
	*           type: string
	*           example: 'In this article, we explore the transformative impact of AI...'
	*         categoryIds:
	*           type: array
	*           items:
	*             type: string
	*           example: ["clq9zsm0d0000vcwz1z2z3z4z", "clq9zsm0e0001vcwzabcdefgh"]
	*         isPublished:
	*           type: boolean
	*           example: true
	*         isBreaking:
	*           type: boolean
	*           example: false
	*         isFeatured:
	*           type: boolean
	*           example: true
 */

export default router;
/**
 * @swagger
 * /comments/article/{articleId}:
 *   get:
 *     summary: Get all comments for an article
 *     tags: [Engagement, Engagement - Comments]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments
 *
 * /comments:
 *   post:
 *     summary: Add a comment to an article
 *     tags: [Engagement, Engagement - Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 *
 * /comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Engagement, Engagement - Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Comment updated
 *   delete:
 *     summary: Delete a comment
 *     tags: [Engagement, Engagement - Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 *
 * /likes/{articleId}:
 *   get:
 *     summary: Get all likes for an article
 *     tags: [Engagement, Engagement - Likes]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of likes
 *
 * /likes:
 *   post:
 *     summary: Like an article
 *     tags: [Engagement, Engagement - Likes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Article liked
 *   delete:
 *     summary: Unlike an article
 *     tags: [Engagement, Engagement - Likes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Article unliked
 *
 * /dislikes/{articleId}:
 *   get:
 *     summary: Get all dislikes for an article
 *     tags: [Engagement, Engagement - Dislikes]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of dislikes
 *
 * /dislikes:
 *   post:
 *     summary: Dislike an article
 *     tags: [Engagement, Engagement - Dislikes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Article disliked
 *   delete:
 *     summary: Remove dislike from an article
 *     tags: [Engagement, Engagement - Dislikes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dislike removed
 *
 * /articles/read:
 *   post:
 *     summary: Mark article as read
 *     tags: [Engagement, Engagement - Reads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Article marked as read
 *
 * /articles/read/{articleId}:
 *   get:
 *     summary: Get read status for an article
 *     tags: [Engagement, Engagement - Reads]
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
 *         description: Read status
 */
