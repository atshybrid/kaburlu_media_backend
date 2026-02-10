import { Router, Request, Response } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

type AccessScope =
  | { ok: true; roleName: string; tenantId: string; authorId: string | null; mode: 'super' | 'tenant' | 'reporter' }
  | { ok: false; status: number; error: string };

async function resolveAccessScope(req: Request): Promise<AccessScope> {
  const user: any = (req as any).user;
  const roleName = String(user?.role?.name || '').toUpperCase();
  if (!roleName) return { ok: false, status: 401, error: 'Unauthorized' };

  const isSuper = roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN';
  if (isSuper) {
    const tenantId = String((req.query as any).tenantId || '').trim();
    if (!tenantId) return { ok: false, status: 400, error: 'tenantId is required for SUPER_ADMIN' };
    return { ok: true, roleName, tenantId, authorId: null, mode: 'super' };
  }

  const isTenantEditor = roleName === 'DESK_EDITOR' || roleName === 'TENANT_ADMIN';
  const isReporter = roleName === 'REPORTER';
  if (!isTenantEditor && !isReporter) {
    return { ok: false, status: 403, error: 'Forbidden: requires SUPER_ADMIN, DESK_EDITOR, TENANT_ADMIN, or REPORTER' };
  }

  // For tenant/editor/reporters, resolve tenant from reporter profile linkage.
  const reporterProfile = await (prisma as any).reporter
    .findFirst({ where: { userId: user.id }, select: { tenantId: true } })
    .catch(() => null);

  const tenantId = String(reporterProfile?.tenantId || '').trim();
  if (!tenantId) {
    return { ok: false, status: 403, error: 'User has no reporter profile tenant linkage' };
  }

  const requestedTenantId = String((req.query as any).tenantId || '').trim();
  if (requestedTenantId && requestedTenantId !== tenantId) {
    return { ok: false, status: 403, error: 'Tenant scope mismatch' };
  }

  if (isReporter) {
    return { ok: true, roleName, tenantId, authorId: String(user.id), mode: 'reporter' };
  }

  return { ok: true, roleName, tenantId, authorId: null, mode: 'tenant' };
}

function parseIntOrNull(v: any): number | null {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseDateOrNull(v: any): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parsePagination(query: any): { page: number; pageSize: number } {
  const pageRaw = parseIntOrNull((query as any).page);
  const pageSizeRaw = parseIntOrNull((query as any).pageSize ?? (query as any).limit);
  const page = pageRaw && pageRaw > 0 ? pageRaw : 1;
  const pageSize = pageSizeRaw && pageSizeRaw > 0 ? Math.min(pageSizeRaw, 200) : 50;
  return { page, pageSize };
}

/**
 * @swagger
 * tags:
 *   name: News Room
 *   description: Newsroom administrative and reporting endpoints
 */

/**
 * @swagger
 * /newspaper-articles:
 *   get:
 *     summary: List NewspaperArticle by tenant with filters (SUPER_ADMIN / DESK_EDITOR / TENANT_ADMIN / REPORTER)
 *     description: |
 *       Returns records from the `NewspaperArticle` table.
 *
 *       **Access:** SUPER_ADMIN (and legacy alias SUPERADMIN), DESK_EDITOR, TENANT_ADMIN, REPORTER
 *
 *       **Tenant Scope:**
 *       - SUPER_ADMIN: must pass `tenantId`
 *       - DESK_EDITOR / TENANT_ADMIN: tenant is inferred from profile; `tenantId` (if passed) must match
 *       - REPORTER: tenant + author are inferred; only own articles returned
 *
 *       **Filters:**
 *       - Date range: `fromDate`, `toDate` (filters by `createdAt`)
 *       - Location: `stateId`, `districtId`, `mandalId`
 *       - Reporter-wise: `reporterId` (Reporter table id) or `authorId` (User id)
 *       - Character count range: `minCharCount`, `maxCharCount` (uses `charCount` column)
 *     tags: [News Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: Tenant ID (required for SUPER_ADMIN; optional for tenant-scoped roles)
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date-time }
 *         description: Start date/time (ISO). Uses `createdAt >= fromDate`.
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date-time }
 *         description: End date/time (ISO). Uses `createdAt <= toDate`.
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by status (DRAFT, PUBLISHED, etc.)
 *       - in: query
 *         name: stateId
 *         schema: { type: string }
 *       - in: query
 *         name: districtId
 *         schema: { type: string }
 *       - in: query
 *         name: mandalId
 *         schema: { type: string }
 *       - in: query
 *         name: reporterId
 *         schema: { type: string }
 *         description: Filter by Reporter.id (will be resolved to reporter.userId -> NewspaperArticle.authorId)
 *       - in: query
 *         name: authorId
 *         schema: { type: string }
 *         description: Filter by User.id directly (NewspaperArticle.authorId)
 *       - in: query
 *         name: minCharCount
 *         schema: { type: integer }
 *       - in: query
 *         name: maxCharCount
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200:
 *         description: Paginated NewspaperArticle list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', auth, async (req: Request, res: Response) => {
  const scope = await resolveAccessScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

  const tenantId = scope.tenantId;

  const status = String((req.query as any).status || '').trim();
  const stateId = String((req.query as any).stateId || '').trim();
  const districtId = String((req.query as any).districtId || '').trim();
  const mandalId = String((req.query as any).mandalId || '').trim();
  const reporterId = String((req.query as any).reporterId || '').trim();
  const authorIdRaw = String((req.query as any).authorId || '').trim();

  const fromDate = parseDateOrNull((req.query as any).fromDate);
  const toDate = parseDateOrNull((req.query as any).toDate);
  if ((req.query as any).fromDate && !fromDate) return res.status(400).json({ error: 'Invalid fromDate' });
  if ((req.query as any).toDate && !toDate) return res.status(400).json({ error: 'Invalid toDate' });

  const minCharCount = parseIntOrNull((req.query as any).minCharCount);
  const maxCharCount = parseIntOrNull((req.query as any).maxCharCount);
  if ((req.query as any).minCharCount && minCharCount === null) return res.status(400).json({ error: 'Invalid minCharCount' });
  if ((req.query as any).maxCharCount && maxCharCount === null) return res.status(400).json({ error: 'Invalid maxCharCount' });
  if (minCharCount !== null && maxCharCount !== null && minCharCount > maxCharCount) {
    return res.status(400).json({ error: 'minCharCount cannot be greater than maxCharCount' });
  }

  const { page, pageSize } = parsePagination(req.query);

  let authorId = scope.authorId;
  if (authorId) {
    // REPORTER mode: force to own articles regardless of query params
  } else {
    authorId = authorIdRaw || null;
    if (!authorId && reporterId) {
      const reporter = await (prisma as any).reporter.findUnique({ where: { id: reporterId }, select: { userId: true } }).catch(() => null);
      if (!reporter?.userId) {
        return res.status(404).json({ error: 'Reporter not found or has no linked userId', reporterId });
      }
      authorId = String(reporter.userId);
    }
  }

  const where: any = { tenantId };
  if (status) where.status = status;
  if (stateId) where.stateId = stateId;
  if (districtId) where.districtId = districtId;
  if (mandalId) where.mandalId = mandalId;
  if (authorId) where.authorId = authorId;

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDate) where.createdAt.lte = toDate;
  }

  if (minCharCount !== null || maxCharCount !== null) {
    where.charCount = {};
    if (minCharCount !== null) where.charCount.gte = minCharCount;
    if (maxCharCount !== null) where.charCount.lte = maxCharCount;
  }

  const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

  const [total, rows] = await Promise.all([
    (prisma as any).newspaperArticle.count({ where }).catch(() => 0),
    (prisma as any).newspaperArticle
      .findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
      .catch(() => []),
  ]);

  return res.json({
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    data: rows,
  });
});

export default router;
