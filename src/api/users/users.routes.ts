
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
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', userController.getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
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
 *         description: User details
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
