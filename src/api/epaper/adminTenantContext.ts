import { Request } from 'express';
import prisma from '../../lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

export interface AdminTenantContext {
  tenantId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userId: string;
}

async function resolveTenantBySlugOrDomain(slug?: string | null, domain?: string | null): Promise<string | null> {
  const s = asString(slug || '');
  const d = asString(domain || '');
  if (s) {
    const t = await p.tenant.findUnique({ where: { slug: s }, select: { id: true } }).catch(() => null);
    if (t?.id) return t.id;
  }
  if (d) {
    const dom = await p.domain.findUnique({ where: { domain: d }, select: { tenantId: true, status: true } }).catch(() => null);
    if (dom && dom.status === 'ACTIVE' && dom.tenantId) return dom.tenantId;
  }
  return null;
}

export async function resolveAdminTenantContext(req: Request): Promise<AdminTenantContext> {
  const user = (req as any).user;
  const userId = asString(user?.id);
  const roleName = asString(user?.role?.name).toUpperCase();

  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || roleName === 'TENANT_ADMIN' || roleName === 'ADMIN_EDITOR' || roleName === 'DESK_EDITOR';

  // Base from reporter mapping when available (non-superadmin)
  let mappedTenantId: string | null = null;
  if (!isSuperAdmin && userId) {
    const reporter = await p.reporter.findFirst({ where: { userId }, select: { tenantId: true } });
    mappedTenantId = reporter?.tenantId || null;
  }

  // Collect overrides from query/body/headers
  const q = (req.query as any) || {};
  const b = (req.body as any) || {};
  const requestedTenantId = asString(q.tenantId || b.tenantId || req.headers['x-tenant-id']);
  const requestedTenantSlug = asString(req.headers['x-tenant-slug']);
  const requestedDomain = asString(req.headers['x-tenant-domain'] || q.domain);

  let resolvedTenantId: string | null = mappedTenantId;

  // 1) Explicit tenantId wins when allowed
  if (requestedTenantId) {
    if (isSuperAdmin) {
      resolvedTenantId = requestedTenantId;
    } else if (isAdmin) {
      // Admins can set tenantId only if they don't have a mapping, or it matches their mapping
      if (!mappedTenantId || mappedTenantId === requestedTenantId) {
        resolvedTenantId = requestedTenantId;
      } else {
        throw Object.assign(new Error('You cannot override tenantId'), { status: 403, code: 'TENANT_OVERRIDE_NOT_ALLOWED' });
      }
    }
  } else if (requestedTenantSlug || requestedDomain) {
    // 2) Slug/Domain resolution (useful for SUPER_ADMIN and unmapped admins)
    const id = await resolveTenantBySlugOrDomain(requestedTenantSlug || null, requestedDomain || null);
    if (id) {
      if (isSuperAdmin) {
        resolvedTenantId = id;
      } else if (isAdmin) {
        if (!mappedTenantId || mappedTenantId === id) {
          resolvedTenantId = id;
        } else {
          throw Object.assign(new Error('You cannot override tenantId'), { status: 403, code: 'TENANT_OVERRIDE_NOT_ALLOWED' });
        }
      }
    }
  }

  return { tenantId: resolvedTenantId, isAdmin, isSuperAdmin, userId };
}
