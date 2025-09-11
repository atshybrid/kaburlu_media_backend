
import { Router } from 'express';
import { OtpController } from './otp.controller';

const router = Router();
const otpController = new OtpController();

/**
 * @swagger
 * /api/auth/request-otp:
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
 *       400:
 *         description: Invalid mobile number
 */
router.post('/request-otp', otpController.requestOtp);

/**
 * @swagger
 * /api/auth/verify-otp:
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
 * /api/auth/set-mpin:
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
 *             examples:
 *               MPIN set:
 *                 value:
 *                   mpinStatus: true
 *               MPIN not set, registered:
 *                 value:
 *                   mpinStatus: false
 *                   isRegistered: true
 *               MPIN not set, not registered:
 *                 value:
 *                   mpinStatus: false
 *                   isRegistered: false
 *       400:
 *         description: Invalid request
 */
router.get('/mpin-status/:mobileNumber', otpController.getMpinStatus);

export default router;
