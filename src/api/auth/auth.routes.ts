import { Router } from 'express';
import { logoutController, checkUserExistsController, loginController, refreshController, registerGuestController, upgradeGuestController, upsertDeviceController, loginWithGoogleController, createCitizenReporterByMobileController, upgradeCitizenReporterGoogleController, verifyMpinForPaymentController, changeMpinController, sessionHeartbeatController, endSessionController } from './auth.controller';
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
 *                 user:
 *                   userId: u_123
 *                   role: REPORTER
 *                   languageId: lang_1
 *                 # Present for TENANT_ADMIN and REPORTER users
 *                 # Tenant admins also have a linked Reporter row; reporterId is useful for ID card operations
 *                 reporterId: <reporter_id>
 *                 tenantId: <tenant_id>
 *                 tenant:
 *                   id: <tenant_id>
 *                   name: <tenant_name>
 *                   slug: <tenant_slug>
 *                   prgiStatus: PENDING
 *                 tenantEntity:
 *                   id: <tenant_entity_id>
 *                   prgiNumber: <prgi_number>
 *                   registrationTitle: <registration_title>
 *                 domainId: <domain_id>
 *                 domain:
 *                   id: <domain_id>
 *                   domain: example.com
 *                   isPrimary: true
 *                   status: APPROVED
 *                   kind: NEWS
 *                   verifiedAt: 2026-01-01T00:00:00.000Z
 *                 domainSettings:
 *                   id: <domain_settings_id>
 *                   data: {}
 *                   updatedAt: 2026-01-01T00:00:00.000Z
 *                 # Reporter-only context
 *                 reporter:
 *                   id: <reporter_id>
 *                   tenantId: <tenant_id>
 *                   level: MANDAL
 *                   subscriptionActive: true
 *                   monthlySubscriptionAmount: 19900
 *                   kycStatus: APPROVED
 *                   kycData: { autoPublish: true }
 *                   autoPublish: true
 *                 reporterPaymentSummary:
 *                   subscriptionActive: true
 *                   monthlySubscriptionAmount: 19900
 *                   currentMonth: { year: 2026, month: 1 }
 *                   currentMonthlyPayment: { id: <payment_id>, status: PAID }
 *                 autoPublish: true
 *       402:
 *         description: Reporter payment required before login
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: PAYMENT_REQUIRED
 *               message: Reporter payments required before login
 *               data:
 *                 reporter: { id: <reporter_id>, tenantId: <tenant_id> }
 *                 outstanding:
 *                   - type: MONTHLY_SUBSCRIPTION
 *                     amount: 19900
 *                     currency: INR
 *                     year: 2026
 *                     month: 1
 *                     status: MISSING
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

/**
 * @swagger
 * /auth/session/heartbeat:
 *   post:
 *     summary: Update session activity (heartbeat) for tracking working hours
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: "clxyz123abc"
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Missing sessionId
 */
router.post('/session/heartbeat', sessionHeartbeatController);

/**
 * @swagger
 * /auth/session/end:
 *   post:
 *     summary: End a session manually (e.g., app background, timeout)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: "clxyz123abc"
 *     responses:
 *       200:
 *         description: Session ended
 *         content:
 *           application/json:
 *             example:
 *               ok: true
 *               closed: true
 *               durationMinutes: 125
 *       400:
 *         description: Missing sessionId
 */
router.post('/session/end', endSessionController);

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

/**
 * @swagger
 * /auth/verify-mpin:
 *   post:
 *     summary: Verify MPIN for payment flow
 *     description: |
 *       Verifies MPIN without full login. Returns reporter info and payment status.
 *       Use this before showing payment screen to verify user identity.
 *       
 *       **Response codes:**
 *       - 200: MPIN valid, no payment required - can proceed with normal login
 *       - 401: Invalid MPIN
 *       - 402: MPIN valid but payment required - show payment screen with returned data
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobileNumber
 *               - mpin
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "9392010248"
 *               mpin:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: MPIN verified, no payment required
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               verified: true
 *               message: MPIN verified, no payment required
 *               data:
 *                 isReporter: true
 *                 reporter:
 *                   id: rep_123
 *                   tenantId: tenant_456
 *                   name: John Doe
 *                   mobileNumber: "9392010248"
 *                 tenant:
 *                   id: tenant_456
 *                   name: Kaburlu Today
 *                   logoUrl: https://...
 *                 paymentRequired: false
 *       401:
 *         description: Invalid MPIN
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               verified: false
 *               message: Invalid MPIN
 *       402:
 *         description: MPIN valid but payment required
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               verified: true
 *               code: PAYMENT_REQUIRED
 *               message: Payment required before login
 *               data:
 *                 reporter:
 *                   id: rep_123
 *                   tenantId: tenant_456
 *                   name: John Doe
 *                   mobileNumber: "9392010248"
 *                 tenant:
 *                   id: tenant_456
 *                   name: Kaburlu Today
 *                   slug: kaburlu-today
 *                   nativeName: కబుర్లు టుడే
 *                   logoUrl: https://...
 *                   primaryColor: "#FF5733"
 *                 outstanding:
 *                   - type: ONBOARDING
 *                     amount: 500
 *                     currency: INR
 *                     status: MISSING
 *                 breakdown:
 *                   idCardCharge:
 *                     label: ID Card / Onboarding Fee
 *                     amount: 500
 *                     displayAmount: ₹500.00
 *                   total:
 *                     label: Total Amount
 *                     amount: 500
 *                     amountPaise: 50000
 *                     displayAmount: ₹500.00
 *                 razorpay:
 *                   keyId: rzp_test_xxx
 *                   amount: 50000
 *                   amountRupees: 500
 *                   currency: INR
 */
router.post('/verify-mpin', verifyMpinForPaymentController);

/**
 * @swagger
 * /auth/change-mpin:
 *   post:
 *     summary: Change MPIN using old MPIN
 *     description: |
 *       Change user's MPIN by providing current (old) MPIN and new MPIN.
 *       New MPIN must be 4-6 digits and different from old MPIN.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobileNumber
 *               - oldMpin
 *               - newMpin
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "9392010248"
 *               oldMpin:
 *                 type: string
 *                 example: "1234"
 *               newMpin:
 *                 type: string
 *                 example: "5678"
 *     responses:
 *       200:
 *         description: MPIN changed successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: MPIN changed successfully
 *       400:
 *         description: Validation error or old MPIN incorrect
 *         content:
 *           application/json:
 *             examples:
 *               oldMpinIncorrect:
 *                 summary: Old MPIN is incorrect
 *                 value:
 *                   success: false
 *                   message: Old MPIN is incorrect
 *               invalidFormat:
 *                 summary: Invalid new MPIN format
 *                 value:
 *                   success: false
 *                   message: New MPIN must be 4-6 digits
 *               sameMpin:
 *                 summary: Same as old MPIN
 *                 value:
 *                   success: false
 *                   message: New MPIN cannot be same as old MPIN
 */
router.post('/change-mpin', changeMpinController);

export default router;
