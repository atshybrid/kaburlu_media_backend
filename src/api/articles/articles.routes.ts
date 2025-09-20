
import { Router } from 'express';
import passport from 'passport';
import { createArticleController } from './articles.controller';
import prisma from '../../lib/prisma';

const router = Router();

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
 */
