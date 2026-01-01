
import { Router } from 'express';
import { getStatesController, createStateController } from './states.controller';
import passport from 'passport';

const router = Router();

/**
 * @swagger
 * /states:
 *   get:
 *     summary: List states
 *     tags: [States]
 *     responses:
 *       "200":
 *         description: Array of states
 */
router.get('/', getStatesController);

/**
 * @swagger
 * /states:
 *   post:
 *     summary: Create state
 *     tags: [States]
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
 *     responses:
 *       "201":
 *         description: State created
 */
router.post('/', passport.authenticate('jwt', { session: false }), createStateController);

export default router;
