/**
 * ePaper Article Clips Controller
 * Handles CRUD operations for article clips (PDF coordinate-based regions).
 * This is the HEART of the new clip-based ePaper system.
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { resolveAdminTenantContext } from './adminTenantContext';

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

const getTenantContext = resolveAdminTenantContext;

// Standard PDF page dimensions (in points, 72 DPI)
const PDF_PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595, height: 842 },
  tabloid: { width: 792, height: 1224 },
  // Default max for validation (allow larger pages)
  max: { width: 2000, height: 3000 },
};

/**
 * Validate clip coordinates within PDF page boundaries
 * Returns error message if invalid, null if valid
 */
function validateClipCoordinates(
  x: number, y: number, width: number, height: number,
  pageWidth: number = PDF_PAGE_SIZES.max.width,
  pageHeight: number = PDF_PAGE_SIZES.max.height
): string | null {
  if (x < 0) return 'x must be >= 0';
  if (y < 0) return 'y must be >= 0';
  if (width <= 0) return 'width must be > 0';
  if (height <= 0) return 'height must be > 0';
  if (x + width > pageWidth) return `x + width (${x + width}) exceeds max page width (${pageWidth})`;
  if (y + height > pageHeight) return `y + height (${y + height}) exceeds max page height (${pageHeight})`;
  return null;
}

// ============================================================================
// CLIP CRUD OPERATIONS (Admin)
// ============================================================================

/**
 * List all clips for an issue
 * GET /epaper/issues/:issueId/clips
 */
export const listClipsForIssue = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const issueId = String(req.params.issueId || '').trim();
    if (!issueId) return res.status(400).json({ error: 'issueId is required' });

    // Verify issue belongs to tenant
    const issue = await p.epaperPdfIssue.findFirst({
      where: { id: issueId, tenantId: ctx.tenantId },
      select: { id: true, pdfUrl: true, pageCount: true, pdfOnlyMode: true },
    });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const pageNumber = req.query.pageNumber ? parseInt(String(req.query.pageNumber), 10) : null;

    const clips = await p.epaperArticleClip.findMany({
      where: {
        issueId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(pageNumber ? { pageNumber } : {}),
      },
      orderBy: [{ pageNumber: 'asc' }, { y: 'desc' }],
      include: {
        assets: { select: { type: true, url: true, generatedAt: true } },
      },
    });

    return res.json({
      issueId,
      pdfUrl: issue.pdfUrl,
      pageCount: issue.pageCount,
      pdfOnlyMode: issue.pdfOnlyMode,
      count: clips.length,
      clips,
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to list clips');
  }
};

/**
 * Get single clip by ID
 * GET /epaper/clips/:clipId
 */
export const getClip = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const clipId = String(req.params.clipId || '').trim();
    if (!clipId) return res.status(400).json({ error: 'clipId is required' });

    const clip = await p.epaperArticleClip.findUnique({
      where: { id: clipId },
      include: {
        issue: {
          select: { id: true, tenantId: true, pdfUrl: true, pageCount: true },
        },
        assets: true,
      },
    });

    if (!clip) return res.status(404).json({ error: 'Clip not found' });
    if (clip.issue.tenantId !== ctx.tenantId) {
      return res.status(403).json({ error: 'Access denied to this clip' });
    }

    return res.json({ clip });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to get clip');
  }
};

/**
 * Create a new clip (manual)
 * POST /epaper/clips
 */
export const createClip = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const body = req.body || {};
    const issueId = String(body.issueId || '').trim();
    const pageNumber = parseInt(String(body.pageNumber || 1), 10);
    const x = parseFloat(String(body.x || 0));
    const y = parseFloat(String(body.y || 0));
    const width = parseFloat(String(body.width || 0));
    const height = parseFloat(String(body.height || 0));
    const column = body.column || null;
    const title = body.title || null;
    const articleRef = body.articleRef || null;

    if (!issueId) return res.status(400).json({ error: 'issueId is required' });
    if (isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ error: 'pageNumber must be >= 1' });
    }
    
    // VALIDATION: Check coordinate boundaries
    const validationError = validateClipCoordinates(x, y, width, height);
    if (validationError) {
      return res.status(400).json({ error: validationError, code: 'INVALID_COORDINATES' });
    }

    // Verify issue belongs to tenant
    const issue = await p.epaperPdfIssue.findFirst({
      where: { id: issueId, tenantId: ctx.tenantId },
      select: { id: true, pageCount: true },
    });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    if (issue.pageCount > 0 && pageNumber > issue.pageCount) {
      return res.status(400).json({
        error: `pageNumber ${pageNumber} exceeds issue pageCount ${issue.pageCount}`,
      });
    }

    const clip = await p.epaperArticleClip.create({
      data: {
        issueId,
        pageNumber,
        x,
        y,
        width,
        height,
        column,
        title,
        articleRef,
        source: 'manual',
        createdBy: 'editor',
        updatedBy: 'editor',
        isActive: true,
      },
    });

    return res.status(201).json({ ok: true, clip });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to create clip');
  }
};

/**
 * Update a clip (Admin)
 * PUT /epaper/clips/:clipId
 */
export const updateClip = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const clipId = String(req.params.clipId || '').trim();
    if (!clipId) return res.status(400).json({ error: 'clipId is required' });

    // Verify clip exists and belongs to tenant
    const existing = await p.epaperArticleClip.findUnique({
      where: { id: clipId },
      include: { issue: { select: { tenantId: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Clip not found' });
    if (existing.issue.tenantId !== ctx.tenantId) {
      return res.status(403).json({ error: 'Access denied to this clip' });
    }

    const body = req.body || {};
    const updateData: any = { updatedBy: 'editor' };

    // Only update provided fields
    if (body.pageNumber !== undefined) {
      const pn = parseInt(String(body.pageNumber), 10);
      if (isNaN(pn) || pn < 1) return res.status(400).json({ error: 'Invalid pageNumber' });
      updateData.pageNumber = pn;
    }
    if (body.x !== undefined) updateData.x = parseFloat(String(body.x));
    if (body.y !== undefined) updateData.y = parseFloat(String(body.y));
    if (body.width !== undefined) {
      const w = parseFloat(String(body.width));
      if (w <= 0) return res.status(400).json({ error: 'width must be > 0' });
      updateData.width = w;
    }
    if (body.height !== undefined) {
      const h = parseFloat(String(body.height));
      if (h <= 0) return res.status(400).json({ error: 'height must be > 0' });
      updateData.height = h;
    }
    if (body.column !== undefined) updateData.column = body.column || null;
    if (body.title !== undefined) updateData.title = body.title || null;
    if (body.articleRef !== undefined) updateData.articleRef = body.articleRef || null;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    const updated = await p.epaperArticleClip.update({
      where: { id: clipId },
      data: updateData,
    });

    // If coordinates changed, invalidate cached assets
    if (body.x !== undefined || body.y !== undefined || body.width !== undefined || body.height !== undefined) {
      await p.epaperClipAsset.deleteMany({ where: { clipId } });
      console.log(`🗑️  Invalidated cached assets for clip ${clipId} due to coordinate change`);
    }

    return res.json({ ok: true, clip: updated });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to update clip');
  }
};

/**
 * Delete a clip (SOFT DELETE)
 * DELETE /epaper/clips/:clipId
 * Sets isActive=false and deletedAt timestamp instead of hard delete.
 */
export const deleteClip = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const clipId = String(req.params.clipId || '').trim();
    if (!clipId) return res.status(400).json({ error: 'clipId is required' });

    // Verify clip exists and belongs to tenant
    const existing = await p.epaperArticleClip.findUnique({
      where: { id: clipId },
      include: { issue: { select: { tenantId: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Clip not found' });
    if (existing.issue.tenantId !== ctx.tenantId) {
      return res.status(403).json({ error: 'Access denied to this clip' });
    }

    // SOFT DELETE: Set isActive=false and deletedAt timestamp
    await p.epaperArticleClip.update({
      where: { id: clipId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        updatedBy: 'editor',
      },
    });

    return res.json({ ok: true, softDeleted: { clipId, deletedAt: new Date().toISOString() } });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to delete clip');
  }
};

/**
 * Bulk create clips for an issue (from auto-detection or import)
 * POST /epaper/issues/:issueId/clips/bulk
 */
export const bulkCreateClips = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const issueId = String(req.params.issueId || '').trim();
    if (!issueId) return res.status(400).json({ error: 'issueId is required' });

    // Verify issue belongs to tenant
    const issue = await p.epaperPdfIssue.findFirst({
      where: { id: issueId, tenantId: ctx.tenantId },
      select: { id: true, pageCount: true },
    });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    const clips = req.body.clips;
    if (!Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({ error: 'clips array is required' });
    }

    const source = String(req.body.source || 'manual');
    const createdBy = String(req.body.createdBy || 'editor');

    // Validate and prepare clip data
    const clipData = clips.map((c: any, idx: number) => {
      const pageNumber = parseInt(String(c.pageNumber || 1), 10);
      const x = parseFloat(String(c.x || 0));
      const y = parseFloat(String(c.y || 0));
      const width = parseFloat(String(c.width || 0));
      const height = parseFloat(String(c.height || 0));

      if (isNaN(pageNumber) || pageNumber < 1) {
        throw new HttpError(400, `Clip ${idx}: invalid pageNumber`);
      }
      
      // VALIDATION: Check coordinate boundaries
      const validationError = validateClipCoordinates(x, y, width, height);
      if (validationError) {
        throw new HttpError(400, `Clip ${idx}: ${validationError}`);
      }

      return {
        issueId,
        pageNumber,
        x,
        y,
        width,
        height,
        column: c.column || null,
        title: c.title || null,
        articleRef: c.articleRef || null,
        source,
        confidence: c.confidence !== undefined ? parseFloat(String(c.confidence)) : null,
        createdBy,
        updatedBy: createdBy,
        isActive: true,
      };
    });

    // Bulk create
    const result = await p.epaperArticleClip.createMany({
      data: clipData,
    });

    // Fetch created clips
    const createdClips = await p.epaperArticleClip.findMany({
      where: { issueId },
      orderBy: [{ pageNumber: 'asc' }, { createdAt: 'desc' }],
      take: clipData.length,
    });

    return res.status(201).json({
      ok: true,
      count: result.count,
      clips: createdClips,
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to bulk create clips');
  }
};

// ============================================================================
// AUTO-DETECTION (Placeholder - requires PDF analysis library)
// ============================================================================

/**
 * Auto-detect article clips from PDF
 * POST /epaper/clips/detect
 * 
 * This is a placeholder for AI/algorithm-based clip detection.
 * Real implementation would use:
 * - PDF parsing (pdf-lib, pdfjs-dist)
 * - Layout analysis
 * - ML-based article boundary detection
 */
export const detectClips = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin only' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const issueId = String(req.body.issueId || '').trim();
    if (!issueId) return res.status(400).json({ error: 'issueId is required' });

    // Verify issue belongs to tenant
    const issue = await p.epaperPdfIssue.findFirst({
      where: { id: issueId, tenantId: ctx.tenantId },
      select: { id: true, pdfUrl: true, pageCount: true },
    });
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    // For now, return a placeholder response
    // In production, this would:
    // 1. Download PDF from issue.pdfUrl
    // 2. Analyze each page for article regions
    // 3. Create EpaperArticleClip records with source='auto'
    
    console.log(`🔍 Auto-detection requested for issue ${issueId}`);
    console.log(`   PDF URL: ${issue.pdfUrl}`);
    console.log(`   Page count: ${issue.pageCount}`);

    // Placeholder: Create simple half-page clips for each page
    const placeholderClips: any[] = [];
    for (let page = 1; page <= (issue.pageCount || 1); page++) {
      // Left column placeholder
      placeholderClips.push({
        issueId,
        pageNumber: page,
        x: 0,
        y: 0,
        width: 306, // ~4.25 inches at 72 DPI (half of letter width)
        height: 792, // Full page height
        column: 'left',
        source: 'auto',
        confidence: 0.5,
        createdBy: 'system',
        updatedBy: 'system',
        isActive: true,
      });
      // Right column placeholder
      placeholderClips.push({
        issueId,
        pageNumber: page,
        x: 306,
        y: 0,
        width: 306,
        height: 792,
        column: 'right',
        source: 'auto',
        confidence: 0.5,
        createdBy: 'system',
        updatedBy: 'system',
        isActive: true,
      });
    }

    // SAFETY: Soft-delete (deactivate) existing auto-detected clips for this issue
    // This prevents duplicate active clips from multiple detection runs
    const deactivated = await p.epaperArticleClip.updateMany({
      where: { issueId, source: 'auto', isActive: true },
      data: { isActive: false, deletedAt: new Date(), updatedBy: 'system' },
    });
    if (deactivated.count > 0) {
      console.log(`⚠️  Deactivated ${deactivated.count} previous auto-detected clips for issue ${issueId}`);
    }

    // Create placeholder clips
    await p.epaperArticleClip.createMany({
      data: placeholderClips,
    });

    const clips = await p.epaperArticleClip.findMany({
      where: { issueId },
      orderBy: [{ pageNumber: 'asc' }, { column: 'asc' }],
    });

    return res.json({
      ok: true,
      message: 'Auto-detection completed (placeholder implementation)',
      issueId,
      pdfUrl: issue.pdfUrl,
      pageCount: issue.pageCount,
      clipsCreated: clips.length,
      clips,
      note: 'This is placeholder clip detection. Real implementation requires PDF analysis.',
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to detect clips');
  }
};
