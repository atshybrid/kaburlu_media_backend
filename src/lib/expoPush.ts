/**
 * Expo Push Notification Service
 * 
 * Handles sending push notifications to Expo Push Tokens (ExponentPushToken[xxx])
 * Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/
 */

import prisma from './prisma';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushMessage {
  to: string | string[];
  title?: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
  subtitle?: string;
  badge?: number;
  channelId?: string;
  categoryId?: string;
  mutableContent?: boolean;
}

export interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushResult {
  successCount: number;
  failureCount: number;
  tickets: ExpoPushTicket[];
  errors: any[];
}

/**
 * Check if a token is an Expo Push Token
 */
export function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

/**
 * Send push notifications to Expo Push Tokens
 */
export async function sendToExpoTokens(
  tokens: string[],
  payload: { title: string; body: string; image?: string; data?: Record<string, string> }
): Promise<ExpoPushResult> {
  if (!tokens.length) {
    console.log('[ExpoPush] sendToExpoTokens: No tokens provided, skipping');
    return { successCount: 0, failureCount: 0, tickets: [], errors: [] };
  }

  // Filter to only Expo tokens
  const expoTokens = tokens.filter(isExpoPushToken);
  if (!expoTokens.length) {
    console.log('[ExpoPush] sendToExpoTokens: No Expo tokens found in provided tokens');
    return { successCount: 0, failureCount: 0, tickets: [], errors: [] };
  }

  console.log(`[ExpoPush] Sending to ${expoTokens.length} Expo token(s)`);
  console.log('[ExpoPush] Payload:', { title: payload.title, body: payload.body, hasImage: !!payload.image });

  // Build messages array (one per token for individual tracking)
  const messages: ExpoPushMessage[] = expoTokens.map(token => ({
    to: token,
    title: payload.title,
    body: payload.body,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    data: {
      ...payload.data,
      // Include image URL in data for app to display
      ...(payload.image ? { imageUrl: payload.image } : {}),
    },
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ExpoPush] API error:', response.status, errorText);
      throw new Error(`Expo Push API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const tickets: ExpoPushTicket[] = result.data || [];

    console.log(`[ExpoPush] API response: ${tickets.length} ticket(s)`);

    let successCount = 0;
    let failureCount = 0;
    const errors: any[] = [];

    // Process tickets and handle errors
    await Promise.all(
      tickets.map(async (ticket, idx) => {
        if (ticket.status === 'ok') {
          successCount++;
        } else {
          failureCount++;
          const errorInfo = { token: expoTokens[idx], error: ticket.message, details: ticket.details };
          console.error(`[ExpoPush] Token ${idx} failed:`, errorInfo);
          errors.push(errorInfo);

          // Remove invalid tokens from database
          const errorCode = ticket.details?.error || '';
          if (errorCode === 'DeviceNotRegistered' || errorCode === 'InvalidCredentials') {
            const token = expoTokens[idx];
            console.log(`[ExpoPush] Removing invalid token: ${token.substring(0, 30)}...`);
            try {
              await prisma.device.updateMany({ where: { pushToken: token }, data: { pushToken: null } });
            } catch {}
          }
        }
      })
    );

    console.log(`[ExpoPush] Result: success=${successCount}, failure=${failureCount}`);
    return { successCount, failureCount, tickets, errors };
  } catch (e) {
    console.error('[ExpoPush] sendToExpoTokens failed:', e);
    throw e;
  }
}

/**
 * Send push notification to a user (all their devices with Expo tokens)
 */
export async function sendToUserExpo(
  userId: string,
  payload: { title: string; body: string; image?: string; data?: Record<string, string> }
): Promise<ExpoPushResult> {
  console.log(`[ExpoPush] sendToUserExpo: Looking up devices for user ${userId}`);
  
  const devices = await prisma.device.findMany({
    where: { userId, pushToken: { not: null } },
    select: { pushToken: true, deviceId: true }
  });
  
  const tokens = devices.map((d: { pushToken: string | null }) => d.pushToken!).filter(isExpoPushToken);
  console.log(`[ExpoPush] Found ${devices.length} device(s), ${tokens.length} with Expo tokens`);
  
  if (!tokens.length) {
    console.log(`[ExpoPush] User ${userId} has no Expo push tokens registered`);
    return { successCount: 0, failureCount: 0, tickets: [], errors: [], message: 'No Expo push tokens found' } as any;
  }
  
  return sendToExpoTokens(tokens, payload);
}

/**
 * Send push notification to all devices (broadcast)
 */
export async function broadcastExpo(
  payload: { title: string; body: string; image?: string; data?: Record<string, string> },
  options?: { limit?: number }
): Promise<ExpoPushResult> {
  console.log('[ExpoPush] broadcastExpo: Fetching all devices with Expo tokens');
  
  const devices = await prisma.device.findMany({
    where: { pushToken: { startsWith: 'Expo' } },
    select: { pushToken: true },
    take: options?.limit || 1000,
  });
  
  const tokens = devices.map((d: { pushToken: string | null }) => d.pushToken!).filter(Boolean);
  console.log(`[ExpoPush] Broadcasting to ${tokens.length} device(s)`);
  
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, tickets: [], errors: [] };
  }
  
  // Expo API accepts max 100 messages per request, chunk if needed
  const CHUNK_SIZE = 100;
  const results: ExpoPushResult = { successCount: 0, failureCount: 0, tickets: [], errors: [] };
  
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const chunkResult = await sendToExpoTokens(chunk, payload);
    results.successCount += chunkResult.successCount;
    results.failureCount += chunkResult.failureCount;
    results.tickets.push(...chunkResult.tickets);
    results.errors.push(...chunkResult.errors);
  }
  
  return results;
}
