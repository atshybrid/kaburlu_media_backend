
import { Router } from 'express';
import { loginController, refreshController, registerGuestController } from './auth.controller';
import { validationMiddleware } from '../middlewares/validation.middleware';
import { GuestRegistrationDto } from './guest-registration.dto';

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with mobile number and MPIN
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mobileNumber:
 *                 type: string
 *               mpin:
 *                 type: string
 *     responses:
 *       "200":
 *         description: JWT + User info
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         jwt:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         user:
 *                           type: object
 *                           properties:
 *                             userId:
 *                               type: string
 *                             role:
 *                               type: string
 *                             languageId:
 *                               type: string
 */
router.post('/login', loginController);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       "200":
 *         description: New JWT
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         jwt:
 *                           type: string
 */
router.post('/refresh', refreshController);

/**
 * @swagger
 * /api/auth/guest:
 *   post:
 *     summary: Register a guest user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GuestRegistrationDto'
 *     responses:
 *       "200":
 *         description: JWT + Refresh Token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jwt:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 */
router.post('/guest', validationMiddleware(GuestRegistrationDto), registerGuestController);

export default router;
