
import { Router } from 'express';
import passport from 'passport';
import { createArticleController } from './articles.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Articles
 *   description: API for managing news articles.
 */

/**
 * @swagger
 * /api/articles:
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
