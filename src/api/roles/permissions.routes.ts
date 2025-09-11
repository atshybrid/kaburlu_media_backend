
import { Router } from 'express';
import { assignPermissionToRole, getPermissionsForRole } from './permissions.controller';
import passport from 'passport';

const router = Router();

/**
 * @swagger
 * /api/v1/roles/{id}/permissions:
 *   post:
 *     summary: Assign permissions to a role
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               module:
 *                 type: string
 *                 example: "articles"
 *               actions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [create, read, update, delete, approve, reject]
 *     responses:
 *       "201":
 *         description: Permissions assigned
 */
router.post('/roles/:id/permissions', passport.authenticate('jwt', { session: false }), assignPermissionToRole);

/**
 * @swagger
 * /api/v1/roles/{id}/permissions:
 *   get:
 *     summary: Get permissions for a role
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       "200":
 *         description: Array of permissions
 */
router.get('/roles/:id/permissions', passport.authenticate('jwt', { session: false }), getPermissionsForRole);

export default router;
