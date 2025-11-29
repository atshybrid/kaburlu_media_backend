
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
 *     summary: List available permission modules (concise)
 *     description: |
 *       Returns distinct module keys discovered from role permissions combined with known system modules.
 *       Each entry includes a human-friendly displayName and short description to clarify its scope.
 *     tags: [Role Permissions]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Array of module metadata objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   key: { type: string }
 *                   displayName: { type: string }
 *                   description: { type: string }
 *                   typicalActions:
 *                     type: array
 *                     items: { type: string }
 *             examples:
 *               sample:
 *                 value:
 *                   - key: "articles"
 *                     displayName: "Articles"
 *                     description: "Long-form news articles and metrics"
 *                     typicalActions: ["create","read","update","delete","approve","reject"]
 *                   - key: "tenants"
 *                     displayName: "Tenants"
 *                     description: "Tenant onboarding, entity & settings"
 *                     typicalActions: ["create","read","update"]
 */
router.get('/modules', passport.authenticate('jwt', { session: false }), async (_req, res) => {
	try {
		const roles = await prisma.role.findMany({ select: { permissions: true } });
		const discovered = new Set<string>();
		for (const r of roles) {
			const perms = (r as any).permissions || {};
			if (perms && typeof perms === 'object') {
				for (const k of Object.keys(perms)) discovered.add(k);
			}
		}
		const knownBase: Array<{ key: string; displayName: string; description: string; typicalActions: string[] }> = [
			{ key: 'articles', displayName: 'Articles', description: 'Long-form news articles and metrics', typicalActions: ['create','read','update','delete','approve','reject'] },
			{ key: 'shortnews', displayName: 'Short News', description: 'Concise news items', typicalActions: ['create','read','update','delete','approve','reject'] },
			{ key: 'tenants', displayName: 'Tenants', description: 'Tenant onboarding, entity & settings', typicalActions: ['create','read','update'] },
			{ key: 'domains', displayName: 'Domains', description: 'Tenant domain management & verification', typicalActions: ['create','read','update'] },
			{ key: 'categories', displayName: 'Categories', description: 'Content categories & hierarchy', typicalActions: ['create','read','update','delete'] },
			{ key: 'districts', displayName: 'Districts', description: 'Geographic districts', typicalActions: ['create','read','update','delete'] },
			{ key: 'mandals', displayName: 'Mandals', description: 'Sub-district regions', typicalActions: ['create','read','update','delete'] },
			{ key: 'assembly-constituencies', displayName: 'Assembly Constituencies', description: 'Electoral constituency data', typicalActions: ['create','read','update','delete'] },
			{ key: 'id-cards', displayName: 'ID Cards', description: 'Reporter ID card settings & generation', typicalActions: ['read','update'] },
			{ key: 'permissions', displayName: 'Permissions', description: 'Role permission assignment', typicalActions: ['read','update'] },
			{ key: 'roles', displayName: 'Roles', description: 'Role creation & management', typicalActions: ['create','read','update','delete'] }
		];
		const baseKeys = new Set(knownBase.map(m => m.key));
		const dynamic = Array.from(discovered).filter(k => !/^\d+$/.test(k) && !baseKeys.has(k));
		const dynamicMapped = dynamic.map(k => ({
			key: k,
			displayName: k.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
			description: 'Custom module (derived from role permissions)',
			typicalActions: ['create','read','update','delete']
		}));
		const merged = [...knownBase, ...dynamicMapped].sort((a,b) => a.key.localeCompare(b.key));
		res.json(merged);
	} catch (e) {
		console.error('list modules error', e);
		res.status(500).json({ error: 'Failed to list modules' });
	}
});

/**
 * @swagger
 * /permissions/modules/detailed:
 *   get:
 *     summary: List permission modules with metadata
 *     description: Returns structured module definitions (key, displayName, description, routePrefixes, sampleEndpoints, typicalActions).
 *     tags: [Role Permissions]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Detailed module metadata }
 */
router.get('/modules/detailed', passport.authenticate('jwt', { session: false }), async (_req, res) => {
	try {
		const roles = await prisma.role.findMany({ select: { permissions: true } });
		const dynamicKeys = new Set<string>();
		for (const r of roles) {
			const perms = (r as any).permissions || {};
			if (perms && typeof perms === 'object') {
				for (const k of Object.keys(perms)) dynamicKeys.add(k);
			}
		}
		const modules: any[] = [];
		const base = [
			{
				key: 'articles',
				displayName: 'Articles',
				description: 'Long-form news articles content and read metrics.',
				routePrefixes: ['/articles','/articles/read'],
				sampleEndpoints: [
					{ method: 'GET', path: '/api/v1/articles' },
					{ method: 'POST', path: '/api/v1/articles' },
					{ method: 'PATCH', path: '/api/v1/articles/{id}' }
				],
				typicalActions: ['create','read','update','delete','approve','reject']
			},
			{
				key: 'shortnews',
				displayName: 'Short News',
				description: 'Concise news items and read metrics.',
				routePrefixes: ['/shortnews','/shortnews/read'],
				sampleEndpoints: [
					{ method: 'GET', path: '/api/v1/shortnews' },
					{ method: 'POST', path: '/api/v1/shortnews' }
				],
				typicalActions: ['create','read','update','delete','approve','reject']
			},
			{
				key: 'tenants',
				displayName: 'Tenants',
				description: 'Tenant onboarding, domains, entity (PRGI) data, ID card settings.',
				routePrefixes: ['/tenants'],
				sampleEndpoints: [
					{ method: 'GET', path: '/api/v1/tenants' },
					{ method: 'PUT', path: '/api/v1/tenants/{tenantId}/id-card-settings' }
				],
				typicalActions: ['create','read','update']
			},
			{
				key: 'domains',
				displayName: 'Domains',
				description: 'Tenant domain management and verification.',
				routePrefixes: ['/tenants/{tenantId}/domains','/domains'],
				sampleEndpoints: [
					{ method: 'POST', path: '/api/v1/tenants/{tenantId}/domains' },
					{ method: 'POST', path: '/api/v1/domains/{id}/verify' }
				],
				typicalActions: ['create','read','update']
			},
			{
				key: 'categories',
				displayName: 'Categories',
				description: 'Content categories and hierarchy.',
				routePrefixes: ['/categories'],
				sampleEndpoints: [
					{ method: 'GET', path: '/api/v1/categories' },
					{ method: 'POST', path: '/api/v1/categories' }
				],
				typicalActions: ['create','read','update','delete']
			},
			{
				key: 'districts',
				displayName: 'Districts',
				description: 'Geographic districts (with soft delete & restore).',
				routePrefixes: ['/districts'],
				sampleEndpoints: [
					{ method: 'GET', path: '/api/v1/districts?page=1' },
					{ method: 'PATCH', path: '/api/v1/districts/{id}' }
				],
				typicalActions: ['create','read','update','delete']
			},
			{
				key: 'mandals',
				displayName: 'Mandals',
				description: 'Sub-district administrative regions.',
				routePrefixes: ['/mandals'],
				sampleEndpoints: [
					{ method: 'GET', path: '/api/v1/mandals?districtId={districtId}' },
					{ method: 'PATCH', path: '/api/v1/mandals/{id}' }
				],
				typicalActions: ['create','read','update','delete']
			},
			{
				key: 'assembly-constituencies',
				displayName: 'Assembly Constituencies',
				description: 'Electoral assembly constituency boundaries and metadata.',
				routePrefixes: ['/assembly-constituencies'],
				sampleEndpoints: [
					{ method: 'GET', path: '/api/v1/assembly-constituencies' },
					{ method: 'POST', path: '/api/v1/assembly-constituencies' }
				],
				typicalActions: ['create','read','update','delete']
			},
			{
				key: 'id-cards',
				displayName: 'ID Cards',
				description: 'Reporter ID card generation and settings.',
				routePrefixes: ['/tenants/{tenantId}/id-card-settings','/tenants/id-card-settings'],
				sampleEndpoints: [
					{ method: 'GET', path: '/api/v1/tenants/{tenantId}/id-card-settings' },
					{ method: 'PUT', path: '/api/v1/tenants/{tenantId}/id-card-settings' }
				],
				typicalActions: ['read','update']
			}
		];
		const dynamicOnly = Array.from(dynamicKeys).filter(k => !/^\d+$/.test(k) && !base.some(b => b.key === k));
		for (const k of dynamicOnly) {
			modules.push({
				key: k,
				displayName: k.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
				description: 'Custom module (derived from role permissions).',
				routePrefixes: [],
				sampleEndpoints: [],
				typicalActions: ['create','read','update','delete']
			});
		}
		res.json([...base, ...modules]);
	} catch (e) {
		console.error('modules detailed error', e);
		res.status(500).json({ error: 'Failed to produce detailed modules' });
	}
});

export default router;
