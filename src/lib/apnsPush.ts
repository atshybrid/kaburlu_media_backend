/**
 * APNS (Apple Push Notification Service) Native Token Support
 * 
 * Handles iOS native APNS tokens (hex strings, 64-256 chars)
 * Uses Firebase Admin SDK's APNS support to send to native iOS tokens
 */

import { getMessaging } from './firebase';
import prisma from './prisma';

/**
 * Check if a token is an APNS device token (hex string, typically 64-256 chars)
 */
export function isAPNSToken(token: string): boolean {
  // APNS tokens are hex strings (0-9, a-f, A-F) and typically 64-256 characters
  return /^[0-9a-fA-F]{64,256}$/.test(token);
}

/**
 * Send push notifications to APNS tokens via Firebase
 */
export async function sendToAPNSTokens(
  tokens: string[], 
  payload: { title: string; body: string; image?: string; data?: Record<string, string>; color?: string }
): Promise<{ successCount: number; failureCount: number; errors: any[] }> {
  if (!tokens.length) {
    console.log('[APNS] sendToAPNSTokens: No tokens provided, skipping');
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  console.log(`[APNS] sendToAPNSTokens: Sending to ${tokens.length} token(s)`);
  console.log('[APNS] Payload:', { 
    title: payload.title, 
    body: payload.body, 
    hasImage: !!payload.image, 
    dataKeys: payload.data ? Object.keys(payload.data) : [] 
  });

  try {
    const messaging = getMessaging();
    
    // Build APNS-specific message for each token
    const messages = tokens.map(token => ({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.image && { imageUrl: payload.image })
      },
      data: payload.data || {},
      apns: {
        headers: {
          'apns-priority': '10', // High priority
        },
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            sound: 'default',
            badge: 1,
            'mutable-content': 1, // Allows rich notifications with images
          }
        },
        ...(payload.image && {
          fcmOptions: {
            imageUrl: payload.image
          }
        })
      }
    }));

    // Send to each token individually (sendAll is more efficient than sendEachForMulticast for APNS)
    const response = await messaging.sendEach(messages);

    console.log(`[APNS] sendToAPNSTokens result: success=${response.successCount}, failure=${response.failureCount}`);

    // Handle failed tokens
    const errors: any[] = [];
    await Promise.all(
      response.responses.map(async (r, idx) => {
        if (!r.success && r.error) {
          const errorInfo = r.error.errorInfo || r.error;
          console.error(`[APNS] Token ${idx} failed:`, errorInfo);
          errors.push(r.error);

          // Remove invalid tokens from database
          const code = (r.error as any)?.errorInfo?.code || (r.error as any)?.code || '';
          if (
            code.includes('registration-token-not-registered') || 
            code.includes('invalid-argument') ||
            code.includes('invalid-registration-token')
          ) {
            const token = tokens[idx];
            console.log(`[APNS] Removing invalid token from database: ${token.substring(0, 20)}...`);
            try {
              await prisma.device.updateMany({ 
                where: { pushToken: token }, 
                data: { pushToken: null } 
              });
            } catch (e) {
              console.error('[APNS] Failed to remove invalid token:', e);
            }
          }
        }
      })
    );

    return { 
      successCount: response.successCount, 
      failureCount: response.failureCount, 
      errors 
    };
  } catch (e) {
    console.error('[APNS] sendToAPNSTokens failed with exception:', e);
    throw e;
  }
}

/**
 * Send push notification to a specific user's APNS tokens
 */
export async function sendToUserAPNS(
  userId: string, 
  payload: { title: string; body: string; image?: string; data?: Record<string, string> }
): Promise<{ successCount: number; failureCount: number; errors: any[]; message?: string }> {
  console.log(`[APNS] sendToUserAPNS: Looking up APNS tokens for user ${userId}`);
  
  const devices = await prisma.device.findMany({ 
    where: { userId, pushToken: { not: null } }, 
    select: { pushToken: true, deviceId: true } 
  });

  console.log(`[APNS] sendToUserAPNS: Found ${devices.length} device(s) with push tokens`);
  
  const apnsTokens = devices
    .map(d => d.pushToken!)
    .filter(Boolean)
    .filter(isAPNSToken);

  if (!apnsTokens.length) {
    console.log(`[APNS] sendToUserAPNS: User ${userId} has no APNS tokens registered`);
    return { successCount: 0, failureCount: 0, errors: [], message: 'No APNS tokens found for user' };
  }

  return sendToAPNSTokens(apnsTokens, payload);
}
