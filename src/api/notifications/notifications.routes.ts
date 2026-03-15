import { Router } from 'express';
import passport from 'passport';
import { sendPush, sendPushToUser, broadcastPush } from '../../lib/push';
import { isExpoPushToken } from '../../lib/expoPush';
import { isAPNSToken } from '../../lib/apnsPush';
import prisma from '../../lib/prisma';
import { config } from '../../config/env';
import { requireSuperOrTenantAdmin } from '../middlewares/authz';
import { sendBrowserPushToDomain } from '../../lib/webPushBrowser';

const router = Router();

/**
 * @swagger
 * /notifications/status:
 *   get:
 *     summary: Check push notification configuration status
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Push notification status
 */
router.get('/status', async (_req, res) => {
  try {
    // Count devices by token type
    const allDevices = await prisma.device.findMany({
      where: { pushToken: { not: null } },
      select: { pushToken: true }
    });
    
    const expoTokens = allDevices.filter(d => isExpoPushToken(d.pushToken!));
    const apnsTokens = allDevices.filter(d => !isExpoPushToken(d.pushToken!) && isAPNSToken(d.pushToken!));
    const fcmTokens = allDevices.filter(d => !isExpoPushToken(d.pushToken!) && !isAPNSToken(d.pushToken!));
    
    // Check Firebase config
    const { projectId, clientEmail, privateKey } = config.firebase;
    
    res.json({
      status: 'ok',
      devices: {
        total: allDevices.length,
        expoTokens: expoTokens.length,
        apnsTokens: apnsTokens.length,
        fcmTokens: fcmTokens.length,
      },
      services: {
        expo: {
          enabled: true,
          endpoint: 'https://exp.host/--/api/v2/push/send',
        },
        apns: {
          enabled: !!(projectId && clientEmail && privateKey),
          description: 'Apple Push via Firebase Admin SDK',
          hasCredentials: !!(clientEmail && privateKey),
        },
        firebase: {
          enabled: !!(projectId && clientEmail && privateKey),
          projectId: projectId || null,
          hasCredentials: !!(clientEmail && privateKey),
        }
      }
    });
  } catch (e: any) {
    res.status(500).json({
      status: 'error',
      error: e?.message || 'Unknown error',
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
    
    let tokenType = 'FCM'; // Default
    if (isExpoPushToken(token)) {
      tokenType = 'Expo';
    } else if (isAPNSToken(token)) {
      tokenType = 'APNS';
    }
    console.log(`[Notifications] test-token: Sending ${tokenType} notification to: ${token.substring(0, 30)}...`);
    
    const result = await sendPush([token], { title, body, data });
    console.log('[Notifications] test-token result:', result);
    res.json({ ...result, tokenType });
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
    const result = await sendPushToUser(userId, { title, body, data });
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

/**
 * @swagger
 * /notifications/broadcast:
 *   post:
 *     summary: Send notification to all devices (admin only)
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
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *               limit:
 *                 type: number
 *                 description: Max devices to send to (default 1000)
 *     responses:
 *       200:
 *         description: Broadcast result
 */
router.post('/broadcast', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { title, body, data, limit } = req.body as { title?: string; body?: string; data?: Record<string, string>; limit?: number };
    if (!title || !body) return res.status(400).json({ error: 'title, body required' });
    
    console.log(`[Notifications] broadcast: Sending to all devices (limit: ${limit || 1000})`);
    const result = await broadcastPush({ title, body, data }, { limit });
    console.log('[Notifications] broadcast result:', result);
    res.json(result);
  } catch (e: any) {
    console.error('[Notifications] broadcast error:', e);
    res.status(500).json({ 
      error: 'failed to broadcast', 
      message: e?.message || 'Unknown error'
    });
  }
});

router.post('/webpush/domain', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '').toUpperCase();

    const domainId = String(req.body?.domainId || '').trim();
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : undefined;
    const icon = typeof req.body?.icon === 'string' ? req.body.icon.trim() : undefined;
    const data = req.body?.data && typeof req.body.data === 'object' ? req.body.data : undefined;
    const limit = Number(req.body?.limit || 0) || undefined;
    const asyncMode = req.body?.async === undefined ? true : Boolean(req.body.async);

    if (!domainId || !title || !body) {
      return res.status(400).json({ error: 'domainId, title and body are required' });
    }

    const domain = await (prisma as any).domain.findUnique({
      where: { id: domainId },
      select: { id: true, tenantId: true, domain: true },
    });
    if (!domain) return res.status(404).json({ error: 'Domain not found' });

    if (roleName === 'TENANT_ADMIN') {
      const reporter = await (prisma as any).reporter
        .findFirst({ where: { userId: user.id }, select: { tenantId: true } })
        .catch(() => null);
      if (!reporter || String(reporter.tenantId) !== String(domain.tenantId)) {
        return res.status(403).json({ error: 'Tenant scope mismatch' });
      }
    }

    const payload = { title, body, url, icon, data };

    if (asyncMode) {
      Promise.resolve(
        sendBrowserPushToDomain({
          tenantId: domain.tenantId,
          domainId: domain.id,
          payload,
          limit,
        })
      )
        .then((result) => {
          console.log('[webpush/domain] completed', { domainId: domain.id, result });
        })
        .catch((error) => {
          console.error('[webpush/domain] failed', { domainId: domain.id, error: error?.message || error });
        });

      return res.status(202).json({
        accepted: true,
        mode: 'async',
        domainId: domain.id,
        domain: domain.domain,
      });
    }

    const result = await sendBrowserPushToDomain({
      tenantId: domain.tenantId,
      domainId: domain.id,
      payload,
      limit,
    });

    return res.status(200).json({
      accepted: true,
      mode: 'sync',
      domainId: domain.id,
      domain: domain.domain,
      result,
    });
  } catch (e: any) {
    const message = String(e?.message || 'failed to send web push');
    if (message === 'MISSING_DOMAIN_VAPID_KEYS') {
      return res.status(400).json({ error: 'Domain VAPID keys are missing. Configure integrations.push first.' });
    }
    return res.status(500).json({ error: 'failed to send web push', message });
  }
});

/**
 * @swagger
 * /notifications/test:
 *   post:
 *     summary: Quick test - send notification to all registered devices (no auth for testing)
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 default: "Test Notification"
 *               body:
 *                 type: string
 *                 default: "This is a test message"
 *     responses:
 *       200:
 *         description: Test result
 */
router.post('/test', async (req, res) => {
  try {
    const { title = 'Test Notification', body = 'This is a test message' } = req.body;
    console.log('[Notifications] test: Quick test to all devices');
    const result = await broadcastPush({ title, body, data: { test: 'true' } }, { limit: 10 });
    res.json(result);
  } catch (e: any) {
    console.error('[Notifications] test error:', e);
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

export default router;
