
import { Router } from 'express';
import { getStatesController, createStateController } from './states.controller';
import passport from 'passport';

const router = Router();

/**
 * @swagger
 * /api/v1/states:
 *   get:
 *     summary: List states
 *     tags: [States]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Array of states
 */
router.get('/api/v1/states', passport.authenticate('jwt', { session: false }), getStatesController);

/**
 * @swagger
 * /api/v1/states:
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
router.post('/api/v1/states', passport.authenticate('jwt', { session: false }), createStateController);

export default router;
