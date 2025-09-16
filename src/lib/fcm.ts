import { getMessaging } from './firebase';
import prisma from './prisma';

export async function sendToTokens(tokens: string[], payload: { title: string; body: string; image?: string; data?: Record<string, string> }) {
  if (!tokens.length) return { successCount: 0, failureCount: 0, errors: [] as any[] };
  const messaging = getMessaging();
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body, image: payload.image },
    data: payload.data || {},
    android: { priority: 'high', notification: payload.image ? { imageUrl: payload.image } as any : undefined },
    apns: { headers: { 'apns-priority': '10' } },
  } as any);

  // prune invalid tokens
  const errors: any[] = [];
  await Promise.all(
    response.responses.map(async (r: { success: boolean; error?: any }, idx: number) => {
      if (!r.success) {
        errors.push(r.error);
        const code = (r.error && (r.error as any).errorInfo?.code) || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          const token = tokens[idx];
          try {
            await prisma.device.updateMany({ where: { pushToken: token }, data: { pushToken: null } });
          } catch {}
        }
      }
    })
  );

  return { successCount: response.successCount, failureCount: response.failureCount, errors };
}

export async function sendToUser(userId: string, payload: { title: string; body: string; image?: string; data?: Record<string, string> }) {
  const devices = await prisma.device.findMany({ where: { userId, pushToken: { not: null } }, select: { pushToken: true } });
  const tokens = devices.map(d => d.pushToken!).filter(Boolean);
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
