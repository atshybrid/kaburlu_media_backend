
import { Router } from 'express';
import { getRolesController, createRoleController } from './roles.controller';
import { assignPermissionToRole, getPermissionsForRole } from '../../controllers/role.controller';
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
 * /roles:
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

/**
 * @swagger
 * /roles/{id}/permissions:
 *   post:
 *     summary: Assign permissions to a role (alias)
 *     tags: [Role Permissions]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               module: { type: string }
 *               actions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [create, read, update, delete, approve, reject]
 *     responses:
 *       200:
 *         description: Permissions assigned
 *         content:
 *           application/json:
 *             examples:
 *               assigned:
 *                 summary: Assigned actions to module
 *                 value:
 *                   roleId: "cmidgq4v80004ugv8dtqv4ijk"
 *                   module: "articles"
 *                   actions: ["create"]
 *                   permissions:
 *                     articles: ["create"]
 */
router.post('/:id/permissions', passport.authenticate('jwt', { session: false }), assignPermissionToRole);

/**
 * @swagger
 * /roles/{id}/permissions:
 *   get:
 *     summary: Get permissions for a role (alias)
 *     tags: [Role Permissions]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       200:
 *         description: Permissions map (module -> actions)
 *         content:
 *           application/json:
 *             examples:
 *               map:
 *                 value:
 *                   articles: ["create"]
 *                   tenants: ["read","update"]
 */
router.get('/:id/permissions', passport.authenticate('jwt', { session: false }), getPermissionsForRole);

export default router;
