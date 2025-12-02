
import { Router } from 'express';
import passport from 'passport';
import { createArticleController, createTenantArticleController, createWebStoryController, updateArticleController, deleteArticleController } from './articles.controller';
import prisma from '../../lib/prisma';
import { requireReporterOrAdmin } from '../middlewares/authz';

const router = Router();

// Legacy short-news creation (citizen)
router.post('/', passport.authenticate('jwt', { session: false }), createArticleController);

// Tenant-scoped article creation (reporter/admin)
/**
 * @swagger
 * /articles/tenant:
 *   post:
 *     summary: Create an article scoped to a tenant
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId: { type: string }
 *               domainId: { type: string }
 *               title: { type: string }
 *               content: { type: string }
 *               categoryIds: { type: array, items: { type: string } }
 *               type: { type: string, example: 'reporter' }
 *               isPublished: { type: boolean }
 *           examples:
 *             sample:
 *               value:
 *                 tenantId: 'cmidgq4v80004ugv8dtqv4ijk'
 *                 title: 'Budget Highlights 2025'
 *                 content: 'Key points from the budget...'
 *                 categoryIds: ['cat123']
 *                 type: 'reporter'
 *                 isPublished: true
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/tenant', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, createTenantArticleController);

/**
 * @swagger
 * /articles/webstories:
 *   post:
 *     summary: Create a web story (scoped to tenant)
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId: { type: string }
 *               domainId: { type: string }
 *               title: { type: string }
 *               content: { type: string }
 *               images: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string } }
 *               isPublished: { type: boolean }
 *           examples:
 *             sample:
 *               value:
 *                 tenantId: 'cmidgq4v80004ugv8dtqv4ijk'
 *                 title: 'Festival Highlights'
 *                 content: 'Slide 1: ... Slide 2: ...'
 *                 images: ['https://cdn/img1.jpg']
 *                 categoryIds: ['cat123']
 *                 isPublished: true
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/webstories', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, createWebStoryController);

/**
 * @swagger
 * /articles/{id}:
 *   put:
 *     summary: Update an article
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               content: { type: string }
 *               categoryIds: { type: array, items: { type: string } }
 *               status: { type: string, enum: ['DRAFT','PUBLISHED','ARCHIVED'] }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/:id', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, updateArticleController);

/**
 * @swagger
 * /articles/{id}:
 *   delete:
 *     summary: Delete an article
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete('/:id', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, deleteArticleController);



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
