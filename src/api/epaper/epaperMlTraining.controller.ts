import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { resolveAdminTenantContext } from './adminTenantContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const VALID_LAYOUT_STYLES = ['broadsheet', 'tabloid', 'berliner', 'magazine', 'other'];

function parseDateOnly(value: unknown): { y: number; m: number; d: number } | null {
  const s = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

// ============================================================================
// POST /epaper/ml-training/samples
// ============================================================================

export const createMlTrainingSample = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);

    const body = req.body as {
      pdfUrl?: string;
      issueDate?: string;
      layoutStyle?: string;
      columns?: unknown;
      language?: string;
      fileName?: string;
      tenantId?: string;
    };

    // --- Validate required fields ---
    const missing: string[] = [];
    if (!body.pdfUrl?.trim()) missing.push('pdfUrl');
    if (!body.issueDate?.trim()) missing.push('issueDate');
    if (!body.layoutStyle?.trim()) missing.push('layoutStyle');
    if (body.columns === undefined || body.columns === null || body.columns === '') missing.push('columns');
    if (!body.language?.trim()) missing.push('language');
    if (!body.fileName?.trim()) missing.push('fileName');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    // --- Validate layoutStyle ---
    const layoutStyle = String(body.layoutStyle).trim().toLowerCase();
    if (!VALID_LAYOUT_STYLES.includes(layoutStyle)) {
      return res.status(400).json({
        error: `layoutStyle must be one of: ${VALID_LAYOUT_STYLES.join(', ')}`,
      });
    }

    // --- Validate columns ---
    const columns = Number(body.columns);
    if (!Number.isInteger(columns) || columns < 3 || columns > 8) {
      return res.status(400).json({ error: 'columns must be an integer between 3 and 8' });
    }

    // --- Validate issueDate ---
    const issueDateParts = parseDateOnly(body.issueDate);
    if (!issueDateParts) {
      return res.status(400).json({ error: 'issueDate must be in YYYY-MM-DD format' });
    }
    const issueDateTime = new Date(Date.UTC(issueDateParts.y, issueDateParts.m - 1, issueDateParts.d));

    // --- Resolve tenantId (optional field) ---
    // SUPER_ADMIN can pass tenantId in body; others get their own tenantId from ctx
    const tenantId = ctx.isSuperAdmin
      ? (body.tenantId?.trim() || ctx.tenantId || null)
      : (ctx.tenantId || null);

    const createdById = (req.user as any)?.id ?? null;
    const pdfUrl = body.pdfUrl!.trim();
    const fileName = body.fileName!.trim();
    const language = body.language!.trim();

    // --- Check for duplicate pdfUrl (409) ---
    const existing = await p.epaperMlTrainingSample.findUnique({
      where: { pdfUrl },
      select: { id: true },
    }).catch(() => null);

    if (existing) {
      return res.status(409).json({ error: 'A training sample with this pdfUrl is already registered' });
    }

    const sample = await p.epaperMlTrainingSample.create({
      data: {
        tenantId,
        pdfUrl,
        fileName,
        issueDate: issueDateTime,
        layoutStyle,
        columns,
        language,
        status: 'pending_processing',
        createdById,
      },
      select: {
        id: true,
        pdfUrl: true,
        fileName: true,
        issueDate: true,
        layoutStyle: true,
        columns: true,
        language: true,
        status: true,
        tenantId: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      id: sample.id,
      pdfUrl: sample.pdfUrl,
      fileName: sample.fileName,
      issueDate: sample.issueDate,
      layoutStyle: sample.layoutStyle,
      columns: sample.columns,
      language: sample.language,
      tenantId: sample.tenantId,
      status: sample.status,
      createdAt: sample.createdAt,
    });
  } catch (e: any) {
    console.error('[mlTraining] createMlTrainingSample:', e);
    return res.status(500).json({ error: 'Failed to register training sample', details: String(e?.message ?? e) });
  }
};

// ============================================================================
// GET /epaper/ml-training/samples
// ============================================================================

export const listMlTrainingSamples = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);

    const q = req.query as Record<string, string | undefined>;

    // Pagination
    const page = Math.max(1, parseInt(q.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || '20', 10) || 20));
    const skip = (page - 1) * limit;

    // Filters
    const where: Record<string, unknown> = {};

    // Tenant filter: SUPER_ADMIN can filter by tenantId query param; others scoped to their own
    if (ctx.isSuperAdmin) {
      if (q.tenantId) where.tenantId = q.tenantId.trim();
    } else if (ctx.tenantId) {
      where.tenantId = ctx.tenantId;
    }

    if (q.layoutStyle) where.layoutStyle = String(q.layoutStyle).trim().toLowerCase();
    if (q.language) where.language = q.language.trim();
    if (q.status) where.status = q.status.trim();

    const [items, total] = await Promise.all([
      p.epaperMlTrainingSample.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          pdfUrl: true,
          fileName: true,
          issueDate: true,
          layoutStyle: true,
          columns: true,
          language: true,
          status: true,
          tenantId: true,
          createdAt: true,
        },
      }),
      p.epaperMlTrainingSample.count({ where }),
    ]);

    return res.json({ items, total, page, limit });
  } catch (e: any) {
    console.error('[mlTraining] listMlTrainingSamples:', e);
    return res.status(500).json({ error: 'Failed to list training samples', details: String(e?.message ?? e) });
  }
};
