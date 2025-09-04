
import { Router } from 'express';
import passport from 'passport';
import {
  likeArticleController,
  unlikeArticleController,
  getLikesForArticleController,
} from './likes.controller';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * /api/likes/{articleId}:
 *   get:
 *     summary: Get all likes for an article
 *     tags: [Likes]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: A list of likes for the article
 */
router.get('/:articleId', getLikesForArticleController);

/**
 * @swagger
 * /api/likes:
 *   post:
 *     summary: Like an article
 *     tags: [Likes]
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
 *       "201":
 *         description: Article liked successfully
 */
router.post('/', auth, likeArticleController);

/**
 * @swagger
 * /api/likes:
 *   delete:
 *     summary: Unlike an article
 *     tags: [Likes]
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
 *       "204":
 *         description: Article unliked successfully
 */
router.delete('/', auth, unlikeArticleController);

export default router;
