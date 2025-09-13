import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { subscribeToTopic } from '../../lib/fcm';

const router = Router();

/**
 * @swagger
 * /devices/register:
 *   post:
 *     summary: Register or update device push token
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *               pushToken:
 *                 type: string
 *               deviceModel:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registered
 */
router.post('/register', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    const { deviceId, pushToken, deviceModel } = req.body as { deviceId?: string; pushToken?: string; deviceModel?: string };
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!deviceId || !pushToken) return res.status(400).json({ error: 'deviceId and pushToken are required' });
    const up = await prisma.device.upsert({
      where: { deviceId },
      update: { userId, pushToken, deviceModel: deviceModel || undefined },
      create: { userId, deviceId, deviceModel: deviceModel || '', pushToken },
    });
    try {
      // Subscribe to language topic and category topic if available (best-effort)
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { language: true } });
      const tokens = [pushToken];
      if (user?.language?.code) {
        const langTopic = `news-lang-${user.language.code.toLowerCase()}`;
        await subscribeToTopic(tokens, langTopic);
      }
      if (req.body.categoryId) {
        const catTopic = `news-cat-${String(req.body.categoryId).toLowerCase()}`;
        await subscribeToTopic(tokens, catTopic);
      }
    } catch {}
    res.json({ success: true, device: up });
  } catch (e) {
    res.status(500).json({ error: 'failed to register device' });
  }
});

/**
 * @swagger
 * /devices/unregister:
 *   delete:
 *     summary: Unregister device push token
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Unregistered
 */
router.delete('/unregister', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { deviceId } = req.body as { deviceId?: string };
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });
    await prisma.device.update({ where: { deviceId }, data: { pushToken: null } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'failed to unregister device' });
  }
});

export default router;
