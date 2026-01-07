import { Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';

// Require the authenticated user to have role.name === 'SUPER_ADMIN'
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user: any = (req as any).user;
    if (!user || !user.role || user.role.name !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Superadmin only' });
    }
    return next();
  } catch (e: any) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Allow SUPER_ADMIN universally OR TENANT_ADMIN scoped to a specific tenant (via reporter profile tenantId match).
// Expects req.params.tenantId. If TENANT_ADMIN has no reporter profile or tenant mismatch => 403.
export async function requireSuperOrTenantAdminScoped(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req.params as any).tenantId || (req.params as any).id; // fallback if route uses :id for tenant
    if (!tenantId) return res.status(400).json({ error: 'tenantId param required' });
    const user: any = (req as any).user;
    if (!user || !user.role) return res.status(401).json({ error: 'Unauthorized' });
    const roleName = user.role.name;
    if (roleName === 'SUPER_ADMIN') return next();
    if (roleName !== 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden: TENANT_ADMIN or SUPER_ADMIN only' });
    // Resolve reporter profile -> tenant linkage
    const reporter = await (prisma as any).reporter.findFirst({ where: { userId: user.id }, select: { tenantId: true } }).catch(() => null);
    if (!reporter) return res.status(403).json({ error: 'TENANT_ADMIN profile missing reporter linkage' });
    if (reporter.tenantId !== tenantId) return res.status(403).json({ error: 'Tenant scope mismatch' });
    return next();
  } catch (e: any) {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

// Allow SUPER_ADMIN or TENANT_ADMIN without scoping (for endpoints where tenant scope is implicit or separate).
export function requireSuperOrTenantAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user: any = (req as any).user;
    if (!user || !user.role) return res.status(401).json({ error: 'Unauthorized' });
    const roleName = user.role.name;
    if (roleName === 'SUPER_ADMIN' || roleName === 'TENANT_ADMIN') return next();
    return res.status(403).json({ error: 'Forbidden: TENANT_ADMIN or SUPER_ADMIN only' });
  } catch {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

// Allow SUPER_ADMIN, TENANT_ADMIN, or REPORTER
export function requireReporterOrAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user: any = (req as any).user;
    if (!user || !user.role) return res.status(401).json({ error: 'Unauthorized' });
    const roleName = user.role.name;
    if (
      roleName === 'SUPER_ADMIN' ||
      roleName === 'SUPERADMIN' ||
      roleName === 'TENANT_ADMIN' ||
      roleName === 'TENANT_EDITOR' ||
      roleName === 'CHIEF_EDITOR' ||
      roleName === 'DESK_EDITOR' ||
      roleName === 'ADMIN_EDITOR' ||
      roleName === 'NEWS_MODERATOR' ||
      roleName === 'NEWS_DESK' ||
      roleName === 'NEWS_DESK_ADMIN' ||
      roleName === 'REPORTER'
    ) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Reporter or Admin only' });
  } catch {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}
