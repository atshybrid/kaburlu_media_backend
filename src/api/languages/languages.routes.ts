
import { Router } from 'express';
import { getLanguagesController, createLanguageController } from './languages.controller';
import passport from 'passport';

const router = Router();

/**
 * @swagger
 * /api/languages:
 *   get:
 *     summary: List languages
 *     tags: [Languages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Array of languages
 */
router.get('/', passport.authenticate('jwt', { session: false }), getLanguagesController);

/**
 * @swagger
 * /api/languages:
 *   post:
 *     summary: Create language
 *     tags: [Languages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *     responses:
 *       "201":
 *         description: Language created
 */
router.post('/', passport.authenticate('jwt', { session: false }), createLanguageController);

export default router;
