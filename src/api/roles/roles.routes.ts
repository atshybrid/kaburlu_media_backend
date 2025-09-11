
import { Router } from 'express';
import { getRolesController, createRoleController } from './roles.controller';
import passport from 'passport';

const router = Router();

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: List roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Array of roles
 */
router.get('/', passport.authenticate('jwt', { session: false }), getRolesController);

/**
 * @swagger
 * /api/roles:
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
router.post('/', passport.authenticate('jwt', { session: false }), createRoleController);

export default router;
