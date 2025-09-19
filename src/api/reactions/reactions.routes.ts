import { Router } from 'express';
import passport from 'passport';
import { upsertReaction, getReactionForArticle, batchReactionStatus } from './reactions.controller';

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
 *     summary: Set or clear a reaction (LIKE | DISLIKE | NONE)
 *     tags: [Reactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [articleId, reaction]
 *             properties:
 *               articleId: { type: string }
 *               reaction: { type: string, enum: [LIKE, DISLIKE, NONE] }
 *             example:
 *               articleId: "abc123"
 *               reaction: "LIKE"
 *     responses:
 *       200:
 *         description: Reaction state after update
 */
router.put('/', auth, upsertReaction);

/**
 * @swagger
 * /reactions/status:
 *   post:
 *     summary: Batch reaction status + counts for many articles
 *     tags: [Reactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [articleIds]
 *             properties:
 *               articleIds:
 *                 type: array
 *                 items: { type: string }
 *             example:
 *               articleIds: ["a1","a2","a3"]
 *     responses:
 *       200:
 *         description: Batch reaction status
 */
router.post('/status', auth, batchReactionStatus);

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
router.get('/article/:articleId', auth, getReactionForArticle);

export default router;
