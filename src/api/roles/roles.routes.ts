
import { Router } from 'express';
import { getRolesController, createRoleController } from './roles.controller';
import passport from 'passport';

const router = Router();

/**
 * @swagger
 * /api/v1/roles:
 *   get:
 *     summary: List roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Array of roles
 */
router.get('/api/v1/roles', passport.authenticate('jwt', { session: false }), getRolesController);

/**
 * @swagger
 * /api/v1/roles:
 *   post:
 *     summary: Create role
 *     tags: [Roles]
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
 *               permissions: { type: array, items: { type: string } }
 *     responses:
 *       "201":
 *         description: Role created
 */
router.post('/api/v1/roles', passport.authenticate('jwt', { session: false }), createRoleController);

export default router;
