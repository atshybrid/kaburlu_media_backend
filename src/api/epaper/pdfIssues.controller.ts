import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { resolveAdminTenantContext } from './adminTenantContext';
import { convertPdfToPngPages } from '../../lib/pdfToPng';
import { convertPngToWebp } from '../../lib/pngToWebp';
import { convertPngToJpeg, convertPngToOgJpeg } from '../../lib/pngToJpeg';
import { hasEpaperJpegColumns } from '../../lib/epaperDbFeatures';
import { deletePublicObject, putPublicObject } from '../../lib/objectStorage';
import { config } from '../../config/env';
import axios from 'axios';
import { trackEpaperPageCount } from '../../services/wallet/billing.service';

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

  // 2) Convert to PNG pages (lossless masters)
  const pageBuffers = await convertPdfToPngPages(pdfBuffer);

  const jpegSupported = await hasEpaperJpegColumns(prisma);

  // 3) Upload PNG pages (masters) AND generate WebP versions for delivery
  const pages = await mapWithConcurrency(pageBuffers, 4, async (pngBuf, idx) => {
    const pageNumber = idx + 1;
    const pageKey = `${keys.pagePrefix}/page-${String(pageNumber).padStart(4, '0')}.png`;
    const webpKey = `${keys.pagePrefix}/page-${String(pageNumber).padStart(4, '0')}.webp`;
    const jpegKey = `${keys.pagePrefix}/page-${String(pageNumber).padStart(4, '0')}.jpg`;

    // Upload PNG master (archive quality, never deleted)
    const pngUpload = await putPublicObject({ key: pageKey, body: pngBuf, contentType: 'image/png' });

    // Convert PNG to WebP for optimized frontend delivery
    let webpUrl: string | null = null;
    try {
      const webpBuf = await convertPngToWebp(pngBuf);
      const webpUpload = await putPublicObject({ key: webpKey, body: webpBuf, contentType: 'image/webp' });
      webpUrl = webpUpload.publicUrl;
    } catch (webpErr) {
      // WebP generation is non-critical; log and continue with PNG only
      console.warn(`⚠️  WebP conversion failed for page ${pageNumber}:`, webpErr);
    }

    // Convert PNG to JPEG for social sharing (OG tags)
    let jpegUrl: string | null = null;
    if (jpegSupported) {
      try {
        const jpegBuf = await convertPngToJpeg(pngBuf);
        const jpegUpload = await putPublicObject({ key: jpegKey, body: jpegBuf, contentType: 'image/jpeg' });
        jpegUrl = jpegUpload.publicUrl;
      } catch (jpegErr) {
        // JPEG generation is non-critical; log and continue with PNG/WebP only
        console.warn(`⚠️  JPEG conversion failed for page ${pageNumber}:`, jpegErr);
      }
    }

    return { pageNumber, imageUrl: pngUpload.publicUrl, imageUrlWebp: webpUrl, imageUrlJpeg: jpegUrl };
  });

  const coverImageUrl = pages[0]?.imageUrl || null;
  const coverImageUrlWebp = pages[0]?.imageUrlWebp || null;
  let coverImageUrlJpeg = jpegSupported ? (pages[0]?.imageUrlJpeg || null) : null;

  // Dedicated OG JPEG (small + share-friendly). Keep full page JPEGs for per-page sharing.
  if (jpegSupported && pageBuffers[0]) {
    try {
      const ogJpegKey = `${keys.pagePrefix}/cover-og.jpg`;
      const ogJpegBuf = await convertPngToOgJpeg(pageBuffers[0]);
      const ogUpload = await putPublicObject({ key: ogJpegKey, body: ogJpegBuf, contentType: 'image/jpeg' });
      coverImageUrlJpeg = ogUpload.publicUrl;
    } catch (ogErr) {
      console.warn('⚠️  OG JPEG conversion failed for cover page:', ogErr);
      // keep fallback (page-0001.jpg) if available
    }
  }

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

  if (existing) {
    console.log(`⚠️  Replacing existing issue: ${existing.id} for date ${issueDateStr}`);
  } else {
    console.log(`✓ Creating new issue for date ${issueDateStr}`);
  }

  // Best-effort cleanup: if old issue had more pages than new, delete leftover objects.
  if (existing?.pageCount && existing.pageCount > pages.length) {
    const deletes: Promise<void>[] = [];
    for (let n = pages.length + 1; n <= existing.pageCount; n++) {
      const oldPngKey = `${keys.pagePrefix}/page-${String(n).padStart(4, '0')}.png`;
      const oldWebpKey = `${keys.pagePrefix}/page-${String(n).padStart(4, '0')}.webp`;
      const oldJpegKey = `${keys.pagePrefix}/page-${String(n).padStart(4, '0')}.jpg`;
      deletes.push(deletePublicObject({ key: oldPngKey }).catch(() => undefined as any));
      deletes.push(deletePublicObject({ key: oldWebpKey }).catch(() => undefined as any));
      deletes.push(deletePublicObject({ key: oldJpegKey }).catch(() => undefined as any));
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
          coverImageUrlWebp,
          ...(jpegSupported ? { coverImageUrlJpeg } : {}),
          pageCount: pages.length,
          uploadedByUserId: userId || null,
          editionId: editionId || null,
          subEditionId: subEditionId || null,
        },
      });
      await t.epaperPdfPage.createMany({
        data: pages.map((p) => ({
          issueId: updated.id,
          pageNumber: p.pageNumber,
          imageUrl: p.imageUrl,
          imageUrlWebp: p.imageUrlWebp,
          ...(jpegSupported ? { imageUrlJpeg: p.imageUrlJpeg } : {}),
        })),
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
        coverImageUrlWebp,
        ...(jpegSupported ? { coverImageUrlJpeg } : {}),
        pageCount: pages.length,
        uploadedByUserId: userId || null,
      },
    });

    await t.epaperPdfPage.createMany({
      data: pages.map((p) => ({
        issueId: created.id,
        pageNumber: p.pageNumber,
        imageUrl: p.imageUrl,
        imageUrlWebp: p.imageUrlWebp,
        ...(jpegSupported ? { imageUrlJpeg: p.imageUrlJpeg } : {}),
      })),
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

  // Track page count for billing
  try {
    await trackEpaperPageCount(tenantId, pages.length, issueDate);
  } catch (error) {
    console.error('Failed to track ePaper page count:', error);
    // Don't fail the upload if tracking fails
  }

  return {
    issue: full,
    uploaded: {
      pdfUrl: pdfUpload.publicUrl,
      pageCount: pages.length,
      coverImageUrl,
      coverImageUrlWebp,
      coverImageUrlJpeg,
    },
  };
}

/**
 * NEW: PDF-Only mode upload - stores PDF without generating page images.
 * This is the recommended approach for the new clip-based system.
 * Page images are generated on-demand when clips are shared.
 */
async function upsertPdfIssueFromBufferPdfOnly(params: {
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

  // 1) Upload PDF only - NO image conversion
  const pdfUpload = await putPublicObject({
    key: keys.pdfKey,
    body: pdfBuffer,
    contentType: 'application/pdf',
  });

  // 2) Get page count from PDF without converting (using pdf-lib or similar)
  let pageCount = 0;
  try {
    // Simple page count extraction from PDF header/structure
    // For accurate count, use pdf-lib or pdfjs-dist
    const pdfStr = pdfBuffer.toString('latin1');
    const countMatch = pdfStr.match(/\/Count\s+(\d+)/g);
    if (countMatch && countMatch.length > 0) {
      const counts = countMatch.map(m => parseInt(m.replace('/Count ', ''), 10)).filter(n => !isNaN(n));
      pageCount = Math.max(...counts, 0);
    }
    // Fallback: try another pattern
    if (pageCount === 0) {
      const typeMatch = pdfStr.match(/\/Type\s*\/Page[^s]/g);
      if (typeMatch) pageCount = typeMatch.length;
    }
  } catch (e) {
    console.warn('Could not extract page count from PDF:', e);
    pageCount = 0; // Will be updated when clips are created or PDF is analyzed
  }

  console.log(`✓ PDF-only mode: Uploading PDF with ${pageCount} pages (no image generation)`);

  // 3) Upsert DB record (PDF-only mode)
  const existing = await p.epaperPdfIssue.findFirst({
    where: {
      tenantId,
      issueDate,
      editionId: editionId ? editionId : null,
      subEditionId: subEditionId ? subEditionId : null,
    },
    select: { id: true, pageCount: true, pdfOnlyMode: true },
  });

  if (existing) {
    console.log(`⚠️  Replacing existing issue: ${existing.id} for date ${issueDateStr} (PDF-only mode)`);
  } else {
    console.log(`✓ Creating new issue for date ${issueDateStr} (PDF-only mode)`);
  }

  const issue = await prisma.$transaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t: any = tx;
    if (existing?.id) {
      // For PDF-only mode, don't delete old pages (legacy support)
      // Just update the issue record
      const updated = await t.epaperPdfIssue.update({
        where: { id: existing.id },
        data: {
          pdfUrl: pdfUpload.publicUrl,
          pageCount: pageCount || existing.pageCount,
          uploadedByUserId: userId || null,
          editionId: editionId || null,
          subEditionId: subEditionId || null,
          pdfOnlyMode: true,
          // Clear cover images - they'll be generated on-demand
          coverImageUrl: null,
          coverImageUrlWebp: null,
        },
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
        pageCount,
        uploadedByUserId: userId || null,
        pdfOnlyMode: true,
        coverImageUrl: null,
        coverImageUrlWebp: null,
      },
    });

    return created;
  });

  const full = await p.epaperPdfIssue.findUnique({
    where: { id: issue.id },
    include: {
      edition: { select: { id: true, name: true, slug: true } },
      subEdition: { select: { id: true, name: true, slug: true } },
      clips: { where: { isActive: true }, orderBy: { pageNumber: 'asc' } },
    },
  });

  return {
    issue: full,
    uploaded: {
      pdfUrl: pdfUpload.publicUrl,
      pageCount,
      pdfOnlyMode: true,
    },
  };
}

// Use shared admin tenant resolver for consistent overrides
const getTenantContext = resolveAdminTenantContext;

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

async function downloadPublicImageToBuffer(url: string, maxBytes: number): Promise<Buffer> {
  const resp = await axios.get<ArrayBuffer>(String(url || '').trim(), {
    responseType: 'arraybuffer',
    timeout: Number(process.env.EPAPER_IMAGE_FETCH_TIMEOUT_MS || 45000),
    maxRedirects: 5,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    validateStatus: (s) => s >= 200 && s < 300,
    headers: {
      'User-Agent': 'KaburluMediaBackend/epaper-image-fetch',
      Accept: 'image/png,image/*;q=0.9,*/*;q=0.1',
    },
  });

  const buf = Buffer.from(resp.data);
  if (!buf.length) throw new Error('Downloaded image is empty');
  if (buf.length > maxBytes) throw new Error('Image too large');
  return buf;
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
    // LEGACY MODE: generateImages=true explicitly requests old image generation (admin-only fallback)
    const generateImages = String((req.body as any).generateImages || (req.query as any).generateImages || '').toLowerCase() === 'true';

    if ((editionId ? 1 : 0) + (subEditionId ? 1 : 0) !== 1) {
      return res.status(400).json({ error: 'Provide exactly one: editionId or subEditionId' });
    }

    const issueDate = parseIsoDateOnly(issueDateStr);
    const tenantId = ctx.tenantId;

    // Default: PDF-only mode. Legacy image generation only via explicit generateImages=true
    const uploadFn = generateImages ? upsertPdfIssueFromBuffer : upsertPdfIssueFromBufferPdfOnly;
    const result = await uploadFn({
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
    // LEGACY MODE: generateImages=true explicitly requests old image generation (admin-only fallback)
    const generateImages = String((req.body as any).generateImages || (req.query as any).generateImages || '').toLowerCase() === 'true';

    if (!pdfUrl) return res.status(400).json({ error: 'pdfUrl is required' });
    if ((editionId ? 1 : 0) + (subEditionId ? 1 : 0) !== 1) {
      return res.status(400).json({ error: 'Provide exactly one: editionId or subEditionId' });
    }

    const issueDate = parseIsoDateOnly(issueDateStr);
    const maxMb = Number((config as any)?.epaper?.pdfMaxMb || 30);
    const maxBytes = Math.max(1, Math.floor(maxMb * 1024 * 1024));

    const pdfBuffer = await downloadPdfToBuffer(pdfUrl, maxBytes);

    const tenantId = ctx.tenantId;
    // Default: PDF-only mode. Legacy image generation only via explicit generateImages=true
    const uploadFn = generateImages ? upsertPdfIssueFromBuffer : upsertPdfIssueFromBufferPdfOnly;
    const result = await uploadFn({
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

/**
 * Backfill JPEG page/cover URLs for an existing legacy (generateImages=true) issue.
 * This is useful when JPEG support is added after issues already exist.
 */
export const backfillPdfIssueJpeg = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const jpegSupported = await hasEpaperJpegColumns(prisma);
    if (!jpegSupported) {
      return res.status(409).json({
        error: 'JPEG columns not available in DB. Run Prisma migrations first.',
        code: 'EPAPER_JPEG_MIGRATION_REQUIRED',
      });
    }

    const id = asString((req.params as any).id);
    const issue = await p.epaperPdfIssue.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
    });
    if (!issue) return res.status(404).json({ error: 'Not found' });

    if (!issue.pages || issue.pages.length === 0) {
      return res.status(400).json({
        error: 'This issue has no stored page images to backfill (PDF-only mode or missing pages).',
        code: 'NO_PAGES_TO_BACKFILL',
      });
    }

    const tenantId = ctx.tenantId;
    const issueDateStr = new Date(issue.issueDate).toISOString().slice(0, 10);

    let targetType: 'edition' | 'sub-edition' = 'edition';
    let targetId = String(issue.editionId || '');
    if (issue.subEditionId) {
      targetType = 'sub-edition';
      targetId = String(issue.subEditionId);
    }
    if (!targetId) {
      return res.status(400).json({ error: 'Issue target (edition/sub-edition) missing', code: 'INVALID_ISSUE_TARGET' });
    }

    const keys = buildIssueKey({ tenantId, targetType, targetId, date: issueDateStr });
    const maxBytes = Number(process.env.EPAPER_IMAGE_MAX_BYTES || 30 * 1024 * 1024);

    const work = await mapWithConcurrency(issue.pages, 4, async (pg: any) => {
      if (pg.imageUrlJpeg) return { pageId: pg.id, pageNumber: pg.pageNumber, imageUrlJpeg: pg.imageUrlJpeg, didWork: false };
      const pageNumber = Number(pg.pageNumber);
      const jpegKey = `${keys.pagePrefix}/page-${String(pageNumber).padStart(4, '0')}.jpg`;
      const pngBuf = await downloadPublicImageToBuffer(pg.imageUrl, maxBytes);
      const jpegBuf = await convertPngToJpeg(pngBuf);
      const upload = await putPublicObject({ key: jpegKey, body: jpegBuf, contentType: 'image/jpeg' });
      return { pageId: pg.id, pageNumber, imageUrlJpeg: upload.publicUrl, didWork: true };
    });

    const first = work.find((x) => x.pageNumber === 1) || work[0];
    let coverJpeg = first?.imageUrlJpeg || null;

    // Prefer a dedicated OG cover JPEG (resize + compress) for social sharing.
    // Only generate if coverImageUrlJpeg is missing.
    if (!issue.coverImageUrlJpeg && issue.pages?.length) {
      try {
        const firstPage = (issue.pages || []).find((pg: any) => Number(pg.pageNumber) === 1) || issue.pages[0];
        if (firstPage?.imageUrl) {
          const ogJpegKey = `${keys.pagePrefix}/cover-og.jpg`;
          const pngBuf = await downloadPublicImageToBuffer(firstPage.imageUrl, maxBytes);
          const ogJpegBuf = await convertPngToOgJpeg(pngBuf);
          const upload = await putPublicObject({ key: ogJpegKey, body: ogJpegBuf, contentType: 'image/jpeg' });
          coverJpeg = upload.publicUrl;
        }
      } catch (ogErr) {
        console.warn('⚠️  OG cover JPEG backfill failed:', ogErr);
      }
    }

    await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t: any = tx;
      await t.epaperPdfIssue.update({ where: { id: issue.id }, data: { coverImageUrlJpeg: coverJpeg } });
      for (const item of work) {
        if (!item.didWork) continue;
        await t.epaperPdfPage.update({ where: { id: item.pageId }, data: { imageUrlJpeg: item.imageUrlJpeg } });
      }
    });

    return res.json({
      ok: true,
      issueId: issue.id,
      coverImageUrlJpeg: coverJpeg,
      updatedPages: work.filter((x) => x.didWork).length,
      totalPages: work.length,
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to backfill issue JPEGs');
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
    // Build SEO/sharing metadata
    const epaperDomain = await p.domain.findFirst({
      where: {
        tenantId: ctx.tenantId,
        kind: 'EPAPER',
        status: 'ACTIVE',
        verifiedAt: { not: null },
      },
      select: { domain: true }
    }).catch(() => null);
    const baseUrl = `https://${(epaperDomain?.domain || 'epaper.kaburlutoday.com')}`;
    const dateStr = new Date(issue.issueDate).toISOString().split('T')[0];
    const displayDate = new Date(issue.issueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const targetName = issue.subEdition ? `${issue.subEdition.name} - ${issue.edition?.name || ''}`.trim() : (issue.edition?.name || 'Edition');
    const canonicalUrl = issue.subEdition
      ? `${baseUrl}/epaper/${issue.edition?.slug}/${issue.subEdition.slug}/${dateStr}/1`
      : `${baseUrl}/epaper/${issue.edition?.slug}/${dateStr}/1`;

    return res.json({
      tenantId: ctx.tenantId,
      ...issue,
      canonicalUrl,
      metaTitle: `${targetName} | ${displayDate}`,
      metaDescription: `Read ${targetName} ePaper edition for ${displayDate}. ${issue.pageCount} pages available.`,
      ogImage: issue.coverImageUrlWebp || issue.coverImageUrl,
    });
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
    if (editionId && subEditionId) {
      return res.status(400).json({ error: 'Provide at most one: editionId or subEditionId' });
    }

    const issueDate = parseIsoDateOnly(issueDateStr);

    // If no target is provided, return all issues for this tenant+date.
    // This supports admin UIs where edition/sub-edition are optional filters.
    if (!editionId && !subEditionId) {
      const items = await p.epaperPdfIssue.findMany({
        where: {
          tenantId: ctx.tenantId,
          issueDate,
        },
        include: {
          edition: { select: { id: true, name: true, slug: true } },
          subEdition: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      const epaperDomain = await p.domain.findFirst({
        where: { tenantId: ctx.tenantId, kind: 'EPAPER', status: 'ACTIVE', verifiedAt: { not: null } },
        select: { domain: true }
      }).catch(() => null);
      const baseUrl = `https://${(epaperDomain?.domain || 'epaper.kaburlutoday.com')}`;

      const shaped = items.map((it: any) => {
        const dateStr = new Date(it.issueDate).toISOString().split('T')[0];
        const displayDate = new Date(it.issueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        const targetName = it.subEdition ? `${it.subEdition.name} - ${it.edition?.name || ''}`.trim() : (it.edition?.name || 'Edition');
        const canonicalUrl = it.subEdition
          ? `${baseUrl}/epaper/${it.edition?.slug}/${it.subEdition.slug}/${dateStr}/1`
          : `${baseUrl}/epaper/${it.edition?.slug}/${dateStr}/1`;
        return {
          tenantId: ctx.tenantId,
          ...it,
          canonicalUrl,
          metaTitle: `${targetName} | ${displayDate}`,
          metaDescription: `Read ${targetName} ePaper edition for ${displayDate}. ${it.pageCount} pages available.`,
          ogImage: it.coverImageUrlWebp || it.coverImageUrl,
        };
      });

      return res.json({ items: shaped });
    }

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
    const epaperDomain = await p.domain.findFirst({
      where: { tenantId: ctx.tenantId, kind: 'EPAPER', status: 'ACTIVE', verifiedAt: { not: null } },
      select: { domain: true }
    }).catch(() => null);
    const baseUrl = `https://${(epaperDomain?.domain || 'epaper.kaburlutoday.com')}`;
    const dateStr = new Date(issue.issueDate).toISOString().split('T')[0];
    const displayDate = new Date(issue.issueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const targetName = issue.subEdition ? `${issue.subEdition.name} - ${issue.edition?.name || ''}`.trim() : (issue.edition?.name || 'Edition');
    const canonicalUrl = issue.subEdition
      ? `${baseUrl}/epaper/${issue.edition?.slug}/${issue.subEdition.slug}/${dateStr}/1`
      : `${baseUrl}/epaper/${issue.edition?.slug}/${dateStr}/1`;

    return res.json({
      tenantId: ctx.tenantId,
      ...issue,
      canonicalUrl,
      metaTitle: `${targetName} | ${displayDate}`,
      metaDescription: `Read ${targetName} ePaper edition for ${displayDate}. ${issue.pageCount} pages available.`,
      ogImage: issue.coverImageUrlWebp || issue.coverImageUrl,
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to find PDF issue');
  }
};
