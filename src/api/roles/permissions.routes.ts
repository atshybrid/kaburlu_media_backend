
import { Router } from 'express';
import { assignPermissionToRole, getPermissionsForRole } from './permissions.controller';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * /roles/{id}/permissions:
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
 * /roles/{id}/permissions:
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

/**
 * @swagger
 * /permissions/modules:
 *   get:
 *     summary: List available permission modules
 *     description: Returns distinct module names found across role permissions, plus known system modules.
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of module names
 */
router.get('/modules', passport.authenticate('jwt', { session: false }), async (_req, res) => {
	try {
		const roles = await prisma.role.findMany({ select: { permissions: true } });
		const set = new Set<string>();
		for (const r of roles) {
			const perms = (r as any).permissions || {};
			if (perms && typeof perms === 'object') {
				for (const k of Object.keys(perms)) set.add(k);
			}
		}
		// Seed with common modules to help clients discoverability
		const known = ['articles','shortnews','tenants','domains','categories','districts','mandals','id-cards','assembly-constituencies'];
		for (const k of known) set.add(k);
		res.json(Array.from(set).sort());
	} catch (e) {
		console.error('list modules error', e);
		res.status(500).json({ error: 'Failed to list modules' });
	}
});

export default router;
