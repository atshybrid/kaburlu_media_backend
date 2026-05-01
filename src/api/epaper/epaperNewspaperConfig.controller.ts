/**
 * ePaper Newspaper Config Controller
 *
 * Manages per-tenant publication settings:
 *  - Paper type, page count, logos, header style numbers
 *  - PRGI number, footer text, per-page cost
 *  - Volume / issue auto-numbering from start dates
 *  - News close time (articles window for each print issue)
 *
 * GET  /epaper/newspaper-config   → stored config + computed daily values
 * PUT  /epaper/newspaper-config   → upsert config
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { resolveAdminTenantContext } from './adminTenantContext';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse "HH:MM" string into { hours, minutes }.
 * Falls back to { hours: 23, minutes: 0 } on invalid input.
 */
function parseHHMM(time: string): { hours: number; minutes: number } {
  const [hh, mm] = (time || '23:00').split(':').map(Number);
  const hours = Number.isFinite(hh) && hh >= 0 && hh <= 23 ? hh : 23;
  const minutes = Number.isFinite(mm) && mm >= 0 && mm <= 59 ? mm : 0;
  return { hours, minutes };
}

/**
 * Return the current date-time in IST as a Date object.
 * IST = UTC+5:30
 */
function nowIST(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + 5.5 * 60 * 60_000); // +5:30
}

/**
 * Compute current volume, current issue, and news collection window for today.
 */
function computeDailyValues(config: {
  volumeStartNumber: number;
  volumeStartDate: Date;
  issueStartNumber: number;
  issueStartDate: Date;
  newsCloseTime: string;
}) {
  const todayIST = nowIST();
  const todayYear = todayIST.getFullYear();
  const todayMonth = todayIST.getMonth();
  const todayDay = todayIST.getDate();

  // Volume: increments by 1 for each calendar year after volumeStartDate's year
  const startYear = new Date(config.volumeStartDate).getFullYear();
  const currentVolume = config.volumeStartNumber + (todayYear - startYear);

  // Issue: increments by 1 for each calendar day since issueStartDate
  const issueStart = new Date(config.issueStartDate);
  const issueStartNorm = Date.UTC(
    issueStart.getFullYear(),
    issueStart.getMonth(),
    issueStart.getDate()
  );
  const todayNorm = Date.UTC(todayYear, todayMonth, todayDay);
  const daysSince = Math.floor((todayNorm - issueStartNorm) / 86_400_000);
  const currentIssue = config.issueStartNumber + Math.max(0, daysSince);

  // News window: 00:00 IST → newsCloseTime IST (expressed as UTC)
  const { hours: closeH, minutes: closeM } = parseHHMM(config.newsCloseTime);

  // IST midnight of today = UTC (today - 5:30) = previous day 18:30 UTC
  const fromUtc = new Date(
    Date.UTC(todayYear, todayMonth, todayDay) - 5.5 * 60 * 60_000
  );
  const toUtc = new Date(
    Date.UTC(todayYear, todayMonth, todayDay, closeH, closeM) -
      5.5 * 60 * 60_000
  );

  // ISO strings with +05:30 offset for display
  const toIST8601 = (utc: Date, isoH: number, isoM: number) => {
    const yyyy = todayYear;
    const mm = String(todayMonth + 1).padStart(2, '0');
    const dd = String(todayDay).padStart(2, '0');
    const hh = String(isoH).padStart(2, '0');
    const min = String(isoM).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:00+05:30`;
  };

  const fromIST = toIST8601(fromUtc, 0, 0);
  const toIST = toIST8601(toUtc, closeH, closeM);

  const issueDate = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

  return {
    issueDate,
    currentVolume,
    currentIssue,
    newsWindow: {
      fromDate: fromIST,
      toDate: toIST,
      fromUtc: fromUtc.toISOString(),
      toUtc: toUtc.toISOString(),
    },
  };
}

// ============================================================================
// GET
// ============================================================================

/**
 * @swagger
 * /epaper/newspaper-config:
 *   get:
 *     summary: Get newspaper publication config for the tenant
 *     description: Returns stored config plus computed daily values (current volume, issue number, news window).
 *     tags: [ePaper - Newspaper Config]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Config + today's computed values
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 config:
 *                   $ref: '#/components/schemas/EpaperNewspaperConfig'
 *                 today:
 *                   $ref: '#/components/schemas/EpaperNewspaperConfigToday'
 *       404:
 *         description: No config found for this tenant
 */
export async function getNewspaperConfig(req: Request, res: Response) {
  const ctx = await resolveAdminTenantContext(req);
  if (!ctx.tenantId) {
    return res.status(400).json({ error: 'Tenant context required' });
  }

  const config = await prisma.epaperNewspaperConfig.findUnique({
    where: { tenantId: ctx.tenantId },
  });

  if (!config) {
    return res.status(404).json({ error: 'Newspaper config not found. Use PUT to create one.' });
  }

  const today = computeDailyValues(config);

  return res.json({ config, today });
}

// ============================================================================
// UPSERT
// ============================================================================

/**
 * @swagger
 * /epaper/newspaper-config:
 *   put:
 *     summary: Create or update newspaper publication config
 *     description: Upserts the newspaper config for the tenant. All fields are optional on update.
 *     tags: [ePaper - Newspaper Config]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EpaperNewspaperConfigInput'
 *     responses:
 *       200:
 *         description: Upserted config + today's computed values
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 config:
 *                   $ref: '#/components/schemas/EpaperNewspaperConfig'
 *                 today:
 *                   $ref: '#/components/schemas/EpaperNewspaperConfigToday'
 *       400:
 *         description: Validation error
 */
export async function upsertNewspaperConfig(req: Request, res: Response) {
  const ctx = await resolveAdminTenantContext(req);
  if (!ctx.tenantId) {
    return res.status(400).json({ error: 'Tenant context required' });
  }

  const {
    paperType,
    pageCount,
    perPageCost,
    mainLogoUrl,
    subHeaderLogoUrl,
    headerStyleNumber,
    subHeaderStyleNumber,
    prgiNumber,
    lastPageFooterText,
    volumeStartNumber,
    volumeStartDate,
    issueStartNumber,
    issueStartDate,
    newsCloseTime,
  } = req.body as Record<string, any>;

  // Validate newsCloseTime format if provided
  if (newsCloseTime !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(newsCloseTime)) {
      return res.status(400).json({ error: 'newsCloseTime must be HH:MM (24h) format, e.g. "23:00"' });
    }
  }

  // Build the data object — only include defined fields
  const data: Record<string, any> = {};
  if (paperType !== undefined) data.paperType = String(paperType);
  if (pageCount !== undefined) data.pageCount = Number(pageCount);
  if (perPageCost !== undefined) data.perPageCost = perPageCost === null ? null : Number(perPageCost);
  if (mainLogoUrl !== undefined) data.mainLogoUrl = mainLogoUrl ?? null;
  if (subHeaderLogoUrl !== undefined) data.subHeaderLogoUrl = subHeaderLogoUrl ?? null;
  if (headerStyleNumber !== undefined) data.headerStyleNumber = Number(headerStyleNumber);
  if (subHeaderStyleNumber !== undefined) data.subHeaderStyleNumber = Number(subHeaderStyleNumber);
  if (prgiNumber !== undefined) data.prgiNumber = prgiNumber ?? null;
  if (lastPageFooterText !== undefined) data.lastPageFooterText = lastPageFooterText ?? null;
  if (volumeStartNumber !== undefined) data.volumeStartNumber = Number(volumeStartNumber);
  if (volumeStartDate !== undefined) data.volumeStartDate = new Date(volumeStartDate);
  if (issueStartNumber !== undefined) data.issueStartNumber = Number(issueStartNumber);
  if (issueStartDate !== undefined) data.issueStartDate = new Date(issueStartDate);
  if (newsCloseTime !== undefined) data.newsCloseTime = newsCloseTime;

  // For create, volumeStartDate and issueStartDate are required
  const existing = await prisma.epaperNewspaperConfig.findUnique({
    where: { tenantId: ctx.tenantId },
  });

  if (!existing) {
    if (!volumeStartDate) {
      return res.status(400).json({ error: 'volumeStartDate is required when creating config' });
    }
    if (!issueStartDate) {
      return res.status(400).json({ error: 'issueStartDate is required when creating config' });
    }
  }

  const config = await prisma.epaperNewspaperConfig.upsert({
    where: { tenantId: ctx.tenantId },
    create: {
      tenantId: ctx.tenantId,
      volumeStartDate: new Date(volumeStartDate),
      issueStartDate: new Date(issueStartDate),
      ...data,
    },
    update: data,
  });

  const today = computeDailyValues(config);

  return res.json({ config, today });
}

// ============================================================================
// SWAGGER SCHEMAS
// ============================================================================

/**
 * @swagger
 * components:
 *   schemas:
 *     EpaperNewspaperConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         tenantId:
 *           type: string
 *         paperType:
 *           type: string
 *           enum: [BROADSHEET, TABLOID, BERLINER, MAGAZINE]
 *         pageCount:
 *           type: integer
 *         perPageCost:
 *           type: number
 *           nullable: true
 *         mainLogoUrl:
 *           type: string
 *           nullable: true
 *         subHeaderLogoUrl:
 *           type: string
 *           nullable: true
 *         headerStyleNumber:
 *           type: integer
 *         subHeaderStyleNumber:
 *           type: integer
 *         prgiNumber:
 *           type: string
 *           nullable: true
 *         lastPageFooterText:
 *           type: string
 *           nullable: true
 *         volumeStartNumber:
 *           type: integer
 *         volumeStartDate:
 *           type: string
 *           format: date
 *         issueStartNumber:
 *           type: integer
 *         issueStartDate:
 *           type: string
 *           format: date
 *         newsCloseTime:
 *           type: string
 *           example: "23:00"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     EpaperNewspaperConfigToday:
 *       type: object
 *       properties:
 *         issueDate:
 *           type: string
 *           format: date
 *           example: "2026-05-01"
 *         currentVolume:
 *           type: integer
 *           example: 3
 *         currentIssue:
 *           type: integer
 *           example: 487
 *         newsWindow:
 *           type: object
 *           properties:
 *             fromDate:
 *               type: string
 *               example: "2026-05-01T00:00:00+05:30"
 *             toDate:
 *               type: string
 *               example: "2026-05-01T23:00:00+05:30"
 *             fromUtc:
 *               type: string
 *               format: date-time
 *             toUtc:
 *               type: string
 *               format: date-time
 *     EpaperNewspaperConfigInput:
 *       type: object
 *       properties:
 *         paperType:
 *           type: string
 *           enum: [BROADSHEET, TABLOID, BERLINER, MAGAZINE]
 *         pageCount:
 *           type: integer
 *         perPageCost:
 *           type: number
 *           nullable: true
 *         mainLogoUrl:
 *           type: string
 *           nullable: true
 *         subHeaderLogoUrl:
 *           type: string
 *           nullable: true
 *         headerStyleNumber:
 *           type: integer
 *         subHeaderStyleNumber:
 *           type: integer
 *         prgiNumber:
 *           type: string
 *           nullable: true
 *         lastPageFooterText:
 *           type: string
 *           nullable: true
 *         volumeStartNumber:
 *           type: integer
 *         volumeStartDate:
 *           type: string
 *           format: date
 *           description: Required on first create
 *         issueStartNumber:
 *           type: integer
 *         issueStartDate:
 *           type: string
 *           format: date
 *           description: Required on first create
 *         newsCloseTime:
 *           type: string
 *           example: "23:00"
 *           description: HH:MM 24-hour format (IST)
 */
