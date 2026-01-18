/**
 * ePaper Issue Management Controller
 * For SUPER_ADMIN and DESK_EDITOR roles
 * - Get all issues by date (across all tenants for superadmin)
 * - Get tenant ePaper issues with PDFs
 * - Delete issue
 * - Duplicate prevention logic
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { deletePublicObject } from '../../lib/objectStorage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function sendHttpError(res: Response, e: any, fallbackMessage: string) {
  if (e instanceof HttpError) {
    return res.status(e.statusCode).json({ error: e.message, code: e.code });
  }
  console.error(fallbackMessage, e);
  return res.status(500).json({ error: fallbackMessage, details: e?.message || String(e) });
}

function asString(value: unknown): string {
  return String(value || '').trim();
}

function parseIsoDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Invalid date format. Must be YYYY-MM-DD', 'INVALID_DATE_FORMAT');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

async function getTenantContext(req: Request): Promise<{
  tenantId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isDeskEditor: boolean;
  userId: string;
}> {
  const user = (req as any).user;
  const userId = asString(user?.id || '');
  const roleName = asString(user?.role?.name || '').toUpperCase();

  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  const isDeskEditor = roleName === 'DESK_EDITOR';
  const isAdmin = isSuperAdmin || isDeskEditor || roleName === 'TENANT_ADMIN' || roleName === 'ADMIN_EDITOR';

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
      throw new HttpError(403, 'Only SUPER_ADMIN can override tenantId', 'TENANT_OVERRIDE_FORBIDDEN');
    }
  }

  return { tenantId, isAdmin, isSuperAdmin, isDeskEditor, userId };
}

/**
 * Get all ePaper issues by date
 * - SUPER_ADMIN: Can see all tenants' issues
 * - DESK_EDITOR: Can see only their tenant's issues
 * - Supports date filtering and pagination
 */
export const getAllIssuesByDate = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    
    // Only SUPER_ADMIN and DESK_EDITOR can access
    if (!ctx.isSuperAdmin && !ctx.isDeskEditor) {
      return res.status(403).json({ error: 'Only SUPER_ADMIN and DESK_EDITOR can access this endpoint' });
    }

    const issueDateStr = asString((req.query as any).issueDate || '');
    const includePages = String((req.query as any).includePages ?? 'false').toLowerCase() === 'true';
    const page = Math.max(1, parseInt(String((req.query as any).page || '1')));
    const limit = Math.min(100, Math.max(1, parseInt(String((req.query as any).limit || '50'))));
    const skip = (page - 1) * limit;

    // Date filtering
    let dateFilter: any = {};
    if (issueDateStr) {
      const issueDate = parseIsoDateOnly(issueDateStr);
      dateFilter = { issueDate };
    }

    // Tenant filtering (DESK_EDITOR sees only their tenant)
    let tenantFilter: any = {};
    if (!ctx.isSuperAdmin && ctx.tenantId) {
      tenantFilter = { tenantId: ctx.tenantId };
    }

    const whereClause = {
      ...dateFilter,
      ...tenantFilter,
    };

    const [issues, total] = await Promise.all([
      p.epaperPdfIssue.findMany({
        where: whereClause,
        orderBy: [{ issueDate: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
        include: {
          tenant: { select: { id: true, slug: true, name: true } },
          edition: { select: { id: true, name: true, slug: true } },
          subEdition: { select: { id: true, name: true, slug: true } },
          pages: includePages ? { orderBy: { pageNumber: 'asc' } } : false,
        },
      }),
      p.epaperPdfIssue.count({ where: whereClause }),
    ]);

    return res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      issues: issues.map((issue: any) => ({
        id: issue.id,
        issueDate: issue.issueDate,
        tenant: issue.tenant,
        edition: issue.edition,
        subEdition: issue.subEdition,
        pdfUrl: issue.pdfUrl,
        coverImageUrl: issue.coverImageUrl,
        pageCount: issue.pageCount,
        pages: includePages ? issue.pages : undefined,
        uploadedByUserId: issue.uploadedByUserId,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      })),
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to fetch issues by date');
  }
};

/**
 * Get all tenant ePaper issues with PDFs
 * - Filter by date range, edition, sub-edition
 * - Includes PDF URLs and page information
 */
export const getTenantIssues = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    
    if (!ctx.isSuperAdmin && !ctx.isDeskEditor) {
      return res.status(403).json({ error: 'Only SUPER_ADMIN and DESK_EDITOR can access this endpoint' });
    }

    if (!ctx.tenantId && !ctx.isSuperAdmin) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const targetTenantId = ctx.tenantId || asString((req.query as any).tenantId);
    const startDateStr = asString((req.query as any).startDate || '');
    const endDateStr = asString((req.query as any).endDate || '');
    const editionId = asString((req.query as any).editionId || '');
    const subEditionId = asString((req.query as any).subEditionId || '');
    const includePages = String((req.query as any).includePages ?? 'false').toLowerCase() === 'true';

    let dateFilter: any = {};
    if (startDateStr && endDateStr) {
      const startDate = parseIsoDateOnly(startDateStr);
      const endDate = parseIsoDateOnly(endDateStr);
      dateFilter = { issueDate: { gte: startDate, lte: endDate } };
    } else if (startDateStr) {
      const startDate = parseIsoDateOnly(startDateStr);
      dateFilter = { issueDate: { gte: startDate } };
    } else if (endDateStr) {
      const endDate = parseIsoDateOnly(endDateStr);
      dateFilter = { issueDate: { lte: endDate } };
    }

    let editionFilter: any = {};
    if (editionId) {
      editionFilter.editionId = editionId;
    }
    if (subEditionId) {
      editionFilter.subEditionId = subEditionId;
    }

    const issues = await p.epaperPdfIssue.findMany({
      where: {
        tenantId: targetTenantId,
        ...dateFilter,
        ...editionFilter,
      },
      orderBy: [{ issueDate: 'desc' }, { updatedAt: 'desc' }],
      include: {
        tenant: { select: { id: true, slug: true, name: true } },
        edition: { select: { id: true, name: true, slug: true } },
        subEdition: { select: { id: true, name: true, slug: true } },
        pages: includePages ? { orderBy: { pageNumber: 'asc' } } : false,
      },
    });

    // Group by date for easier management
    const groupedByDate: Record<string, any[]> = {};
    issues.forEach((issue: any) => {
      const dateKey = issue.issueDate.toISOString().slice(0, 10);
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push({
        id: issue.id,
        edition: issue.edition,
        subEdition: issue.subEdition,
        pdfUrl: issue.pdfUrl,
        coverImageUrl: issue.coverImageUrl,
        pageCount: issue.pageCount,
        pages: includePages ? issue.pages : undefined,
        uploadedByUserId: issue.uploadedByUserId,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      });
    });

    return res.json({
      success: true,
      tenant: issues[0]?.tenant || { id: targetTenantId },
      totalIssues: issues.length,
      issuesByDate: groupedByDate,
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to fetch tenant issues');
  }
};

/**
 * Delete ePaper issue
 * - Deletes issue record and all associated pages
 * - Cleans up PDF and page images from object storage
 * - Only SUPER_ADMIN and DESK_EDITOR (own tenant) can delete
 */
export const deleteIssue = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    
    if (!ctx.isSuperAdmin && !ctx.isDeskEditor) {
      return res.status(403).json({ error: 'Only SUPER_ADMIN and DESK_EDITOR can delete issues' });
    }

    const issueId = asString((req.params as any).id);
    if (!issueId) {
      return res.status(400).json({ error: 'Issue ID is required' });
    }

    // Fetch issue with all related data
    const issue = await p.epaperPdfIssue.findUnique({
      where: { id: issueId },
      include: {
        pages: { orderBy: { pageNumber: 'asc' } },
        edition: { select: { id: true, name: true } },
        subEdition: { select: { id: true, name: true } },
      },
    });

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // DESK_EDITOR can only delete their own tenant's issues
    if (!ctx.isSuperAdmin && issue.tenantId !== ctx.tenantId) {
      return res.status(403).json({ error: 'You can only delete issues from your own tenant' });
    }

    // Delete from object storage (best-effort, continue even if some fail)
    const deletePromises: Promise<void>[] = [];

    // Delete PDF
    if (issue.pdfUrl) {
      const pdfKey = extractKeyFromUrl(issue.pdfUrl);
      if (pdfKey) {
        deletePromises.push(
          deletePublicObject({ key: pdfKey }).catch((err) => {
            console.warn(`Failed to delete PDF ${pdfKey}:`, err);
          })
        );
      }
    }

    // Delete all page images
    issue.pages.forEach((page: any) => {
      if (page.imageUrl) {
        const pageKey = extractKeyFromUrl(page.imageUrl);
        if (pageKey) {
          deletePromises.push(
            deletePublicObject({ key: pageKey }).catch((err) => {
              console.warn(`Failed to delete page ${pageKey}:`, err);
            })
          );
        }
      }
    });

    // Execute all deletions in parallel
    await Promise.allSettled(deletePromises);

    // Delete from database (pages will cascade delete)
    await p.epaperPdfIssue.delete({
      where: { id: issueId },
    });

    return res.json({
      success: true,
      message: 'Issue deleted successfully',
      deleted: {
        issueId: issue.id,
        issueDate: issue.issueDate,
        edition: issue.edition?.name,
        subEdition: issue.subEdition?.name,
        pdfUrl: issue.pdfUrl,
        pageCount: issue.pageCount,
        deletedAt: new Date(),
      },
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to delete issue');
  }
};

/**
 * Check if issue already exists for date/edition/sub-edition
 * Prevents duplicate uploads - used before upload
 */
export const checkIssueExists = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Admin only' });
    }

    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const issueDateStr = asString((req.query as any).issueDate);
    const editionId = asString((req.query as any).editionId || '');
    const subEditionId = asString((req.query as any).subEditionId || '');

    if (!issueDateStr) {
      return res.status(400).json({ error: 'issueDate is required' });
    }

    const issueDate = parseIsoDateOnly(issueDateStr);

    // Must provide exactly one: editionId OR subEditionId
    if ((editionId ? 1 : 0) + (subEditionId ? 1 : 0) !== 1) {
      return res.status(400).json({ error: 'Provide exactly one: editionId or subEditionId' });
    }

    const existingIssue = await p.epaperPdfIssue.findFirst({
      where: {
        tenantId: ctx.tenantId,
        issueDate,
        editionId: editionId || null,
        subEditionId: subEditionId || null,
      },
      include: {
        edition: { select: { id: true, name: true, slug: true } },
        subEdition: { select: { id: true, name: true, slug: true } },
      },
    });

    if (existingIssue) {
      return res.json({
        exists: true,
        message: 'Issue already exists for this date and edition/sub-edition',
        issue: {
          id: existingIssue.id,
          issueDate: existingIssue.issueDate,
          edition: existingIssue.edition,
          subEdition: existingIssue.subEdition,
          pdfUrl: existingIssue.pdfUrl,
          coverImageUrl: existingIssue.coverImageUrl,
          pageCount: existingIssue.pageCount,
          uploadedByUserId: existingIssue.uploadedByUserId,
          createdAt: existingIssue.createdAt,
          updatedAt: existingIssue.updatedAt,
        },
        action: {
          canReplace: true,
          canDelete: true,
          suggestion: 'Delete existing issue first or use replace/update endpoint',
        },
      });
    }

    return res.json({
      exists: false,
      message: 'No existing issue found. Safe to upload.',
      canUpload: true,
    });
  } catch (e: any) {
    return sendHttpError(res, e, 'Failed to check issue existence');
  }
};

/**
 * Helper: Extract object storage key from public URL
 */
function extractKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Remove leading slash
    let path = parsed.pathname;
    if (path.startsWith('/')) path = path.slice(1);
    return path || null;
  } catch {
    return null;
  }
}
