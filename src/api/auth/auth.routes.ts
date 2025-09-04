
import { Router } from 'express';
import { loginController, refreshController } from './auth.controller';

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

export default router;
