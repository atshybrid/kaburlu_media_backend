import prisma from './prisma';

export type BrowserPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type BrowserPushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  data?: Record<string, any>;
};

export type BrowserPushSendResult = {
  total: number;
  sent: number;
  failed: number;
  deactivated: number;
};

function asObject(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function trimOrEmpty(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRetryableError(error: any): boolean {
  const statusCode = Number(error?.statusCode || error?.status || 0);
  if (statusCode === 429 || statusCode >= 500) return true;

  const code = String(error?.code || '').toUpperCase();
  return ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(code);
}

function isGoneError(error: any): boolean {
  const statusCode = Number(error?.statusCode || error?.status || 0);
  return statusCode === 404 || statusCode === 410;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWebPushLib(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('web-push');
}

function getDomainPushCredentials(domainSettingsData: any): { publicKey: string; privateKey: string } | null {
  const data = asObject(domainSettingsData);
  const push = asObject(asObject(data.integrations).push);

  const publicKey = trimOrEmpty(push.webPushVapidPublicKey || push.vapidPublicKey);
  const privateKey = trimOrEmpty(push.webPushVapidPrivateKey || push.vapidPrivateKey);

  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

async function sendNotificationWithRetry(
  webPush: any,
  subscription: BrowserPushSubscription,
  payloadString: string,
  maxAttempts = 3
): Promise<void> {
  const delays = [0, 400, 1200];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await webPush.sendNotification(subscription, payloadString, {
        TTL: 300,
        urgency: 'normal',
      });
      return;
    } catch (error: any) {
      const retryable = isRetryableError(error);
      const lastAttempt = attempt >= maxAttempts;
      if (!retryable || lastAttempt) throw error;
      await wait(delays[attempt] || 1200);
    }
  }
}

export async function saveBrowserPushSubscription(params: {
  tenantId: string;
  domainId: string;
  subscription: BrowserPushSubscription;
}) {
  const endpoint = trimOrEmpty(params.subscription?.endpoint);
  const p256dh = trimOrEmpty(params.subscription?.keys?.p256dh);
  const auth = trimOrEmpty(params.subscription?.keys?.auth);

  if (!endpoint || !p256dh || !auth) {
    throw new Error('INVALID_SUBSCRIPTION');
  }

  return (prisma as any).webPushSubscription.upsert({
    where: {
      domainId_endpoint: {
        domainId: params.domainId,
        endpoint,
      },
    },
    update: {
      p256dh,
      auth,
      isActive: true,
      failCount: 0,
      lastError: null,
    },
    create: {
      tenantId: params.tenantId,
      domainId: params.domainId,
      endpoint,
      p256dh,
      auth,
      isActive: true,
      failCount: 0,
    },
  });
}

export async function deactivateBrowserPushSubscription(params: {
  tenantId: string;
  domainId: string;
  endpoint: string;
}) {
  const endpoint = trimOrEmpty(params.endpoint);
  if (!endpoint) throw new Error('INVALID_ENDPOINT');

  return (prisma as any).webPushSubscription.updateMany({
    where: {
      tenantId: params.tenantId,
      domainId: params.domainId,
      endpoint,
    },
    data: {
      isActive: false,
      lastError: 'unsubscribed',
    },
  });
}

export async function sendBrowserPushToDomain(params: {
  tenantId: string;
  domainId: string;
  payload: BrowserPushPayload;
  limit?: number;
}): Promise<BrowserPushSendResult> {
  const domainSettings = await (prisma as any).domainSettings
    .findUnique({ where: { domainId: params.domainId }, select: { data: true } })
    .catch(() => null);

  const creds = getDomainPushCredentials(domainSettings?.data);
  if (!creds) {
    throw new Error('MISSING_DOMAIN_VAPID_KEYS');
  }

  const webPush = getWebPushLib();
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:support@kaburlu.com';
  webPush.setVapidDetails(subject, creds.publicKey, creds.privateKey);

  const subscriptions: Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    failCount: number;
  }> = await (prisma as any).webPushSubscription.findMany({
    where: {
      tenantId: params.tenantId,
      domainId: params.domainId,
      isActive: true,
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      failCount: true,
    },
    take: params.limit && params.limit > 0 ? Number(params.limit) : undefined,
    orderBy: [{ updatedAt: 'asc' }],
  });

  const payloadString = JSON.stringify({
    title: params.payload.title,
    body: params.payload.body,
    url: params.payload.url || null,
    icon: params.payload.icon || null,
    data: params.payload.data || null,
  });

  let sent = 0;
  let failed = 0;
  let deactivated = 0;

  for (const sub of subscriptions) {
    try {
      await sendNotificationWithRetry(
        webPush,
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadString
      );

      sent++;
      await (prisma as any).webPushSubscription.update({
        where: { id: sub.id },
        data: {
          lastSuccessAt: new Date(),
          failCount: 0,
          lastError: null,
        },
      });
    } catch (error: any) {
      failed++;
      const gone = isGoneError(error);
      if (gone) deactivated++;

      await (prisma as any).webPushSubscription.update({
        where: { id: sub.id },
        data: {
          isActive: gone ? false : true,
          failCount: Number(sub.failCount || 0) + 1,
          lastFailureAt: new Date(),
          lastError: String(error?.message || error?.statusCode || 'push_send_failed').slice(0, 1000),
        },
      });
    }
  }

  return {
    total: subscriptions.length,
    sent,
    failed,
    deactivated,
  };
}
