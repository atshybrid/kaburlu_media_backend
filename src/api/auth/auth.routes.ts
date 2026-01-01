import { Router } from 'express';
import { logoutController, checkUserExistsController, loginController, refreshController, registerGuestController, upgradeGuestController, upsertDeviceController, loginWithGoogleController, createCitizenReporterByMobileController, upgradeCitizenReporterGoogleController } from './auth.controller';
import { validationMiddleware } from '../middlewares/validation.middleware';
import { GuestRegistrationDto } from './guest-registration.dto';

const router = Router();

/**
 * @swagger
 * /auth/login:
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
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: JWT + Refresh Token
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Operation successful
 *               data:
 *                 jwt: <token>
 *                 refreshToken: <refresh>
 *                 expiresIn: 86400
 *                 # Present for TENANT_ADMIN users
 *                 tenantId: <tenant_id>
 *                 domainId: <domain_id>
 *                 domainSettings:
 *                   id: <domain_settings_id>
 *                   data: {}
 *                   updatedAt: 2026-01-01T00:00:00.000Z
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginController);

/**
 * @swagger
 * /auth/refresh:
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Operation successful
 *               data:
 *                 jwt: <token>
 *                 expiresIn: 86400
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', refreshController);

/**
 * @swagger
 * /auth/logout:
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

// (removed) /auth/upgrade-guest route

/**
 * @swagger
 * /auth/guest:
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
 *         content:
 *           application/json:
 *             example:
 *               jwt: <token>
 *               refreshToken: <refresh>
 *               expiresIn: 86400
 */
router.post('/guest', validationMiddleware(GuestRegistrationDto), registerGuestController);

/**
 * @swagger
 * /auth/device:
 *   post:
 *     summary: Create or update a device record (no user creation)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId, deviceModel]
 *             properties:
 *               deviceId:
 *                 type: string
 *               deviceModel:
 *                 type: string
 *               pushToken:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               accuracyMeters:
 *                 type: number
 *               placeId:
 *                 type: string
 *               placeName:
 *                 type: string
 *               address:
 *                 type: string
 *               source:
 *                 type: string
 *     responses:
 *       200:
 *         description: Upserted device
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 device:
 *                   type: object
 *       400:
 *         description: Invalid request
 */
router.post('/device', upsertDeviceController);

/**
 * @swagger
 * /auth/login-google:
 *   post:
 *     summary: Login with Google (Firebase ID token)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               googleIdToken:
 *                 type: string
 *               deviceId:
 *                 type: string
 *                 description: Optional, will be linked to the user on login
 *     responses:
 *       200:
 *         description: JWT + Refresh Token
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Operation successful
 *               data:
 *                 jwt: <token>
 *                 refreshToken: <refresh>
 *                 expiresIn: 86400
 *                 user:
 *                   userId: u_123
 *                   role: CITIZEN_REPORTER
 *                   languageId: lang_1
 *                 # Present for TENANT_ADMIN users
 *                 tenantId: <tenant_id>
 *                 domainId: <domain_id>
 *                 domainSettings:
 *                   id: <domain_settings_id>
 *                   data: {}
 *                   updatedAt: 2026-01-01T00:00:00.000Z
 *                 location:
 *                   latitude: 17.385
 *                   longitude: 78.486
 *                   accuracyMeters: 12.5
 *       404:
 *         description: User not found for Google account (call upgrade API)
 */
router.post('/login-google', loginWithGoogleController);

/**
 * @swagger
 * /auth/create-citizen-reporter/mobile:
 *   post:
 *     summary: Create citizen reporter by mobile number
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobileNumber, mpin, fullName, languageId, location]
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "9392010248"
 *               mpin:
 *                 type: string
 *                 example: "1947"
 *                 description: 4-digit MPIN
 *               fullName:
 *                 type: string
 *                 example: "Ravi Kumar"
 *               deviceId:
 *                 type: string
 *                 example: "abcd-efgh-1234"
 *               pushToken:
 *                 type: string
 *                 example: "fcm_token_abc"
 *               languageId:
 *                 type: string
 *                 example: "lang_1"
 *               location:
 *                 type: object
 *                 required: [latitude, longitude]
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     example: 17.385
 *                   longitude:
 *                     type: number
 *                     example: 78.486
 *                   accuracyMeters:
 *                     type: number
 *                     example: 12.5
 *                   provider:
 *                     type: string
 *                     example: "fused"
 *                   timestampUtc:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-09-17T08:21:00.000Z"
 *                   placeId:
 *                     type: string
 *                     example: "ChIJL_P_CXMEDTkRw0ZdG-0GVvw"
 *                   placeName:
 *                     type: string
 *                     example: "Some Area"
 *                   address:
 *                     type: string
 *                     example: "Street, City"
 *                   source:
 *                     type: string
 *                     example: "foreground"
 *     responses:
 *       200:
 *         description: JWT + Refresh Token (login-style)
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Operation successful
 *               data:
 *                 jwt: <token>
 *                 refreshToken: <refresh>
 *                 expiresIn: 86400
 *                 user:
 *                   userId: u_123
 *                   role: CITIZEN_REPORTER
 *                   languageId: lang_1
 *                 location:
 *                   latitude: 17.385
 *                   longitude: 78.486
 *                   accuracyMeters: 12.5
 */
router.post('/create-citizen-reporter/mobile', createCitizenReporterByMobileController);

/**
 * @swagger
 * /auth/create-citizen-reporter/google:
 *   post:
 *     summary: Create citizen reporter by Google
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [googleIdToken, languageId, location]
 *             properties:
 *               googleIdToken:
 *                 type: string
 *               pushToken:
 *                 type: string
 *                 example: "fcm_token_abc"
 *               email:
 *                 type: string
 *                 example: "nani@gmail.com"
 *               languageId:
 *                 type: string
 *                 example: "lang_1"
 *               location:
 *                 type: object
 *                 required: [latitude, longitude]
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     example: 17.385
 *                   longitude:
 *                     type: number
 *                     example: 78.486
 *                   accuracyMeters:
 *                     type: number
 *                     example: 12.5
 *                   provider:
 *                     type: string
 *                     example: "fused"
 *                   timestampUtc:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-09-17T08:21:00.000Z"
 *                   placeId:
 *                     type: string
 *                     example: "ChIJL_P_CXMEDTkRw0ZdG-0GVvw"
 *                   placeName:
 *                     type: string
 *                     example: "Some Area"
 *                   address:
 *                     type: string
 *                     example: "Street, City"
 *                   source:
 *                     type: string
 *                     example: "foreground"
 *           example:
 *             googleIdToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
 *             languageId: "lang_1"
 *             pushToken: "fcm_token_abc"
 *             email: "nani@gmail.com"
 *             location:
 *               latitude: 17.385
 *               longitude: 78.486
 *               accuracyMeters: 12.5
 *               provider: "fused"
 *               timestampUtc: "2025-09-17T08:21:00.000Z"
 *               placeId: "ChIJL_P_CXMEDTkRw0ZdG-0GVvw"
 *               placeName: "Some Area"
 *               address: "Street, City"
 *               source: "foreground"
 *     responses:
 *       200:
 *         description: JWT + Refresh Token (login-style)
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Operation successful
 *               data:
 *                 jwt: <token>
 *                 refreshToken: <refresh>
 *                 expiresIn: 86400
 *                 user:
 *                   userId: u_456
 *                   role: CITIZEN_REPORTER
 *                   languageId: lang_1
 */
router.post('/create-citizen-reporter/google', upgradeCitizenReporterGoogleController);

export default router;
