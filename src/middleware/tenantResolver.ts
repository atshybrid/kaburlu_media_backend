import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantDisplayName, getTenantPrimaryLanguageInfo } from '../lib/tenantLocalization';

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

const tenantInclude = {
  translations: true,
  entity: { include: { language: true } },
};

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
  const prom = (async () => {
    try {
      const result = await p.domain.findUnique({ where: { domain: host }, include: { tenant: { include: tenantInclude } } });
      if (!result || result.status !== 'ACTIVE') return null;
      const tenant = result.tenant;
      (tenant as any).displayName = getTenantDisplayName(tenant);
      (tenant as any).primaryLanguage = getTenantPrimaryLanguageInfo(tenant);
      const entry: CachedDomain = { domain: result, tenant, expiresAt: Date.now() + CACHE_TTL_MS };
      cache.set(host, entry);
      return entry;
    } catch (e) {
      console.error('fetchDomain error for host', host, e);
      return null;
    } finally {
      pending.delete(host);
    }
  })();
  pending.set(host, prom);
  return prom;
}

export async function tenantResolver(req: Request, res: Response, next: NextFunction) {
  if (process.env.MULTI_TENANCY !== 'true') return next();

  // Allow explicit override via custom header when calling cross-origin without a reverse proxy
  const overrideHost =
    normalizeHost(req.headers['x-tenant-domain'] as any) ||
    normalizeHost((req.query as any)?.domain);
  const overrideSlug = (req.headers['x-tenant-slug'] as string | undefined)?.toString().trim() || undefined;
  const overrideTenantId = (req.headers['x-tenant-id'] as string | undefined)?.toString().trim() || undefined;
  const host = overrideHost || normalizeHost(req.headers['x-forwarded-host'] || req.headers.host);
  if (!host) {
    return res.status(400).json({ code: 'HOST_HEADER_REQUIRED', message: 'Host header missing for tenant resolution' });
  }
  try {
    // 1) Try exact domain match
    let data = await fetchDomain(host);

    // 2) Fall back: slug or tenantId override
    if (!data && (overrideSlug || overrideTenantId)) {
      const tenant = overrideTenantId
        ? await p.tenant.findUnique({ where: { id: overrideTenantId }, include: tenantInclude }).catch(() => null)
        : await p.tenant.findUnique({ where: { slug: overrideSlug }, include: tenantInclude }).catch(() => null);
      if (tenant) {
        (tenant as any).displayName = getTenantDisplayName(tenant);
        (tenant as any).primaryLanguage = getTenantPrimaryLanguageInfo(tenant);
        const dom = await p.domain.findFirst({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => null);
        if (dom) {
          data = { domain: dom, tenant, expiresAt: Date.now() + CACHE_TTL_MS };
        }
      }
    }

    // 3) Dev/local fallback for localhost/127.0.0.1: use any active domain
    if (!data && (host === 'localhost' || host === '127.0.0.1')) {
      const dom = await p.domain.findFirst({ where: { status: 'ACTIVE' }, include: { tenant: { include: tenantInclude } }, orderBy: { createdAt: 'desc' } }).catch(() => null);
      if (dom) {
        (dom.tenant as any).displayName = getTenantDisplayName(dom.tenant);
        (dom.tenant as any).primaryLanguage = getTenantPrimaryLanguageInfo(dom.tenant);
        data = { domain: dom, tenant: dom.tenant, expiresAt: Date.now() + CACHE_TTL_MS };
      }
    }

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
