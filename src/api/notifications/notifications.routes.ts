import { Router } from 'express';
import passport from 'passport';
import { sendToTokens, sendToUser } from '../../lib/fcm';

const router = Router();

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
    const result = await sendToTokens([token], { title, body, data });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'failed to send' });
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
    const result = await sendToUser(userId, { title, body, data });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'failed to send' });
  }
});

export default router;
