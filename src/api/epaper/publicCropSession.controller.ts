/**
 * Public Crop Session Controller
 * Handles secure, time-limited clip updates from public users.
 * 
 * Security model:
 * - No JWT required
 * - Creates temporary session with 5-minute TTL
 * - Session key required for updates
 * - Rate limited to max 3 updates per session
 * - Public-created clips are suggestions (source='public', isActive=false)
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const SESSION_TTL_SECONDS = 5 * 60; // 5 minutes
const MAX_UPDATES_PER_SESSION = 3; // Rate limit: max 3 updates per session

// Standard PDF page dimensions (in points, 72 DPI)
const PDF_PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595, height: 842 },
  tabloid: { width: 792, height: 1224 },
  // Default max for validation (allow larger pages)
  max: { width: 2000, height: 3000 },
};

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

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip || 'unknown').digest('hex').substring(0, 16);
}

function generateSessionKey(): string {
  return crypto.randomBytes(24).toString('base64url');
}

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
  if (x + width > pageWidth) return `x + width (${x + width}) exceeds page width (${pageWidth})`;
  if (y + height > pageHeight) return `y + height (${y + height}) exceeds page height (${pageHeight})`;
  return null;
}

// ============================================================================
// PUBLIC READ ENDPOINTS (No Auth)
// ============================================================================

/**
 * Get issue with clips (public read-only)
 * GET /public/epaper/issue-with-clips
 * 
 * Query params:
 * - issueId OR
 * - editionSlug + date OR
 * - subEditionSlug + date
 */
export const getPublicIssueWithClips = async (req: Request, res: Response) => {
  try {
    const tenant = (res.locals as any).tenant;
    const domain = (res.locals as any).domain;

    if (!tenant) {
      return res.status(400).json({ error: 'Tenant context required (use X-Tenant-Domain)' });
    }

    const issueId = String(req.query.issueId || '').trim();
    const editionSlug = String(req.query.editionSlug || '').trim();
    const subEditionSlug = String(req.query.subEditionSlug || '').trim();
    const dateStr = String(req.query.date || '').trim();
    const pageNumber = req.query.pageNumber ? parseInt(String(req.query.pageNumber), 10) : null;

    let issue: any = null;

    if (issueId) {
      // Direct lookup by ID
      issue = await p.epaperPdfIssue.findFirst({
        where: { id: issueId, tenantId: tenant.id },
        include: {
          edition: { select: { id: true, name: true, slug: true } },
          subEdition: { select: { id: true, name: true, slug: true } },
        },
      });
    } else if (editionSlug && dateStr) {
      // Lookup by edition slug + date
      const issueDate = new Date(`${dateStr}T00:00:00.000Z`);
      if (isNaN(issueDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format (use YYYY-MM-DD)' });
      }

      issue = await p.epaperPdfIssue.findFirst({
        where: {
          tenantId: tenant.id,
          issueDate,
          edition: { slug: editionSlug },
          subEditionId: subEditionSlug
            ? { equals: await getSubEditionIdBySlug(tenant.id, subEditionSlug) }
            : null,
        },
        include: {
          edition: { select: { id: true, name: true, slug: true } },
          subEdition: { select: { id: true, name: true, slug: true } },
        },
      });
    } else {
      return res.status(400).json({
        error: 'Provide issueId OR (editionSlug + date)',
        code: 'MISSING_PARAMS',
      });
    }

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Get clips for the issue (only active)
    const clips = await p.epaperArticleClip.findMany({
      where: {
        issueId: issue.id,
        isActive: true,
        ...(pageNumber ? { pageNumber } : {}),
      },
      orderBy: [{ pageNumber: 'asc' }, { y: 'desc' }],
      select: {
        id: true,
        pageNumber: true,
        x: true,
        y: true,
        width: true,
        height: true,
        column: true,
        title: true,
        source: true,
        confidence: true,
        createdAt: true,
        assets: {
          select: { type: true, url: true },
        },
      },
    });

    const dateDisplay = new Date(issue.issueDate).toISOString().split('T')[0];

    return res.json({
      issue: {
        id: issue.id,
        issueDate: issue.issueDate,
        dateDisplay,
        pdfUrl: issue.pdfUrl,
        pageCount: issue.pageCount,
        pdfOnlyMode: issue.pdfOnlyMode ?? false,
        edition: issue.edition,
        subEdition: issue.subEdition,
        coverImageUrl: issue.coverImageUrl,
        coverImageUrlWebp: issue.coverImageUrlWebp,
      },
      clips: {
        count: clips.length,
        items: clips,
      },
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to get issue with clips');
  }
};

async function getSubEditionIdBySlug(tenantId: string, slug: string): Promise<string | null> {
  const sub = await p.epaperPublicationSubEdition.findFirst({
    where: { tenantId, slug, isDeleted: false },
    select: { id: true },
  });
  return sub?.id || null;
}

// ============================================================================
// CROP SESSION MANAGEMENT
// ============================================================================

/**
 * Create a crop session (public)
 * POST /public/epaper/crop-session
 * 
 * Allows public users to get a temporary key for updating clips.
 * Rate limiting should be applied at proxy/CDN level.
 */
export const createCropSession = async (req: Request, res: Response) => {
  try {
    const tenant = (res.locals as any).tenant;
    if (!tenant) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const issueId = String(req.body.issueId || '').trim();
    const clipId = req.body.clipId ? String(req.body.clipId).trim() : null;

    if (!issueId) {
      return res.status(400).json({ error: 'issueId is required' });
    }

    // Verify issue exists and belongs to tenant
    const issue = await p.epaperPdfIssue.findFirst({
      where: { id: issueId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // If clipId provided, verify it belongs to the issue
    if (clipId) {
      const clip = await p.epaperArticleClip.findFirst({
        where: { id: clipId, issueId },
        select: { id: true },
      });
      if (!clip) {
        return res.status(404).json({ error: 'Clip not found for this issue' });
      }
    }

    // Generate session
    const sessionKey = generateSessionKey();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    const ipHash = hashIp(req.ip || req.headers['x-forwarded-for']?.toString() || '');
    const userAgent = String(req.headers['user-agent'] || '').substring(0, 500);

    const session = await p.publicCropSession.create({
      data: {
        sessionKey,
        issueId,
        clipId,
        expiresAt,
        ipHash,
        userAgent,
        used: false,
      },
    });

    return res.status(201).json({
      ok: true,
      cropSessionKey: session.sessionKey,
      expiresAt: session.expiresAt,
      expiresIn: SESSION_TTL_SECONDS,
      issueId,
      clipId,
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to create crop session');
  }
};

/**
 * Update clip via crop session (public)
 * PUT /public/epaper/clips/:clipId/update
 * 
 * Headers:
 * - X-Crop-Session: <sessionKey>
 * 
 * Security checks:
 * - Session must be valid and not expired
 * - Session must match the clipId (if scoped) or issueId
 * - Rate limit: max 3 updates per session
 * - IP hash should match (soft check)
 * 
 * Auditing:
 * - Sets updatedBy='public', confidence=null
 * - Stores previous coordinates in EpaperClipHistory
 */
export const updateClipViaCropSession = async (req: Request, res: Response) => {
  try {
    const tenant = (res.locals as any).tenant;
    if (!tenant) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const clipId = String(req.params.clipId || '').trim();
    const sessionKey = String(req.headers['x-crop-session'] || '').trim();

    if (!clipId) {
      return res.status(400).json({ error: 'clipId is required' });
    }
    if (!sessionKey) {
      return res.status(401).json({ error: 'X-Crop-Session header is required', code: 'SESSION_REQUIRED' });
    }

    // Find and validate session
    const session = await p.publicCropSession.findUnique({
      where: { sessionKey },
      include: {
        issue: { select: { tenantId: true } },
      },
    });

    if (!session) {
      return res.status(401).json({ error: 'Invalid session', code: 'INVALID_SESSION' });
    }

    if (session.issue.tenantId !== tenant.id) {
      return res.status(403).json({ error: 'Session does not belong to this tenant', code: 'TENANT_MISMATCH' });
    }

    // RATE LIMITING: Check if session has exceeded max updates
    if (session.updateCount >= MAX_UPDATES_PER_SESSION) {
      return res.status(429).json({ 
        error: `Session rate limit exceeded (max ${MAX_UPDATES_PER_SESSION} updates)`, 
        code: 'RATE_LIMIT_EXCEEDED',
        maxUpdates: MAX_UPDATES_PER_SESSION,
        currentCount: session.updateCount,
      });
    }

    if (new Date() > session.expiresAt) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    // If session was scoped to a specific clip, enforce it
    if (session.clipId && session.clipId !== clipId) {
      return res.status(403).json({ error: 'Session not authorized for this clip', code: 'CLIP_MISMATCH' });
    }

    // Verify clip exists and belongs to the session's issue
    const clip = await p.epaperArticleClip.findUnique({
      where: { id: clipId },
      include: { issue: { select: { id: true, tenantId: true } } },
    });

    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }
    if (clip.issue.id !== session.issueId) {
      return res.status(403).json({ error: 'Clip does not belong to session issue', code: 'ISSUE_MISMATCH' });
    }

    // IP hash check (soft - just log if mismatch)
    const currentIpHash = hashIp(req.ip || req.headers['x-forwarded-for']?.toString() || '');
    if (session.ipHash && session.ipHash !== currentIpHash) {
      console.warn(`⚠️  IP mismatch for crop session ${sessionKey}: expected ${session.ipHash}, got ${currentIpHash}`);
      // Don't block - just log for monitoring
    }

    // Parse update data
    const body = req.body || {};
    const newX = body.x !== undefined ? parseFloat(String(body.x)) : clip.x;
    const newY = body.y !== undefined ? parseFloat(String(body.y)) : clip.y;
    const newWidth = body.width !== undefined ? parseFloat(String(body.width)) : clip.width;
    const newHeight = body.height !== undefined ? parseFloat(String(body.height)) : clip.height;

    // VALIDATION: Check coordinate boundaries
    const validationError = validateClipCoordinates(newX, newY, newWidth, newHeight);
    if (validationError) {
      return res.status(400).json({ error: validationError, code: 'INVALID_COORDINATES' });
    }

    // Build update data - PUBLIC AUDITING: updatedBy='public', confidence=null
    const updateData: any = { 
      updatedBy: 'public',
      confidence: null, // Reset confidence on public update
    };

    if (body.x !== undefined) updateData.x = newX;
    if (body.y !== undefined) updateData.y = newY;
    if (body.width !== undefined) updateData.width = newWidth;
    if (body.height !== undefined) updateData.height = newHeight;
    if (body.column !== undefined) updateData.column = body.column || null;
    if (body.title !== undefined) updateData.title = body.title || null;

    const coordinatesChanged = body.x !== undefined || body.y !== undefined || 
                               body.width !== undefined || body.height !== undefined;

    // ATOMIC: Increment updateCount, update clip, create history, invalidate assets
    await prisma.$transaction(async (tx: any) => {
      // Increment update count (rate limiting)
      await tx.publicCropSession.update({
        where: { id: session.id },
        data: { updateCount: { increment: 1 } },
      });

      // AUDIT: Store previous coordinates in history before updating
      if (coordinatesChanged) {
        await tx.epaperClipHistory.create({
          data: {
            clipId,
            previousX: clip.x,
            previousY: clip.y,
            previousWidth: clip.width,
            previousHeight: clip.height,
            newX,
            newY,
            newWidth,
            newHeight,
            changedBy: 'public',
            cropSessionId: session.id,
            ipHash: currentIpHash,
          },
        });
      }

      await tx.epaperArticleClip.update({
        where: { id: clipId },
        data: updateData,
      });

      // Invalidate cached assets if coordinates changed
      if (coordinatesChanged) {
        await tx.epaperClipAsset.deleteMany({ where: { clipId } });
      }
    });

    const updatedClip = await p.epaperArticleClip.findUnique({
      where: { id: clipId },
    });

    return res.json({
      ok: true,
      message: 'Clip updated successfully',
      clip: updatedClip,
      sessionUpdatesRemaining: MAX_UPDATES_PER_SESSION - session.updateCount - 1,
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to update clip via crop session');
  }
};

/**
 * Create new clip via crop session (public)
 * POST /public/epaper/clips/create
 * 
 * Headers:
 * - X-Crop-Session: <sessionKey>
 * 
 * PUBLIC CLIP CREATION POLICY:
 * - Public clips are created as SUGGESTIONS only
 * - source = 'public', isActive = false
 * - These clips do NOT appear in public responses until reviewed/activated by admin
 * - Rate limited: counts toward session updateCount
 */
export const createClipViaCropSession = async (req: Request, res: Response) => {
  try {
    const tenant = (res.locals as any).tenant;
    if (!tenant) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const sessionKey = String(req.headers['x-crop-session'] || '').trim();

    if (!sessionKey) {
      return res.status(401).json({ error: 'X-Crop-Session header is required', code: 'SESSION_REQUIRED' });
    }

    // Find and validate session
    const session = await p.publicCropSession.findUnique({
      where: { sessionKey },
      include: {
        issue: { select: { id: true, tenantId: true, pageCount: true } },
      },
    });

    if (!session) {
      return res.status(401).json({ error: 'Invalid session', code: 'INVALID_SESSION' });
    }

    if (session.issue.tenantId !== tenant.id) {
      return res.status(403).json({ error: 'Session does not belong to this tenant', code: 'TENANT_MISMATCH' });
    }

    // RATE LIMITING: Check if session has exceeded max updates
    if (session.updateCount >= MAX_UPDATES_PER_SESSION) {
      return res.status(429).json({ 
        error: `Session rate limit exceeded (max ${MAX_UPDATES_PER_SESSION} operations)`, 
        code: 'RATE_LIMIT_EXCEEDED',
        maxUpdates: MAX_UPDATES_PER_SESSION,
        currentCount: session.updateCount,
      });
    }

    if (new Date() > session.expiresAt) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    // If session was scoped to a specific clip, don't allow creating new clips
    if (session.clipId) {
      return res.status(403).json({ error: 'Session is scoped to existing clip, cannot create new', code: 'SCOPED_SESSION' });
    }

    // Parse clip data
    const body = req.body || {};
    const pageNumber = parseInt(String(body.pageNumber || 1), 10);
    const x = parseFloat(String(body.x || 0));
    const y = parseFloat(String(body.y || 0));
    const width = parseFloat(String(body.width || 0));
    const height = parseFloat(String(body.height || 0));

    if (isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ error: 'pageNumber must be >= 1' });
    }
    if (session.issue.pageCount > 0 && pageNumber > session.issue.pageCount) {
      return res.status(400).json({
        error: `pageNumber ${pageNumber} exceeds issue pageCount ${session.issue.pageCount}`,
      });
    }

    // VALIDATION: Check coordinate boundaries
    const validationError = validateClipCoordinates(x, y, width, height);
    if (validationError) {
      return res.status(400).json({ error: validationError, code: 'INVALID_COORDINATES' });
    }

    const currentIpHash = hashIp(req.ip || req.headers['x-forwarded-for']?.toString() || '');

    // Create clip as SUGGESTION (source='public', isActive=false) and increment updateCount
    const clip = await prisma.$transaction(async (tx: any) => {
      // Increment update count (rate limiting)
      await tx.publicCropSession.update({
        where: { id: session.id },
        data: { updateCount: { increment: 1 } },
      });

      return tx.epaperArticleClip.create({
        data: {
          issueId: session.issueId,
          pageNumber,
          x,
          y,
          width,
          height,
          column: body.column || null,
          title: body.title || null,
          articleRef: body.articleRef || null,
          // PUBLIC CLIP = SUGGESTION: source='public', isActive=false
          source: 'public',
          createdBy: 'public',
          updatedBy: 'public',
          isActive: false, // Not visible until admin activates
          confidence: null,
        },
      });
    });

    return res.status(201).json({
      ok: true,
      message: 'Clip suggestion created successfully (pending admin review)',
      clip,
      isPendingReview: true,
      sessionUpdatesRemaining: MAX_UPDATES_PER_SESSION - session.updateCount - 1,
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to create clip via crop session');
  }
};

// ============================================================================
// CLEANUP UTILITY
// ============================================================================

/**
 * Cleanup expired crop sessions (internal/cron)
 * Can be called from a cron job
 */
export const cleanupExpiredSessions = async (): Promise<number> => {
  try {
    const result = await p.publicCropSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    if (result.count > 0) {
      console.log(`🧹 Cleaned up ${result.count} expired crop sessions`);
    }
    return result.count;
  } catch (e) {
    console.error('Failed to cleanup expired sessions:', e);
    return 0;
  }
};
