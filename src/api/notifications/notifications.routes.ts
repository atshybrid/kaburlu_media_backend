import { Router } from 'express';
import passport from 'passport';
import { sendToTokens, sendToUser } from '../../lib/fcm';
import { getAdmin } from '../../lib/firebase';
import prisma from '../../lib/prisma';
import { config } from '../../config/env';

const router = Router();

/**
 * @swagger
 * /notifications/status:
 *   get:
 *     summary: Check Firebase/FCM configuration status
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Firebase status
 */
router.get('/status', async (_req, res) => {
  try {
    const { projectId, clientEmail, privateKey, credsPath } = config.firebase;
    const admin = getAdmin();
    const app = admin.app();
    
    // Count devices with push tokens
    const deviceCount = await prisma.device.count({ where: { pushToken: { not: null } } });
    
    res.json({
      status: 'ok',
      firebase: {
        initialized: true,
        projectId: app.options.projectId || projectId,
        hasClientEmail: !!clientEmail,
        hasPrivateKey: !!privateKey,
        privateKeyLength: privateKey?.length || 0,
        credsPath: credsPath || null,
      },
      devices: {
        withPushToken: deviceCount
      }
    });
  } catch (e: any) {
    res.status(500).json({
      status: 'error',
      firebase: {
        initialized: false,
        error: e?.message || 'Unknown error',
        hasProjectId: !!config.firebase.projectId,
        hasClientEmail: !!config.firebase.clientEmail,
        hasPrivateKey: !!config.firebase.privateKey,
        credsPath: config.firebase.credsPath || null,
      }
    });
  }
});

/**
 * @swagger
 * /notifications/test-token:
 *   post:
 *     summary: Send a test notification to a token
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Send result
 */
router.post('/test-token', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { token, title, body, data } = req.body as { token?: string; title?: string; body?: string; data?: Record<string, string> };
    if (!token || !title || !body) return res.status(400).json({ error: 'token, title, body required' });
    console.log(`[Notifications] test-token: Sending test notification to token: ${token.substring(0, 30)}...`);
    const result = await sendToTokens([token], { title, body, data });
    console.log('[Notifications] test-token result:', result);
    res.json(result);
  } catch (e: any) {
    console.error('[Notifications] test-token error:', e);
    res.status(500).json({ 
      error: 'failed to send', 
      message: e?.message || 'Unknown error',
      code: e?.errorInfo?.code || e?.code || 'UNKNOWN'
    });
  }
});

/**
 * @swagger
 * /notifications/user:
 *   post:
 *     summary: Send a notification to a user (all devices)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Send result
 */
router.post('/user', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { userId, title, body, data } = req.body as { userId?: string; title?: string; body?: string; data?: Record<string, string> };
    if (!userId || !title || !body) return res.status(400).json({ error: 'userId, title, body required' });
    console.log(`[Notifications] user: Sending notification to user: ${userId}`);
    const result = await sendToUser(userId, { title, body, data });
    console.log('[Notifications] user result:', result);
    res.json(result);
  } catch (e: any) {
    console.error('[Notifications] user error:', e);
    res.status(500).json({ 
      error: 'failed to send', 
      message: e?.message || 'Unknown error',
      code: e?.errorInfo?.code || e?.code || 'UNKNOWN'
    });
  }
});

export default router;
