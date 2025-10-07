import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
// any-cast to reduce transient TS issues when schema just changed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

interface CachedDomain {
  domain: any; // Prisma Domain with tenant
  tenant: any; // Prisma Tenant
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60s
const cache = new Map<string, CachedDomain>();
const pending = new Map<string, Promise<CachedDomain | null>>();

function normalizeHost(raw?: string | string[]): string | null {
  if (!raw) return null;
  const host = Array.isArray(raw) ? raw[0] : raw;
  if (!host) return null;
  return host.toLowerCase().replace(/:\d+$/, '');
}

async function fetchDomain(host: string): Promise<CachedDomain | null> {
  const now = Date.now();
  const cached = cache.get(host);
  if (cached && cached.expiresAt > now) return cached;
  if (pending.has(host)) return pending.get(host)!;
  const prom = p.domain.findUnique({
    where: { domain: host },
    include: { tenant: true }
  }).then((result: any) => {
    if (!result || result.status !== 'ACTIVE') return null;
    const entry: CachedDomain = { domain: result, tenant: result.tenant, expiresAt: Date.now() + CACHE_TTL_MS };
    cache.set(host, entry);
    return entry;
  }).finally(() => {
    pending.delete(host);
  });
  pending.set(host, prom);
  return prom;
}

export async function tenantResolver(req: Request, res: Response, next: NextFunction) {
  if (process.env.MULTI_TENANCY !== 'true') return next();

  const host = normalizeHost(req.headers['x-forwarded-host'] || req.headers.host);
  if (!host) {
    return res.status(400).json({ code: 'HOST_HEADER_REQUIRED', message: 'Host header missing for tenant resolution' });
  }
  try {
    const data = await fetchDomain(host);
    if (!data) {
      return res.status(404).json({ code: 'DOMAIN_NOT_FOUND_OR_INACTIVE', message: 'Domain not active or unknown' });
    }
    (res.locals as any).domain = data.domain;
    (res.locals as any).tenant = data.tenant;
    return next();
  } catch (e: any) {
    console.error('tenantResolver error', e);
    return res.status(500).json({ code: 'TENANT_RESOLUTION_FAILED', message: 'Failed to resolve tenant' });
  }
}

// Utility to clear cache (future admin invalidation hook)
export function clearTenantDomainCache(host?: string) {
  if (host) cache.delete(host); else cache.clear();
}
