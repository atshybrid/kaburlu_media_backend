import prisma from './prisma';

type EnsureDomainPushKeysResult = {
  updated: boolean;
  createdSettings: boolean;
  domainId: string;
  tenantId: string;
  domain?: string | null;
  reason?: string;
};

function asObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

function currentPushKeys(pushConfig: Record<string, any>) {
  const publicKey =
    typeof pushConfig.webPushVapidPublicKey === 'string' && pushConfig.webPushVapidPublicKey.trim()
      ? pushConfig.webPushVapidPublicKey.trim()
      : typeof pushConfig.vapidPublicKey === 'string' && pushConfig.vapidPublicKey.trim()
        ? pushConfig.vapidPublicKey.trim()
        : '';

  const privateKey =
    typeof pushConfig.webPushVapidPrivateKey === 'string' && pushConfig.webPushVapidPrivateKey.trim()
      ? pushConfig.webPushVapidPrivateKey.trim()
      : typeof pushConfig.vapidPrivateKey === 'string' && pushConfig.vapidPrivateKey.trim()
        ? pushConfig.vapidPrivateKey.trim()
        : '';

  return { publicKey, privateKey };
}

function generateVapidKeys(): { publicKey: string; privateKey: string } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const webPush = require('web-push');
  return webPush.generateVAPIDKeys();
}

/**
 * Ensures a domain has web-push VAPID keys in DomainSettings.data.integrations.push.
 * - Stores public + private keys under both canonical and legacy aliases for compatibility.
 * - Does not regenerate if both keys already exist, unless forceRegenerate=true.
 */
export async function ensureDomainPushVapidKeys(
  domainId: string,
  opts: { tenantId?: string; forceRegenerate?: boolean } = {}
): Promise<EnsureDomainPushKeysResult> {
  const forceRegenerate = Boolean(opts.forceRegenerate);

  const domain = await (prisma as any).domain
    .findUnique({ where: { id: domainId }, select: { id: true, tenantId: true, domain: true } })
    .catch(() => null);

  if (!domain) {
    return {
      updated: false,
      createdSettings: false,
      domainId,
      tenantId: opts.tenantId || '',
      reason: 'domain_not_found',
    };
  }

  if (opts.tenantId && String(domain.tenantId) !== String(opts.tenantId)) {
    return {
      updated: false,
      createdSettings: false,
      domainId,
      tenantId: String(domain.tenantId),
      domain: domain.domain,
      reason: 'tenant_mismatch',
    };
  }

  const existing = await (prisma as any).domainSettings.findUnique({ where: { domainId } }).catch(() => null);
  const data = asObject(existing?.data);
  const integrations = asObject(data.integrations);
  const push = asObject(integrations.push);

  const keys = currentPushKeys(push);
  const hasCompletePair = Boolean(keys.publicKey && keys.privateKey);

  if (hasCompletePair && !forceRegenerate) {
    return {
      updated: false,
      createdSettings: false,
      domainId,
      tenantId: String(domain.tenantId),
      domain: domain.domain,
      reason: 'already_present',
    };
  }

  const generated = generateVapidKeys();
  const nextPush = {
    ...push,
    webPushVapidPublicKey: generated.publicKey,
    webPushVapidPrivateKey: generated.privateKey,

    // Backward-compatible aliases used by older paths
    vapidPublicKey: generated.publicKey,
    vapidPrivateKey: generated.privateKey,
  };

  const nextData = {
    ...data,
    integrations: {
      ...integrations,
      push: nextPush,
    },
  };

  if (existing) {
    await (prisma as any).domainSettings.update({ where: { id: existing.id }, data: { data: nextData } });
    return {
      updated: true,
      createdSettings: false,
      domainId,
      tenantId: String(domain.tenantId),
      domain: domain.domain,
    };
  }

  await (prisma as any).domainSettings.create({
    data: {
      tenantId: String(domain.tenantId),
      domainId,
      data: nextData,
    },
  });

  return {
    updated: true,
    createdSettings: true,
    domainId,
    tenantId: String(domain.tenantId),
    domain: domain.domain,
  };
}
