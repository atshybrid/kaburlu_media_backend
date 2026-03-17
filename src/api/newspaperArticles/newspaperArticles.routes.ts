import { Router, Request, Response } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

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

function formatIstDateFromUtcDate(date: Date): string {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIstDate(input: string): { y: number; m: number; d: number } | null {
  const s = String(input || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function addDaysToIstDate(dateStr: string, days: number): string {
  const parts = parseIstDate(dateStr);
  if (!parts) return dateStr;
  const utc = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 0, 0, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function istLocalToUtc(dateStr: string, hh: number, mm: number, ss = 0, ms = 0): Date {
  const parts = parseIstDate(dateStr);
  if (!parts) return new Date(NaN);
  const utcMs = Date.UTC(parts.y, parts.m - 1, parts.d, hh, mm, ss, ms) - IST_OFFSET_MS;
  return new Date(utcMs);
}

function getCurrentIstTimeParts(now: Date): { hours: number; minutes: number } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return { hours: ist.getUTCHours(), minutes: ist.getUTCMinutes() };
}

type SmartTimeRule = 'today' | 'epaper' | 'auto';

function buildTimeWindow(ruleRaw: string | undefined, businessDateRaw: string | undefined) {
  const now = new Date();
  const currentIstDate = formatIstDateFromUtcDate(now);
  const businessDate = parseIstDate(String(businessDateRaw || '').trim())
    ? String(businessDateRaw).trim()
    : currentIstDate;

  const requestedRule = String(ruleRaw || 'auto').trim().toLowerCase();
  const normalizedRule: SmartTimeRule = requestedRule === 'today' || requestedRule === 'epaper' || requestedRule === 'auto'
    ? (requestedRule as SmartTimeRule)
    : 'auto';

  let effectiveRule: Exclude<SmartTimeRule, 'auto'> = 'today';
  if (normalizedRule === 'epaper' || normalizedRule === 'today') {
    effectiveRule = normalizedRule;
  } else {
    const nowIst = getCurrentIstTimeParts(now);
    const totalMinutes = nowIst.hours * 60 + nowIst.minutes;
    effectiveRule = totalMinutes < 4 * 60 ? 'epaper' : 'today';
  }

  let startAtUtc: Date;
  let endAtUtc: Date;
  let startDateIst = businessDate;
  let endDateIst = businessDate;
  let startTimeIst = '00:00:00';
  let endTimeIst = '23:30:59';

  if (effectiveRule === 'today') {
    startAtUtc = istLocalToUtc(businessDate, 0, 0, 0, 0);
    endAtUtc = istLocalToUtc(businessDate, 23, 30, 59, 999);
  } else {
    startDateIst = addDaysToIstDate(businessDate, -1);
    endDateIst = businessDate;
    startTimeIst = '19:00:00';
    endTimeIst = '04:00:00';
    startAtUtc = istLocalToUtc(startDateIst, 19, 0, 0, 0);
    endAtUtc = istLocalToUtc(endDateIst, 4, 0, 0, 0);
  }

  return {
    businessDate,
    requestedRule: normalizedRule,
    effectiveRule,
    startAtUtc,
    endAtUtc,
    startAtIst: `${startDateIst}T${startTimeIst}+05:30`,
    endAtIst: `${endDateIst}T${endTimeIst}+05:30`,
  };
}

function priorityBucket(priority: number): 'p1' | 'p2' | 'p3' | 'others' {
  if (priority === 1) return 'p1';
  if (priority === 2) return 'p2';
  if (priority === 3) return 'p3';
  return 'others';
}

function parseMediaImages(row: any): Array<{ url: string; caption: string | null; alt: string | null }> {
  const urls = Array.isArray(row?.mediaUrls) ? row.mediaUrls.map((u: any) => String(u || '').trim()).filter(Boolean) : [];
  const captions = Array.isArray(row?.mediaCaptions) ? row.mediaCaptions : [];
  const metaRaw = Array.isArray(row?.mediaMeta) ? row.mediaMeta : [];
  const metaByUrl = new Map<string, any>();

  for (const m of metaRaw) {
    const url = String(m?.url || '').trim();
    if (!url) continue;
    metaByUrl.set(url, m);
  }

  return urls.map((url: string, idx: number) => {
    const meta = metaByUrl.get(url);
    const caption = meta?.caption != null && String(meta.caption).trim()
      ? String(meta.caption).trim()
      : (captions[idx] != null && String(captions[idx]).trim() ? String(captions[idx]).trim() : null);
    const alt = meta?.alt != null && String(meta.alt).trim() ? String(meta.alt).trim() : null;
    return { url, caption, alt };
  });
}

async function resolveSmartTenantAccess(req: Request): Promise<{ ok: true; tenantId: string } | { ok: false; status: number; error: string }> {
  const user: any = (req as any).user;
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' };

  const tenantId = String((req.query as any).tenantId || '').trim();
  if (!tenantId) {
    return { ok: false, status: 400, error: 'tenantId is required' };
  }

  const roleName = String(user?.role?.name || '').toUpperCase();
  if (roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN') {
    return { ok: true, tenantId };
  }

  // If this token belongs to a user linked to a tenant reporter profile,
  // enforce that same tenant to avoid cross-tenant leaks.
  const linkedReporter = await (prisma as any).reporter
    .findFirst({ where: { userId: user.id }, select: { tenantId: true } })
    .catch(() => null);

  if (linkedReporter?.tenantId && String(linkedReporter.tenantId) !== tenantId) {
    return { ok: false, status: 403, error: 'Tenant scope mismatch for this token' };
  }

  return { ok: true, tenantId };
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

/**
 * @swagger
 * /newspaper-articles/smart-get:
 *   get:
 *     summary: Smart tenant-wise newspaper articles (district -> reporter -> priority)
 *     description: |
 *       Smart GET endpoint for newspaper dashboard cards.
 *
 *       Features:
 *       - Accepts any valid JWT token (with tenant safety checks)
 *       - Strict tenant filter via `tenantId`
 *       - India-time windows:
 *         - `today`: 12:00 AM to 11:30:59 PM IST
 *         - `epaper`: previous day 7:00 PM to business date 4:00 AM IST
 *         - `auto`: before 4:00 AM IST => `epaper`, otherwise `today`
 *       - Returns grouped response: district -> reporter -> priority buckets
 *     tags: [News Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: timeRule
 *         schema:
 *           type: string
 *           enum: [auto, today, epaper]
 *           default: auto
 *       - in: query
 *         name: businessDate
 *         schema: { type: string, format: date, example: '2026-03-17' }
 *         description: IST business date for window calculations
 *       - in: query
 *         name: status
 *         schema: { type: string, default: PUBLISHED }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 1000, default: 500 }
 *     responses:
 *       200:
 *         description: Structured smart response
 */
router.get('/smart-get', auth, async (req: Request, res: Response) => {
  try {
    const access = await resolveSmartTenantAccess(req);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const statusRaw = String((req.query as any).status || 'PUBLISHED').trim().toUpperCase();
    const statusFilter = statusRaw === 'ALL' ? null : statusRaw;

    const limitRaw = parseIntOrNull((req.query as any).limit);
    const take = limitRaw && limitRaw > 0 ? Math.min(limitRaw, 1000) : 500;

    const businessDateRaw = String((req.query as any).businessDate || '').trim();
    if (businessDateRaw && !parseIstDate(businessDateRaw)) {
      return res.status(400).json({ error: 'businessDate must be YYYY-MM-DD (IST date)' });
    }

    const window = buildTimeWindow(String((req.query as any).timeRule || 'auto'), businessDateRaw || undefined);

    const where: any = {
      tenantId: access.tenantId,
      createdAt: {
        gte: window.startAtUtc,
        lte: window.endAtUtc,
      },
    };
    if (statusFilter) where.status = statusFilter;

    const rows = await (prisma as any).newspaperArticle.findMany({
      where,
      orderBy: [{ priority: 'asc' as const }, { createdAt: 'desc' as const }],
      take,
      include: {
        author: {
          select: {
            id: true,
            mobileNumber: true,
            email: true,
            profile: { select: { fullName: true } },
            reporterProfile: {
              select: {
                id: true,
                level: true,
                tenantId: true,
                profilePhotoUrl: true,
                designation: { select: { id: true, name: true, nativeName: true, code: true } },
                state: { select: { id: true, name: true } },
                district: { select: { id: true, name: true } },
                mandal: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const districtIds: string[] = Array.from(new Set(rows.map((r: any) => String(r?.districtId || '').trim()).filter(Boolean)));
    const districtRows = districtIds.length
      ? await prisma.district.findMany({ where: { id: { in: districtIds } }, select: { id: true, name: true } })
      : [];
    const districtNameById = new Map<string, string>(districtRows.map((d: any) => [String(d.id), String(d.name)]));

    const districtMap = new Map<string, any>();

    for (const row of rows as any[]) {
      const districtId = String(row?.districtId || '').trim();
      const districtKey = districtId || 'unknown';
      const districtName = districtId
        ? (districtNameById.get(districtId) || String(row?.author?.reporterProfile?.district?.name || row?.placeName || 'Unknown District'))
        : String(row?.placeName || row?.author?.reporterProfile?.district?.name || 'Unknown District');

      if (!districtMap.has(districtKey)) {
        districtMap.set(districtKey, {
          districtId: districtId || null,
          districtName,
          totalArticles: 0,
          reportersMap: new Map<string, any>(),
        });
      }

      const districtNode = districtMap.get(districtKey);
      districtNode.totalArticles += 1;

      const reporterId = String(row?.author?.reporterProfile?.id || row?.authorId || '').trim() || 'unknown';
      if (!districtNode.reportersMap.has(reporterId)) {
        districtNode.reportersMap.set(reporterId, {
          reporterId: row?.author?.reporterProfile?.id || null,
          userId: row?.authorId || null,
          name: String(row?.author?.profile?.fullName || '').trim() || 'Unknown Reporter',
          mobileNumber: row?.author?.mobileNumber || null,
          email: row?.author?.email || null,
          profilePhotoUrl: row?.author?.reporterProfile?.profilePhotoUrl || null,
          designation: row?.author?.reporterProfile?.designation
            ? {
              id: row.author.reporterProfile.designation.id,
              code: row.author.reporterProfile.designation.code,
              name: row.author.reporterProfile.designation.name,
              nativeName: row.author.reporterProfile.designation.nativeName || null,
            }
            : null,
          coverage: {
            state: row?.author?.reporterProfile?.state || null,
            district: row?.author?.reporterProfile?.district || null,
            mandal: row?.author?.reporterProfile?.mandal || null,
          },
          totalArticles: 0,
          priorityWise: {
            p1: [] as any[],
            p2: [] as any[],
            p3: [] as any[],
            others: [] as any[],
          },
        });
      }

      const reporterNode = districtNode.reportersMap.get(reporterId);
      reporterNode.totalArticles += 1;

      const articlePriority = Number(row?.priority ?? 0);
      const mediaImages = parseMediaImages(row);
      const bucket = priorityBucket(articlePriority);

      reporterNode.priorityWise[bucket].push({
        id: row.id,
        priority: articlePriority,
        status: row.status,
        title: row.title,
        subTitle: row.subTitle,
        highlights: Array.isArray(row.points) ? row.points : [],
        dateline: row.dateline,
        content: row.content,
        lead: row.lead || null,
        placeName: row.placeName || null,
        location: {
          stateId: row.stateId || null,
          districtId: row.districtId || null,
          mandalId: row.mandalId || null,
          villageId: row.villageId || null,
        },
        media: {
          featuredImageUrl: row.featuredImageUrl || (mediaImages[0]?.url || null),
          images: mediaImages,
        },
        important: {
          wordCount: row.wordCount ?? null,
          charCount: row.charCount ?? null,
          isBreaking: Boolean(row.isBreaking),
        },
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    }

    const districts = Array.from(districtMap.values()).map((districtNode: any) => {
      const reporters = Array.from(districtNode.reportersMap.values())
        .map((r: any) => ({
          reporterId: r.reporterId,
          userId: r.userId,
          name: r.name,
          mobileNumber: r.mobileNumber,
          email: r.email,
          profilePhotoUrl: r.profilePhotoUrl,
          designation: r.designation,
          coverage: r.coverage,
          totalArticles: r.totalArticles,
          priorityWise: r.priorityWise,
        }))
        .sort((a: any, b: any) => b.totalArticles - a.totalArticles);

      return {
        districtId: districtNode.districtId,
        districtName: districtNode.districtName,
        totalArticles: districtNode.totalArticles,
        reporters,
      };
    }).sort((a: any, b: any) => b.totalArticles - a.totalArticles);

    const reporterCount = districts.reduce((sum: number, d: any) => sum + d.reporters.length, 0);
    const articleCount = districts.reduce((sum: number, d: any) => sum + d.totalArticles, 0);

    return res.json({
      success: true,
      tenantId: access.tenantId,
      timeWindow: {
        timezone: 'Asia/Kolkata',
        businessDate: window.businessDate,
        requestedRule: window.requestedRule,
        effectiveRule: window.effectiveRule,
        startAtIst: window.startAtIst,
        endAtIst: window.endAtIst,
        startAtUtc: window.startAtUtc.toISOString(),
        endAtUtc: window.endAtUtc.toISOString(),
      },
      filters: {
        status: statusFilter || 'ALL',
        limit: take,
      },
      summary: {
        districtCount: districts.length,
        reporterCount,
        articleCount,
      },
      districts,
    });
  } catch (e) {
    console.error('newspaper smart-get error', e);
    return res.status(500).json({ error: 'Failed to fetch smart newspaper data' });
  }
});

export default router;
