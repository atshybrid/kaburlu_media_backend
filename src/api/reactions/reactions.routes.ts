import { Router } from 'express';
import passport from 'passport';
import { upsertReaction, getReactionForArticle, getReactionForShortNews, batchReactionStatus } from './reactions.controller';
import { requireRealUser } from '../middlewares/requireUser.middleware';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * tags:
 *   - name: Reactions
 *     description: Unified like/dislike reactions
 */

/**
 * @swagger
 * /reactions:
 *   put:
 *     summary: Set or clear a reaction (LIKE | DISLIKE | NONE) for Article or ShortNews
 *     tags: [Reactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reaction]
 *             properties:
 *               articleId: { type: string, description: "Provide exactly one: articleId or shortNewsId" }
 *               shortNewsId: { type: string }
 *               reaction: { type: string, enum: [LIKE, DISLIKE, NONE] }
 *           examples:
 *             articleLike:
 *               summary: Like an article
 *               value: { articleId: "article123", reaction: "LIKE" }
 *             shortNewsDislike:
 *               summary: Dislike a short news item
 *               value: { shortNewsId: "sn789", reaction: "DISLIKE" }
 *             clearShortNews:
 *               summary: Clear reaction
 *               value: { shortNewsId: "sn789", reaction: "NONE" }
 *     responses:
 *       200:
 *         description: Unified reaction state after update
 */
router.put('/', auth, requireRealUser, upsertReaction);

/**
 * @swagger
 * /reactions/status:
 *   post:
 *     summary: Batch reaction status + counts (Article or ShortNews)
 *     tags: [Reactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleIds:
 *                 type: array
 *                 items: { type: string }
 *               shortNewsIds:
 *                 type: array
 *                 items: { type: string }
 *             oneOf:
 *               - required: [articleIds]
 *               - required: [shortNewsIds]
 *           examples:
 *             articles:
 *               summary: Articles batch
 *               value: { articleIds: ["a1","a2"] }
 *             shortNews:
 *               summary: ShortNews batch
 *               value: { shortNewsIds: ["sn1","sn2"] }
 *     responses:
 *       200:
 *         description: Batch reaction status list
 */
router.post('/status', auth, requireRealUser, batchReactionStatus);

/**
 * @swagger
 * /reactions/article/{articleId}:
 *   get:
 *     summary: Get reaction + counts for a single article
 *     tags: [Reactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reaction info
 */
router.get('/article/:articleId', auth, requireRealUser, getReactionForArticle);

/**
 * @swagger
 * /reactions/shortnews/{shortNewsId}:
 *   get:
 *     summary: Get reaction + counts for a single short news item
 *     tags: [Reactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortNewsId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reaction info
 */
router.get('/shortnews/:shortNewsId', auth, requireRealUser, getReactionForShortNews);

export default router;
