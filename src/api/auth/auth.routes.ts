import { Router } from 'express';
import { logoutController, checkUserExistsController, loginController, refreshController, registerGuestController, upgradeGuestController } from './auth.controller';
import { validationMiddleware } from '../middlewares/validation.middleware';
import { GuestRegistrationDto } from './guest-registration.dto';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with mobile number and MPIN
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "9392010248"
 *               mpin:
 *                 type: string
 *                 example: "1947"
 *     responses:
 *       200:
 *         description: JWT + Refresh Token
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginController);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "refresh_token_abc"
 *     responses:
 *       200:
 *         description: New JWT + Refresh Token
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', refreshController);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', logoutController);

/**
 * @swagger
 * /api/v1/auth/upgrade-guest:
 *   post:
 *     summary: Upgrade guest user to citizen
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *                 example: "1234"
 *               mobileNumber:
 *                 type: string
 *                 example: "9392010248"
 *               mpin:
 *                 type: string
 *                 example: "1947"
 *               email:
 *                 type: string
 *                 example: "nani@gmail.com"
 *     responses:
 *       200:
 *         description: Upgraded user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     mobileNumber:
 *                       type: string
 *                     email:
 *                       type: string
 */
router.post('/upgrade-guest', upgradeGuestController);

/**
 * @swagger
 * /api/v1/auth/guest:
 *   post:
 *     summary: Register a guest user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GuestRegistrationDto'
 *     responses:
 *       200:
 *         description: JWT + Refresh Token
 */
router.post('/guest', validationMiddleware(GuestRegistrationDto), registerGuestController);

export default router;
