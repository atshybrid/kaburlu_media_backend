import { Router } from 'express';
import { updateUserPreferencesController, getUserPreferencesController } from './preferences.controller';
import { validationMiddleware } from '../middlewares/validation.middleware';
import { UpdatePreferencesDto } from './preferences.dto';

const router = Router();

/**
 * @swagger
 * /preferences/update:
 *   post:
 *     tags:
 *       - Preferences
 *     summary: Update user preferences (location, language, FCM token)
 *     description: Updates user preferences for both guest users (via deviceId) and registered users (via userId). Supports location updates, language changes, and FCM push token management.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device identifier (required for guest users)
 *                 example: "device_123456"
 *               userId:
 *                 type: string
 *                 description: User identifier (required for registered users)
 *                 example: "user_789012"
 *               location:
 *                 type: object
 *                 description: Location update data
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     description: Latitude coordinate
 *                     example: 17.3850
 *                   longitude:
 *                     type: number
 *                     description: Longitude coordinate
 *                     example: 78.4867
 *                   accuracyMeters:
 *                     type: number
 *                     description: Location accuracy in meters
 *                     example: 10.5
 *                   placeId:
 *                     type: string
 *                     description: Google Places ID
 *                     example: "ChIJLfyY2E4VzDsRVK0_IyBnwF4"
 *                   placeName:
 *                     type: string
 *                     description: Human-readable place name
 *                     example: "Hyderabad, Telangana, India"
 *                   address:
 *                     type: string
 *                     description: Full address
 *                     example: "123 Street Name, Hyderabad, Telangana 500001"
 *                   source:
 *                     type: string
 *                     description: Location source
 *                     example: "GPS"
 *               languageId:
 *                 type: string
 *                 description: Language preference ID
 *                 example: "lang_english_001"
 *               pushToken:
 *                 type: string
 *                 description: FCM push notification token
 *                 example: "fcm_token_xyz789"
 *               deviceModel:
 *                 type: string
 *                 description: Device model information
 *                 example: "iPhone 14 Pro"
 *               forceUpdate:
 *                 type: boolean
 *                 description: Force update even if values are the same
 *                 default: false
 *             oneOf:
 *               - required: [deviceId]
 *               - required: [userId]
 *             example:
 *               deviceId: "device_123456"
 *               location:
 *                 latitude: 17.3850
 *                 longitude: 78.4867
 *                 accuracyMeters: 10.5
 *                 placeName: "Hyderabad, Telangana, India"
 *               languageId: "lang_english_001"
 *               pushToken: "fcm_token_xyz789"
 *               deviceModel: "iPhone 14 Pro"
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Preferences updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         languageId:
 *                           type: string
 *                         languageCode:
 *                           type: string
 *                         languageName:
 *                           type: string
 *                         role:
 *                           type: string
 *                         isGuest:
 *                           type: boolean
 *                     device:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         deviceId:
 *                           type: string
 *                         deviceModel:
 *                           type: string
 *                         hasPushToken:
 *                           type: boolean
 *                         location:
 *                           type: object
 *                           nullable: true
 *                     updates:
 *                       type: object
 *                       properties:
 *                         languageChanged:
 *                           type: boolean
 *                         locationChanged:
 *                           type: boolean
 *                         pushTokenChanged:
 *                           type: boolean
 *                         deviceModelChanged:
 *                           type: boolean
 *       400:
 *         description: Bad request - missing required parameters or invalid data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Either deviceId or userId is required"
 *                 code:
 *                   type: string
 *                   example: "MISSING_IDENTIFIER"
 *       404:
 *         description: User or device not found
 *       500:
 *         description: Internal server error
 */
router.post('/update', validationMiddleware(UpdatePreferencesDto), updateUserPreferencesController);

/**
 * @swagger
 * /preferences:
 *   get:
 *     tags:
 *       - Preferences
 *     summary: Get user preferences
 *     description: Retrieves current user preferences including location, language, and device information for both guest and registered users.
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: string
 *         description: Device identifier (required for guest users)
 *         example: "device_123456"
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User identifier (required for registered users)
 *         example: "user_789012"
 *     responses:
 *       200:
 *         description: Preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         languageId:
 *                           type: string
 *                         languageCode:
 *                           type: string
 *                         languageName:
 *                           type: string
 *                         role:
 *                           type: string
 *                         isGuest:
 *                           type: boolean
 *                         status:
 *                           type: string
 *                     device:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         deviceId:
 *                           type: string
 *                         deviceModel:
 *                           type: string
 *                         hasPushToken:
 *                           type: boolean
 *                         location:
 *                           type: object
 *                           nullable: true
 *                     userLocation:
 *                       type: object
 *                       nullable: true
 *                       description: Location data for registered users (stored separately)
 *       400:
 *         description: Bad request - missing required parameters
 *       404:
 *         description: User or device not found
 *       500:
 *         description: Internal server error
 */
router.get('/', getUserPreferencesController);

export default router;