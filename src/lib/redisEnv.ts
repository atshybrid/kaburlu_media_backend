export type RedisEnvConfig = {
  url: string;
  hasExplicitUrl: boolean;
};

function truthy(v: unknown): boolean {
  return String(v || '').toLowerCase() === 'true' || String(v || '') === '1';
}

/**
 * Returns a Redis URL to be used by Redis clients.
 *
 * Supports either:
 * - REDIS_URL (preferred)
 * - or discrete env vars:
 *   REDIS_HOST, REDIS_PORT, REDIS_USERNAME (default: 'default'), REDIS_PASSWORD
 *   plus REDIS_TLS=true to use rediss://
 */
export function getRedisUrlFromEnv(): RedisEnvConfig | null {
  const explicitUrl = String(process.env.REDIS_URL || '').trim();
  if (explicitUrl) {
    return { url: explicitUrl, hasExplicitUrl: true };
  }

  const host = String(process.env.REDIS_HOST || '').trim();
  const portRaw = String(process.env.REDIS_PORT || '').trim();
  const password = String(process.env.REDIS_PASSWORD || '').trim();
  const username = String(process.env.REDIS_USERNAME || 'default').trim();

  if (!host || !portRaw || !password) {
    return null;
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  const scheme = truthy(process.env.REDIS_TLS) ? 'rediss' : 'redis';
  const userEnc = encodeURIComponent(username);
  const passEnc = encodeURIComponent(password);

  return {
    url: `${scheme}://${userEnc}:${passEnc}@${host}:${port}`,
    hasExplicitUrl: false
  };
}

export function isRedisConfigured(): boolean {
  return !!getRedisUrlFromEnv();
}
