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
 *             examples:
 *               guestUser:
 *                 summary: Guest User (Device-based)
 *                 description: For users who haven't registered but are using the app
 *                 value:
 *                   deviceId: "device_123456"
 *                   location:
 *                     latitude: 17.3850
 *                     longitude: 78.4867
 *                     accuracyMeters: 10.5
 *                     placeName: "Hyderabad, Telangana, India"
 *                     address: "Jubilee Hills, Hyderabad, Telangana 500033"
 *                     source: "GPS"
 *                   languageId: "clm7k8j9x0001xyz123456789"
 *                   pushToken: "fcm_token_xyz789abc123def456"
 *                   deviceModel: "iPhone 14 Pro"
 *               registeredUser:
 *                 summary: Registered User (Account-based)
 *                 description: For users with registered accounts
 *                 value:
 *                   userId: "clm7k8j9x0002user987654321"
 *                   deviceId: "device_456789"
 *                   location:
 *                     latitude: 17.4400
 *                     longitude: 78.3489
 *                     placeName: "Gachibowli, Hyderabad"
 *                     address: "HITEC City, Gachibowli, Hyderabad, Telangana 500081"
 *                   languageId: "clm7k8j9x0003lang111222333"
 *                   pushToken: "fcm_token_abc123xyz789def"
 *               locationOnly:
 *                 summary: Update Location Only
 *                 description: Update only location coordinates
 *                 value:
 *                   deviceId: "device_123456"
 *                   location:
 *                     latitude: 17.3617
 *                     longitude: 78.4747
 *                     placeName: "Banjara Hills, Hyderabad"
 *               languageOnly:
 *                 summary: Update Language Only  
 *                 description: Change language preference (will update FCM topics)
 *                 value:
 *                   deviceId: "device_123456"
 *                   languageId: "clm7k8j9x0004lang444555666"
 *               pushTokenOnly:
 *                 summary: Update FCM Token Only
 *                 description: Update push notification token
 *                 value:
 *                   deviceId: "device_123456"
 *                   pushToken: "new_fcm_token_after_refresh_xyz123"
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
 *             examples:
 *               guestUserResponse:
 *                 summary: Guest User Update Response
 *                 value:
 *                   success: true
 *                   message: "Preferences updated successfully"
 *                   data:
 *                     user:
 *                       id: "clm7k8j9x0005user123456789"
 *                       languageId: "clm7k8j9x0001xyz123456789"
 *                       languageCode: "en"
 *                       languageName: "English"
 *                       role: "GUEST"
 *                       isGuest: true
 *                     device:
 *                       id: "clm7k8j9x0006dev987654321"
 *                       deviceId: "device_123456"
 *                       deviceModel: "iPhone 14 Pro"
 *                       hasPushToken: true
 *                       location:
 *                         latitude: 17.3850
 *                         longitude: 78.4867
 *                         accuracyMeters: 10.5
 *                         placeId: "ChIJLfyY2E4VzDsRVK0_IyBnwF4"
 *                         placeName: "Hyderabad, Telangana, India"
 *                         address: "Jubilee Hills, Hyderabad, Telangana 500033"
 *                         source: "GPS"
 *                     updates:
 *                       languageChanged: true
 *                       locationChanged: true
 *                       pushTokenChanged: true
 *                       deviceModelChanged: false
 *               registeredUserResponse:
 *                 summary: Registered User Update Response
 *                 value:
 *                   success: true
 *                   message: "Preferences updated successfully"
 *                   data:
 *                     user:
 *                       id: "clm7k8j9x0002user987654321"
 *                       languageId: "clm7k8j9x0003lang111222333"
 *                       languageCode: "te"
 *                       languageName: "Telugu"
 *                       role: "USER"
 *                       isGuest: false
 *                     device:
 *                       id: "clm7k8j9x0007dev111222333"
 *                       deviceId: "device_456789"
 *                       deviceModel: "Samsung Galaxy S24"
 *                       hasPushToken: true
 *                       location:
 *                         latitude: 17.4400
 *                         longitude: 78.3489
 *                         placeName: "Gachibowli, Hyderabad"
 *                         address: "HITEC City, Gachibowli, Hyderabad, Telangana 500081"
 *                         source: "GPS"
 *                     updates:
 *                       languageChanged: false
 *                       locationChanged: true
 *                       pushTokenChanged: false
 *                       deviceModelChanged: true
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
 *         examples:
 *           guestDevice:
 *             summary: Guest User Device ID
 *             value: "device_123456"
 *           existingDevice:
 *             summary: Existing Device ID
 *             value: "device_mobile_20250923_abc123"
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User identifier (required for registered users)
 *         examples:
 *           registeredUser:
 *             summary: Registered User ID
 *             value: "clm7k8j9x0002user987654321"
 *           existingUser:
 *             summary: Existing User ID  
 *             value: "user_john_doe_20250923_xyz789"
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
 *             examples:
 *               guestUserData:
 *                 summary: Guest User Preferences
 *                 value:
 *                   success: true
 *                   data:
 *                     user:
 *                       id: "clm7k8j9x0005user123456789"
 *                       languageId: "clm7k8j9x0001xyz123456789"
 *                       languageCode: "en"
 *                       languageName: "English"
 *                       role: "GUEST"
 *                       isGuest: true
 *                       status: "ACTIVE"
 *                     device:
 *                       id: "clm7k8j9x0006dev987654321"
 *                       deviceId: "device_123456"
 *                       deviceModel: "iPhone 14 Pro"
 *                       hasPushToken: true
 *                       location:
 *                         latitude: 17.3850
 *                         longitude: 78.4867
 *                         accuracyMeters: 10.5
 *                         placeName: "Hyderabad, Telangana, India"
 *                         address: "Jubilee Hills, Hyderabad, Telangana 500033"
 *                         source: "GPS"
 *                     userLocation: null
 *               registeredUserData:
 *                 summary: Registered User Preferences
 *                 value:
 *                   success: true
 *                   data:
 *                     user:
 *                       id: "clm7k8j9x0002user987654321"
 *                       languageId: "clm7k8j9x0003lang111222333"
 *                       languageCode: "te"
 *                       languageName: "Telugu"
 *                       role: "USER"
 *                       isGuest: false
 *                       status: "ACTIVE"
 *                     device:
 *                       id: "clm7k8j9x0007dev111222333"
 *                       deviceId: "device_456789"
 *                       deviceModel: "Samsung Galaxy S24"
 *                       hasPushToken: true
 *                       location:
 *                         latitude: 17.4400
 *                         longitude: 78.3489
 *                         placeName: "Gachibowli, Hyderabad"
 *                         address: "HITEC City, Gachibowli, Hyderabad, Telangana 500081"
 *                         source: "GPS"
 *                     userLocation:
 *                       latitude: 17.4400
 *                       longitude: 78.3489
 *                       accuracyMeters: 5.2
 *                       provider: "fused"
 *                       timestampUtc: "2025-09-23T10:30:00.000Z"
 *                       placeName: "Gachibowli, Hyderabad"
 *                       address: "HITEC City, Gachibowli, Hyderabad, Telangana 500081"
 *                       source: "GPS"
 *                       updatedAt: "2025-09-23T10:30:05.123Z"
 *       400:
 *         description: Bad request - missing required parameters
 *       404:
 *         description: User or device not found
 *       500:
 *         description: Internal server error
 */
router.get('/', getUserPreferencesController);

export default router;