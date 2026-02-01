
import { Router } from 'express';
import * as userController from './users.controller';
import { addPushToken, removePushToken, updateLocation, getLocation } from './users.service';

const router = Router();

// Push Notification APIs
router.post('/:userId/push-token', async (req, res) => {
	const { deviceId, deviceModel, pushToken } = req.body;
	const { userId } = req.params;
	const result = await addPushToken(userId, deviceId, deviceModel, pushToken);
	res.json(result);
});

// Mounted at /users in app.ts; keep all paths relative under this router

router.get('/:userId/location', async (req, res) => {
	const { userId } = req.params;
	const result = await getLocation(userId);
	res.json(result);
});


/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roleId: { type: string }
 *               languageId: { type: string, description: "Mandatory language row id" }
 *               mobileNumber: { type: string, description: "Digits only" }
 *               mpin: { type: string, description: "If omitted, defaults to last 4 digits of mobile (hashed)" }
 *               email: { type: string }
 *             required: [languageId]
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: languageId missing or invalid, or cannot derive mpin from mobile
 */
router.post('/', userController.createUser);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users with enriched profile data
 *     description: |
 *       Returns all users. For REPORTER and TENANT_ADMIN roles, includes:
 *       - tenantId, tenant details
 *       - fullName, profilePhotoUrl
 *       - designation (id, name)
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users with profile enrichment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       mobileNumber: { type: string }
 *                       email: { type: string }
 *                       status: { type: string }
 *                       role: { type: object, properties: { id: { type: string }, name: { type: string } } }
 *                       tenantId: { type: string, description: "Only for REPORTER/TENANT_ADMIN" }
 *                       tenant: { type: object, properties: { id: { type: string }, name: { type: string }, slug: { type: string } } }
 *                       fullName: { type: string }
 *                       profilePhotoUrl: { type: string }
 *                       designation: { type: object, properties: { id: { type: string }, name: { type: string } } }
 */
router.get('/', userController.getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID with enriched profile data
 *     description: |
 *       Returns user details. For REPORTER and TENANT_ADMIN roles, includes:
 *       - tenantId, tenant details (id, name, slug)
 *       - fullName, profilePhotoUrl
 *       - designation (id, name)
 *       - reporterId
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details with profile enrichment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     mobileNumber: { type: string }
 *                     email: { type: string }
 *                     status: { type: string }
 *                     role: { type: object, properties: { id: { type: string }, name: { type: string } } }
 *                     language: { type: object }
 *                     tenantId: { type: string, description: "Only for REPORTER/TENANT_ADMIN" }
 *                     tenant: { type: object, properties: { id: { type: string }, name: { type: string }, slug: { type: string } } }
 *                     fullName: { type: string }
 *                     profilePhotoUrl: { type: string }
 *                     designation: { type: object, properties: { id: { type: string }, name: { type: string } } }
 *                     reporterId: { type: string, description: "Reporter ID if user is REPORTER/TENANT_ADMIN" }
 *       404:
 *         description: User not found
 */
router.get('/:id', userController.getUserById);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update an existing user
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roleId:
 *                 type: string
 *                 description: "When setting role to TENANT_ADMIN, also provide tenantId to link the user to that tenant"
 *               tenantId:
 *                 type: string
 *                 description: "Required when assigning TENANT_ADMIN role via roleId"
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               mobileNumber:
 *                 type: string
 *                 example: "8282"
 *               email:
 *                 type: string
 *                 example: "john.doe@example.com"
 *               mpin:
 *                 type: string
 *                 example: "1234"
 *               languageId:
 *                 type: string
 *                 example: "cmfdwhqk80009ugtof37yt8vv"
 *               location:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     example: 0
 *                   longitude:
 *                     type: number
 *                     example: 0
 *               deviceId:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: User updated
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 */
router.put('/:id', userController.updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 */
router.delete('/:id', userController.deleteUser);

// ...existing code...
export default router;
