
import { Router } from 'express';
import { createUserController, getUsersController, getUser, updateUserController, deleteUserController } from './users.controller';
import passport from 'passport';

const router = Router();

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create user
 *     tags: [Users]
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
 *               roleId: { type: string }
 *               mobileNumber: { type: string }
 *               mpin: { type: string }
 *               email: { type: string, format: email }
 *             required:
 *               - name
 *               - roleId
 *               - mobileNumber
 *     responses:
 *       "201":
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/', passport.authenticate('jwt', { session: false }), createUserController);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *       - in: query
 *         name: languageId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 10 }
 *     responses:
 *       "200":
 *         description: List of users with pagination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginationResponse'
 */
router.get('/', passport.authenticate('jwt', { session: false }), getUsersController);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       "200":
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/:id', passport.authenticate('jwt', { session: false }), getUser);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string }
 *               languageId: { type: string }
 *               stateId: { type: string }
 *               status: { type: string, enum: [ACTIVE, BLOCKED] }
 *               isVerified: { type: boolean }
 *     responses:
 *       "200":
 *         description: User updated
 */
router.put('/:id', passport.authenticate('jwt', { session: false }), updateUserController);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Block user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       "204":
 *         description: User blocked
 */
router.delete('/:id', passport.authenticate('jwt', { session: false }), deleteUserController);

export default router;
