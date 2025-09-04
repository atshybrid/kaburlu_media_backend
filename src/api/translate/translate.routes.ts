
import { Router } from 'express';
import { translateTextController } from './translate.controller';
import passport from 'passport';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * /api/translate:
 *   post:
 *     summary: Translate text using Gemini
 *     tags: [Translate]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Sports"
 *               targetLanguage:
 *                 type: string
 *                 example: "Telugu"
 *     responses:
 *       "200":
 *         description: Text translated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/', auth, translateTextController);

export default router;
