
import { Router } from 'express';
import { OtpController } from './otp.controller';

const router = Router();
const otpController = new OtpController();

/**
 * @swagger
 * /auth/request-otp:
 *   post:
 *     summary: Request an OTP for a given mobile number
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
 *                 example: "9999999999"
 *     responses:
 *       200:
 *         description: OTP request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: The ID of the OTP log entry.
 *                 isRegistered:
 *                   type: boolean
 *                   description: Indicates whether the mobile number already exists as a registered user.
 *                 notification:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     successCount:
 *                       type: number
 *                     failureCount:
 *                       type: number
 *                 whatsapp:
 *                   type: object
 *                   nullable: true
 *                   description: Present when WHATSAPP_OTP_ENABLED=true
 *                   properties:
 *                     ok:
 *                       type: boolean
 *                     messageId:
 *                       type: string
 *                       nullable: true
 *                     error:
 *                       type: string
 *                       nullable: true
 *             examples:
 *               sample:
 *                 value:
 *                   success: true
 *                   id: "ckotp_01HXYZ"
 *                   isRegistered: true
 *                   notification: { successCount: 1, failureCount: 0 }
 *                   whatsapp: { ok: true, messageId: "wamid.HBgMOTE5MT..." }
 *       400:
 *         description: Invalid mobile number
 */
router.post('/request-otp', otpController.requestOtp);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify an OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The ID of the OTP log entry.
 *               otp:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: OTP verification successful
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/verify-otp', otpController.verifyOtp);

/**
 * @swagger
 * /auth/set-mpin:
 *   post:
 *     summary: Set a new MPIN for the user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The ID of the OTP log entry from the verify-otp step.
 *               mobileNumber:
 *                 type: string
 *                 example: "8282868389"
 *               mpin:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: MPIN set successfully
 *       400:
 *         description: Invalid request
 */
router.post('/set-mpin', otpController.setMpin);

/**
 * @swagger
 * /auth/mpin-status/{mobileNumber}:
 *   get:
 *     summary: Check if a user has an MPIN set
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: mobileNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: The user's mobile number.
 *     responses:
 *       200:
 *         description: MPIN status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mpinStatus:
 *                   type: boolean
 *                   description: True if MPIN is set, false otherwise.
 *                 isRegistered:
 *                   type: boolean
 *                   description: True if mobile number is registered (only present when mpinStatus is false).
 *                 roleId:
 *                   type: string
 *                   nullable: true
 *                   description: User role id if user exists, otherwise null.
 *                 roleName:
 *                   type: string
 *                   nullable: true
 *                   description: User role name if user exists, otherwise null.
 *             examples:
 *               MPIN set:
 *                 value:
 *                   mpinStatus: true
 *                   roleId: "<role-id>"
 *                   roleName: "CITIZEN_REPORTER"
 *               MPIN not set, registered:
 *                 value:
 *                   mpinStatus: false
 *                   isRegistered: true
 *                   roleId: "<role-id>"
 *                   roleName: "CITIZEN_REPORTER"
 *               MPIN not set, not registered:
 *                 value:
 *                   mpinStatus: false
 *                   isRegistered: false
 *                   roleId: null
 *                   roleName: null
 *       402:
 *         description: Payment Required - Reporter has pending payment (same format as login 402)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 verified:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: PAYMENT_REQUIRED
 *                 message:
 *                   type: string
 *                   example: Reporter payments required before login
 *                 data:
 *                   type: object
 *                   properties:
 *                     roleId:
 *                       type: string
 *                     roleName:
 *                       type: string
 *                     reporter:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         tenantId:
 *                           type: string
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         slug:
 *                           type: string
 *                     outstanding:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [ONBOARDING, MONTHLY_SUBSCRIPTION]
 *                           amount:
 *                             type: integer
 *                           currency:
 *                             type: string
 *                           status:
 *                             type: string
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         idCardCharge:
 *                           type: object
 *                           properties:
 *                             label:
 *                               type: string
 *                             amount:
 *                               type: integer
 *                             amountPaise:
 *                               type: integer
 *                             displayAmount:
 *                               type: string
 *                         monthlySubscription:
 *                           type: object
 *                           properties:
 *                             label:
 *                               type: string
 *                             amount:
 *                               type: integer
 *                             amountPaise:
 *                               type: integer
 *                             displayAmount:
 *                               type: string
 *                             year:
 *                               type: integer
 *                             month:
 *                               type: integer
 *                         total:
 *                           type: object
 *                           properties:
 *                             label:
 *                               type: string
 *                             amount:
 *                               type: integer
 *                             amountPaise:
 *                               type: integer
 *                             displayAmount:
 *                               type: string
 *       400:
 *         description: Invalid request
 */
router.get('/mpin-status/:mobileNumber', otpController.getMpinStatus);

export default router;
