
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
 *               languageCode: { type: string, example: 'te' }
 *               title: { type: string }
 *               content: { type: string }
 *               images: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string } }
 *               type: { type: string, example: 'reporter' }
 *               isPublished: { type: boolean }
 *               h1: { type: string }
 *               h2: { type: string }
 *               h3: { type: array, items: { type: string } }
 *               contentHtml: { type: string }
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     heading: { type: string }
 *                     level: { type: integer, enum: [1,2,3] }
 *                     paragraphs: { type: array, items: { type: string } }
 *                     imageUrl: { type: string }
 *           example:
 *             tenantId: 'cmidgq4v80004ugv8dtqv4ijk'
 *             languageCode: 'te'
 *             title: 'Budget Highlights 2025'
 *             content: 'Key points from the budget...'
 *             images: ['https://cdn/img1.jpg']
 *             categoryIds: ['cat123']
 *             type: 'reporter'
 *             isPublished: true
 *             h1: 'Budget Highlights 2025'
 *             h2: 'Key takeaways for taxpayers'
 *             h3: ['Direct taxes', 'Infra spend']
 *             sections:
 *               - heading: 'Direct Tax Reforms'
 *                 level: 2
 *                 paragraphs: ['Slab changes...', 'Rebate updates...']
 *               - heading: 'Infrastructure'
 *                 level: 2
 *                 paragraphs: ['Highways...', 'Rail...']
 *             contentHtml: '<h1>Budget Highlights 2025</h1><p>Key points...</p>'
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
 *               languageCode: { type: string, example: 'en' }
 *               title: { type: string }
 *               content: { type: string }
 *               images: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string } }
 *               isPublished: { type: boolean }
 *               h1: { type: string }
 *               h2: { type: string }
 *               h3: { type: array, items: { type: string } }
 *               contentHtml: { type: string }
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     heading: { type: string }
 *                     level: { type: integer, enum: [1,2,3] }
 *                     paragraphs: { type: array, items: { type: string } }
 *                     imageUrl: { type: string }
 *           example:
 *             tenantId: 'cmidgq4v80004ugv8dtqv4ijk'
 *             languageCode: 'en'
 *             title: 'Festival Highlights'
 *             content: 'Slide 1: ... Slide 2: ...'
 *             images: ['https://cdn/img1.jpg']
 *             categoryIds: ['cat123']
 *             isPublished: true
 *             h1: 'Festival Highlights Full Story'
 *             h2: 'Top moments'
 *             h3: ['Opening parade', 'Food stalls']
 *             contentHtml: '<h1>Festival Highlights</h1><p>Slide 1...</p>'
 *             sections:
 *               - heading: 'Opening Parade'
 *                 level: 2
 *                 paragraphs: ['Colorful floats', 'Local troupes performance']
 *                 imageUrl: 'https://cdn/img1.jpg'
 *               - heading: 'Food Stalls'
 *                 level: 2
 *                 paragraphs: ['Street foods', 'Traditional sweets']
 *                 imageUrl: 'https://cdn/img2.jpg'
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
