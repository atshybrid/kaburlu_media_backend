/**
 * Unified Push Notification Service
 * 
 * Automatically detects token type and routes to appropriate service:
 * - ExponentPushToken[xxx] → Expo Push API
 * - FCM token (cVJ8xxx) → Firebase Cloud Messaging
 */

import { sendToTokens as sendToFCMTokens, sendToUser as sendToUserFCM } from './fcm';
import { sendToExpoTokens, sendToUserExpo, isExpoPushToken, broadcastExpo } from './expoPush';
import prisma from './prisma';

export interface PushPayload {
  title: string;
  body: string;
  image?: string;
  data?: Record<string, string>;
}

export interface PushResult {
  successCount: number;
  failureCount: number;
  errors: any[];
  expoResult?: any;
  fcmResult?: any;
}

/**
 * Send push notification to tokens (auto-detects Expo vs FCM)
 */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<PushResult> {
  if (!tokens.length) {
    console.log('[Push] sendPush: No tokens provided');
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  // Separate tokens by type
  const expoTokens = tokens.filter(isExpoPushToken);
  const fcmTokens = tokens.filter(t => !isExpoPushToken(t));

  console.log(`[Push] Tokens: ${expoTokens.length} Expo, ${fcmTokens.length} FCM`);

  const results: PushResult = { successCount: 0, failureCount: 0, errors: [] };

  // Send to Expo tokens
  if (expoTokens.length > 0) {
    try {
      const expoResult = await sendToExpoTokens(expoTokens, payload);
      results.successCount += expoResult.successCount;
      results.failureCount += expoResult.failureCount;
      results.errors.push(...expoResult.errors);
      results.expoResult = expoResult;
    } catch (e: any) {
      console.error('[Push] Expo send failed:', e);
      results.failureCount += expoTokens.length;
      results.errors.push({ type: 'expo', error: e.message });
    }
  }

  // Send to FCM tokens
  if (fcmTokens.length > 0) {
    try {
      const fcmResult = await sendToFCMTokens(fcmTokens, payload);
      results.successCount += fcmResult.successCount;
      results.failureCount += fcmResult.failureCount;
      results.errors.push(...fcmResult.errors);
      results.fcmResult = fcmResult;
    } catch (e: any) {
      console.error('[Push] FCM send failed:', e);
      results.failureCount += fcmTokens.length;
      results.errors.push({ type: 'fcm', error: e.message });
    }
  }

  console.log(`[Push] Total result: success=${results.successCount}, failure=${results.failureCount}`);
  return results;
}

/**
 * Send push notification to a user (all their devices)
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  console.log(`[Push] sendPushToUser: ${userId}`);
  
  const devices = await prisma.device.findMany({
    where: { userId, pushToken: { not: null } },
    select: { pushToken: true }
  });
  
  const tokens = devices.map(d => d.pushToken!).filter(Boolean);
  
  if (!tokens.length) {
    console.log(`[Push] User ${userId} has no push tokens`);
    return { successCount: 0, failureCount: 0, errors: [], message: 'No push tokens found' } as any;
  }
  
  return sendPush(tokens, payload);
}

/**
 * Broadcast push notification to all devices
 */
export async function broadcastPush(
  payload: PushPayload,
  options?: { limit?: number }
): Promise<PushResult> {
  console.log('[Push] broadcastPush: Fetching all devices');
  
  const devices = await prisma.device.findMany({
    where: { pushToken: { not: null } },
    select: { pushToken: true },
    take: options?.limit || 1000,
  });
  
  const tokens = devices.map(d => d.pushToken!).filter(Boolean);
  console.log(`[Push] Broadcasting to ${tokens.length} device(s)`);
  
  return sendPush(tokens, payload);
}

/**
 * Send push for a new article/short news
 */
export async function sendArticleNotification(article: {
  id: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  categoryId?: string;
}): Promise<PushResult> {
  console.log(`[Push] sendArticleNotification: ${article.id}`);
  
  return broadcastPush({
    title: '📰 New Article',
    body: article.title,
    image: article.imageUrl,
    data: {
      type: 'article',
      articleId: article.id,
      shortId: article.id.slice(-6),
    },
  });
}
