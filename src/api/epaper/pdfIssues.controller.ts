import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { convertPdfToPngPages } from '../../lib/pdfToPng';
import { deletePublicObject, putPublicObject } from '../../lib/objectStorage';
import { config } from '../../config/env';
import axios from 'axios';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendHttpError(res: Response, e: any, fallbackMessage: string) {
  if (e instanceof HttpError) {
    return res.status(e.status).json({ error: e.message, code: e.code });
  }
  if (e && typeof e === 'object' && typeof e.status === 'number') {
    return res.status(e.status).json({ error: String(e.message || fallbackMessage), code: e.code });
  }
  return res.status(500).json({ error: fallbackMessage, details: String(e?.message || e) });
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function parseIsoDateOnly(value: string): Date {
  const v = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error('issueDate must be YYYY-MM-DD');
  }
  // Use UTC midnight to avoid local timezone shifting.
  return new Date(`${v}T00:00:00.000Z`);
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '127.0.0.1' || h === '0.0.0.0') return true;
  if (h.startsWith('10.')) return true;
  if (h.startsWith('192.168.')) return true;
  if (h.startsWith('169.254.')) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function requireSafePublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    throw new HttpError(400, 'pdfUrl must be a valid URL', 'INVALID_URL');
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new HttpError(400, 'pdfUrl must use http/https', 'INVALID_URL_PROTOCOL');
  }
  if (!u.hostname) {
    throw new HttpError(400, 'pdfUrl hostname is required', 'INVALID_URL_HOST');
  }
  if (isPrivateOrLocalHost(u.hostname)) {
    throw new HttpError(400, 'pdfUrl host is not allowed', 'URL_HOST_NOT_ALLOWED');
  }

  return u;
}

async function downloadPdfToBuffer(pdfUrl: string, maxBytes: number): Promise<Buffer> {
  const u = requireSafePublicUrl(pdfUrl);

  const resp = await axios.get<ArrayBuffer>(u.toString(), {
    responseType: 'arraybuffer',
    timeout: Number(process.env.EPAPER_PDF_URL_FETCH_TIMEOUT_MS || 45000),
    maxRedirects: 5,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    validateStatus: (s) => s >= 200 && s < 300,
    headers: {
      // Some CDNs require a UA
      'User-Agent': 'KaburluMediaBackend/epaper-pdf-fetch',
      Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
    },
  });

  const contentType = String(resp.headers?.['content-type'] || '').toLowerCase();
  if (contentType && !contentType.includes('pdf') && !contentType.includes('octet-stream')) {
    throw new HttpError(400, 'pdfUrl did not return a PDF', 'URL_NOT_PDF');
  }

  const buf = Buffer.from(resp.data);
  if (!buf.length) throw new HttpError(400, 'Downloaded PDF is empty', 'EMPTY_PDF');
  if (buf.length > maxBytes) throw new HttpError(413, 'PDF too large', 'PDF_TOO_LARGE');

  // Quick signature check (best-effort)
  const head = buf.subarray(0, 8).toString('utf8');
  if (!head.startsWith('%PDF-')) {
    // Allow some edge cases, but usually indicates wrong file.
    throw new HttpError(400, 'pdfUrl response is not a valid PDF', 'INVALID_PDF');
  }

  return buf;
}

async function upsertPdfIssueFromBuffer(params: {
  tenantId: string;
  userId: string;
  issueDateStr: string;
  issueDate: Date;
  editionId: string | null;
  subEditionId: string | null;
  pdfBuffer: Buffer;
  sourcePdfUrl?: string;
}) {
  const { tenantId, userId, issueDateStr, issueDate, editionId, subEditionId, pdfBuffer } = params;

  let targetType: 'edition' | 'sub-edition' = 'edition';
  let targetId = editionId || '';

  if (subEditionId) {
    targetType = 'sub-edition';
    targetId = subEditionId;
    const sub = await p.epaperPublicationSubEdition.findFirst({
      where: { id: subEditionId, tenantId, isDeleted: false },
      select: { id: true },
    });
    if (!sub) throw new HttpError(404, 'Sub-edition not found', 'SUB_EDITION_NOT_FOUND');
  } else if (editionId) {
    const ed = await p.epaperPublicationEdition.findFirst({
      where: { id: editionId, tenantId, isDeleted: false },
      select: { id: true },
    });
    if (!ed) throw new HttpError(404, 'Edition not found', 'EDITION_NOT_FOUND');
  }

  const keys = buildIssueKey({ tenantId, targetType, targetId, date: issueDateStr });

  // 1) Upload PDF
  const pdfUpload = await putPublicObject({
    key: keys.pdfKey,
    body: pdfBuffer,
    contentType: 'application/pdf',
  });

  // 2) Convert to PNG pages
  const pageBuffers = await convertPdfToPngPages(pdfBuffer);

  // 3) Upload PNG pages
  const pages = await mapWithConcurrency(pageBuffers, 4, async (buf, idx) => {
    const pageNumber = idx + 1;
    const pageKey = `${keys.pagePrefix}/page-${String(pageNumber).padStart(4, '0')}.png`;
    const up = await putPublicObject({ key: pageKey, body: buf, contentType: 'image/png' });
    return { pageNumber, imageUrl: up.publicUrl };
  });

  const coverImageUrl = pages[0]?.imageUrl || null;

  // 4) Upsert/replace DB record
  const existing = await p.epaperPdfIssue.findFirst({
    where: {
      tenantId,
      issueDate,
      editionId: editionId ? editionId : null,
      subEditionId: subEditionId ? subEditionId : null,
    },
    select: { id: true, pageCount: true },
  });

  // Best-effort cleanup: if old issue had more pages than new, delete leftover objects.
  if (existing?.pageCount && existing.pageCount > pages.length) {
    const deletes: Promise<void>[] = [];
    for (let n = pages.length + 1; n <= existing.pageCount; n++) {
      const oldKey = `${keys.pagePrefix}/page-${String(n).padStart(4, '0')}.png`;
      deletes.push(deletePublicObject({ key: oldKey }).catch(() => undefined as any));
    }
    await Promise.allSettled(deletes);
  }

  const issue = await prisma.$transaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t: any = tx;
    if (existing?.id) {
      await t.epaperPdfPage.deleteMany({ where: { issueId: existing.id } });
      const updated = await t.epaperPdfIssue.update({
        where: { id: existing.id },
        data: {
          pdfUrl: pdfUpload.publicUrl,
          coverImageUrl,
          pageCount: pages.length,
          uploadedByUserId: userId || null,
          editionId: editionId || null,
          subEditionId: subEditionId || null,
        },
      });
      await t.epaperPdfPage.createMany({
        data: pages.map((p) => ({ issueId: updated.id, pageNumber: p.pageNumber, imageUrl: p.imageUrl })),
      });
      return updated;
    }

    const created = await t.epaperPdfIssue.create({
      data: {
        tenantId,
        issueDate,
        editionId: editionId || null,
        subEditionId: subEditionId || null,
        pdfUrl: pdfUpload.publicUrl,
        coverImageUrl,
        pageCount: pages.length,
        uploadedByUserId: userId || null,
      },
    });

    await t.epaperPdfPage.createMany({
      data: pages.map((p) => ({ issueId: created.id, pageNumber: p.pageNumber, imageUrl: p.imageUrl })),
    });

    return created;
  });

  const full = await p.epaperPdfIssue.findUnique({
    where: { id: issue.id },
    include: {
      pages: { orderBy: { pageNumber: 'asc' } },
      edition: { select: { id: true, name: true, slug: true } },
      subEdition: { select: { id: true, name: true, slug: true } },
    },
  });

  return {
    issue: full,
    uploaded: {
      pdfUrl: pdfUpload.publicUrl,
      pageCount: pages.length,
      coverImageUrl,
    },
  };
}

async function getTenantContext(req: Request): Promise<{ tenantId: string | null; isAdmin: boolean; isSuperAdmin: boolean; userId: string }> {
  const user = (req as any).user;
  const userId = asString(user?.id || '');
  const roleName = asString(user?.role?.name || '').toUpperCase();

  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || roleName === 'TENANT_ADMIN' || roleName === 'ADMIN_EDITOR';

  let tenantId: string | null = null;
  if (!isSuperAdmin && userId) {
    const reporter = await prisma.reporter.findFirst({ where: { userId }, select: { tenantId: true } });
    tenantId = reporter?.tenantId || null;
  }

  const requestedTenantId = (req.query as any)?.tenantId || (req.body as any)?.tenantId;
  if (requestedTenantId) {
    if (isSuperAdmin) {
      tenantId = asString(requestedTenantId);
    } else {
      // Tenant admins/editors are locked to their own tenant context.
      if (!tenantId) {
        // Keep existing behavior: will be rejected by caller with "Tenant context required".
      } else if (asString(requestedTenantId) !== tenantId) {
        throw new HttpError(403, 'You cannot override tenantId', 'TENANT_OVERRIDE_NOT_ALLOWED');
      }
    }
  }

  return { tenantId, isAdmin, isSuperAdmin, userId };
}

function buildIssueKey(params: { tenantId: string; targetType: 'edition' | 'sub-edition'; targetId: string; date: string }): { pdfKey: string; pagePrefix: string } {
  const safeDate = params.date;
  const root = `epaper/pdf-issues/${params.tenantId}/${params.targetType}/${params.targetId}/${safeDate}`;
  return {
    pdfKey: `${root}/issue.pdf`,
    pagePrefix: `${root}/pages`,
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

export const uploadPdfIssue = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'pdf file is required (multipart/form-data, field: pdf)' });

    const isPdfMime = String(file.mimetype || '').toLowerCase() === 'application/pdf';
    const looksLikePdfName = String(file.originalname || '').toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !looksLikePdfName) {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    const maxMb = Number((config as any)?.epaper?.pdfMaxMb || 30);
    const maxBytes = Math.max(1, Math.floor(maxMb * 1024 * 1024));
    if (file.size && file.size > maxBytes) {
      return res.status(413).json({ error: 'PDF too large', maxMb });
    }

    const issueDateStr = asString((req.body as any).issueDate);
    const editionId = (req.body as any).editionId ? asString((req.body as any).editionId) : null;
    const subEditionId = (req.body as any).subEditionId ? asString((req.body as any).subEditionId) : null;

    if ((editionId ? 1 : 0) + (subEditionId ? 1 : 0) !== 1) {
      return res.status(400).json({ error: 'Provide exactly one: editionId or subEditionId' });
    }

    const issueDate = parseIsoDateOnly(issueDateStr);
    const tenantId = ctx.tenantId;

    const result = await upsertPdfIssueFromBuffer({
      tenantId,
      userId: ctx.userId,
      issueDateStr,
      issueDate,
      editionId,
      subEditionId,
      pdfBuffer: file.buffer,
    });

    return res.status(201).json({ ok: true, issue: result.issue, uploaded: result.uploaded });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to upload PDF issue');
  }
};

export const uploadPdfIssueByUrl = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const pdfUrl = asString((req.body as any).pdfUrl);
    const issueDateStr = asString((req.body as any).issueDate);
    const editionId = (req.body as any).editionId ? asString((req.body as any).editionId) : null;
    const subEditionId = (req.body as any).subEditionId ? asString((req.body as any).subEditionId) : null;

    if (!pdfUrl) return res.status(400).json({ error: 'pdfUrl is required' });
    if ((editionId ? 1 : 0) + (subEditionId ? 1 : 0) !== 1) {
      return res.status(400).json({ error: 'Provide exactly one: editionId or subEditionId' });
    }

    const issueDate = parseIsoDateOnly(issueDateStr);
    const maxMb = Number((config as any)?.epaper?.pdfMaxMb || 30);
    const maxBytes = Math.max(1, Math.floor(maxMb * 1024 * 1024));

    const pdfBuffer = await downloadPdfToBuffer(pdfUrl, maxBytes);

    const tenantId = ctx.tenantId;
    const result = await upsertPdfIssueFromBuffer({
      tenantId,
      userId: ctx.userId,
      issueDateStr,
      issueDate,
      editionId,
      subEditionId,
      pdfBuffer,
      sourcePdfUrl: pdfUrl,
    });

    return res.status(201).json({ ok: true, issue: result.issue, uploaded: result.uploaded, source: { pdfUrl } });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to upload PDF issue by URL');
  }
};

export const getPdfIssue = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const id = asString((req.params as any).id);
    const issue = await p.epaperPdfIssue.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        pages: { orderBy: { pageNumber: 'asc' } },
        edition: { select: { id: true, name: true, slug: true } },
        subEdition: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!issue) return res.status(404).json({ error: 'Not found' });
    return res.json(issue);
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to get PDF issue');
  }
};

export const findPdfIssue = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const issueDateStr = asString((req.query as any).issueDate);
    const editionId = (req.query as any).editionId ? asString((req.query as any).editionId) : null;
    const subEditionId = (req.query as any).subEditionId ? asString((req.query as any).subEditionId) : null;

    if (!issueDateStr) return res.status(400).json({ error: 'issueDate is required' });
    if ((editionId ? 1 : 0) + (subEditionId ? 1 : 0) !== 1) {
      return res.status(400).json({ error: 'Provide exactly one: editionId or subEditionId' });
    }

    const issueDate = parseIsoDateOnly(issueDateStr);

    const issue = await p.epaperPdfIssue.findFirst({
      where: {
        tenantId: ctx.tenantId,
        issueDate,
        editionId: editionId ? editionId : null,
        subEditionId: subEditionId ? subEditionId : null,
      },
      include: {
        pages: { orderBy: { pageNumber: 'asc' } },
        edition: { select: { id: true, name: true, slug: true } },
        subEdition: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!issue) return res.status(404).json({ error: 'Not found' });
    return res.json(issue);
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to find PDF issue');
  }
};
