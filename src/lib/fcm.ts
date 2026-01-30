import { getMessaging } from './firebase';
import prisma from './prisma';

export async function sendToTokens(tokens: string[], payload: { title: string; body: string; image?: string; data?: Record<string, string>; color?: string }) {
  if (!tokens.length) {
    console.log('[FCM] sendToTokens: No tokens provided, skipping');
    return { successCount: 0, failureCount: 0, errors: [] as any[] };
  }
  
  console.log(`[FCM] sendToTokens: Sending to ${tokens.length} token(s)`);
  console.log('[FCM] Payload:', { title: payload.title, body: payload.body, hasImage: !!payload.image, dataKeys: payload.data ? Object.keys(payload.data) : [] });
  
  try {
    const messaging = getMessaging();
    
    // Android notification config with color and image
    const androidNotification: any = {
      color: payload.color || '#FF0000', // Red by default for breaking news
      priority: 'max' as const,
      channelId: 'breaking_news', // High priority channel
    };
    if (payload.image) {
      androidNotification.imageUrl = payload.image;
    }
    
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body, imageUrl: payload.image },
      data: payload.data || {},
      android: { 
        priority: 'high', 
        notification: androidNotification
      },
      apns: { 
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            'mutable-content': 1, // Allows image to show on iOS
            sound: 'default'
          }
        },
        fcmOptions: payload.image ? { imageUrl: payload.image } : undefined
      },
    } as any);

    console.log(`[FCM] sendToTokens result: success=${response.successCount}, failure=${response.failureCount}`);

    // prune invalid tokens
    const errors: any[] = [];
    await Promise.all(
      response.responses.map(async (r: { success: boolean; error?: any }, idx: number) => {
        if (!r.success) {
          const errorInfo = r.error?.errorInfo || r.error;
          console.error(`[FCM] Token ${idx} failed:`, errorInfo);
          errors.push(r.error);
          const code = (r.error && (r.error as any).errorInfo?.code) || '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
            const token = tokens[idx];
            console.log(`[FCM] Removing invalid token from database: ${token.substring(0, 20)}...`);
            try {
              await prisma.device.updateMany({ where: { pushToken: token }, data: { pushToken: null } });
            } catch {}
          }
        }
      })
    );

    return { successCount: response.successCount, failureCount: response.failureCount, errors };
  } catch (e) {
    console.error('[FCM] sendToTokens failed with exception:', e);
    throw e;
  }
}

export async function sendToUser(userId: string, payload: { title: string; body: string; image?: string; data?: Record<string, string> }) {
  console.log(`[FCM] sendToUser: Looking up devices for user ${userId}`);
  const devices = await prisma.device.findMany({ where: { userId, pushToken: { not: null } }, select: { pushToken: true, deviceId: true } });
  console.log(`[FCM] sendToUser: Found ${devices.length} device(s) with push tokens`);
  const tokens = devices.map(d => d.pushToken!).filter(Boolean);
  if (!tokens.length) {
    console.log(`[FCM] sendToUser: User ${userId} has no push tokens registered`);
    return { successCount: 0, failureCount: 0, errors: [], message: 'No push tokens found for user' };
  }
  return sendToTokens(tokens, payload);
}

export async function subscribeToTopic(tokens: string[], topic: string) {
  if (!tokens.length) return { success: true };
  const messaging = getMessaging();
  await messaging.subscribeToTopic(tokens, topic);
  return { success: true };
}

export async function unsubscribeFromTopic(tokens: string[], topic: string) {
  if (!tokens.length) return { success: true };
  const messaging = getMessaging();
  await messaging.unsubscribeFromTopic(tokens, topic);
  return { success: true };
}

export async function sendToTopic(topic: string, payload: { title: string; body: string; image?: string; data?: Record<string, string> }) {
  const messaging = getMessaging();
  const message: any = {
    topic,
    notification: { title: payload.title, body: payload.body, image: payload.image },
    data: payload.data || {},
    android: { priority: 'high', notification: payload.image ? { imageUrl: payload.image } : undefined },
    apns: { headers: { 'apns-priority': '10' } },
  };
  return messaging.send(message);
}
