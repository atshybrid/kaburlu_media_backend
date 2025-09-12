
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

router.post('/api/v1/users/:userId/push-token', async (req, res) => {
	const { userId } = req.params;
	const { deviceId, deviceModel, pushToken } = req.body;
	const result = await addPushToken(userId, deviceId, deviceModel, pushToken);
	res.json(result);
});

router.delete('/api/v1/users/:userId/push-token', async (req, res) => {
	const { userId } = req.params;
	const { pushToken } = req.body;
	const result = await removePushToken(userId, pushToken);
	res.json(result);
});

router.put('/api/v1/users/:userId/location', async (req, res) => {
	const { userId } = req.params;
	const { latitude, longitude } = req.body;
	const result = await updateLocation(userId, latitude, longitude);
	res.json(result);
});

router.get('/api/v1/users/:userId/location', async (req, res) => {
	const { userId } = req.params;
	const result = await getLocation(userId);
	res.json(result);
});

router.post('/api/v1/users', userController.createUser);
router.get('/api/v1/users', userController.getAllUsers);
router.get('/api/v1/users/:id', userController.getUserById);
router.put('/api/v1/users/:id', userController.updateUser);
router.delete('/api/v1/users/:id', userController.deleteUser);

router.get('/:userId/location', async (req, res) => {
	const { userId } = req.params;
	const result = await getLocation(userId);
	res.json(result);
});


/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/', userController.createUser);

/**
 * @swagger
 * /api/v1/users:
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
 * /api/v1/users/{id}:
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
 * /api/v1/users/{id}:
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
 *                 example: "9392010248"
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
 * /api/v1/users/{id}:
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
