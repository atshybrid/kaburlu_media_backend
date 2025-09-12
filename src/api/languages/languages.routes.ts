
import { Router } from 'express';
import { getLanguagesController, createLanguageController } from './languages.controller';
import passport from 'passport';

const router = Router();

/**
 * @swagger
 * /api/v1/languages:
 *   get:
 *     summary: List languages
 *     tags: [Languages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Array of languages
 */
router.get('/api/v1/languages', getLanguagesController);

/**
 * @swagger
 * /api/v1/languages:
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
router.post('/api/v1/languages', passport.authenticate('jwt', { session: false }), createLanguageController);

export default router;
