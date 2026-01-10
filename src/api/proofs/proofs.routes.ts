import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();

// Auth middleware
const requireAuth = passport.authenticate('jwt', { session: false });

// Check if user is super admin
const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { role: true }
  });
  
  if (!dbUser || dbUser.role.name !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  
  next();
};

// Check if user is tenant admin or super admin
const requireTenantAdminOrSuper = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { role: true, reporterProfile: true }
  });
  
  if (!dbUser) return res.status(401).json({ error: 'User not found' });
  
  const isSuperAdmin = dbUser.role.name === 'SUPER_ADMIN';
  const isTenantAdmin = dbUser.role.name === 'TENANT_ADMIN';
  const isEditor = dbUser.reporterProfile?.designationId && 
    ['EDITOR', 'CHIEF_EDITOR', 'SUB_EDITOR'].some(d => 
      dbUser.reporterProfile?.designationId?.toUpperCase().includes(d)
    );
  
  if (!isSuperAdmin && !isTenantAdmin && !isEditor) {
    return res.status(403).json({ error: 'Admin or Editor access required' });
  }
  
  (req as any).isSuperAdmin = isSuperAdmin;
  (req as any).isTenantAdmin = isTenantAdmin;
  next();
};

// ============================================================================
// PROOF REQUEST ENDPOINTS (Admin/Editor)
// ============================================================================

/**
 * @swagger
 * /api/v1/proofs/requests:
 *   get:
 *     summary: List all proof requests (admin)
 *     tags: [Proofs]
 */
router.get('/requests', requireAuth, requireTenantAdminOrSuper, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { tenantId, status, assignedToId, limit = '50', offset = '0' } = req.query;
    
    const where: any = {};
    
    // Super admin can see all, tenant admin only their tenant
    if (!(req as any).isSuperAdmin) {
      const reporter = await prisma.reporter.findFirst({ where: { userId: user.id } });
      if (!reporter) return res.status(403).json({ error: 'No reporter profile' });
      where.tenantId = reporter.tenantId;
    } else if (tenantId) {
      where.tenantId = tenantId as string;
    }
    
    if (status) where.status = status as string;
    if (assignedToId) where.assignedToId = assignedToId as string;
    
    const [requests, total] = await Promise.all([
      prisma.articleProofRequest.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } },
          assignedTo: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } },
          reviewedBy: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } },
          evidence: true,
          tenant: { select: { id: true, name: true, slug: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.articleProofRequest.count({ where })
    ]);
    
    res.json({ requests, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
  } catch (error: any) {
    console.error('List proof requests error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/v1/proofs/requests/{id}:
 *   get:
 *     summary: Get proof request details
 *     tags: [Proofs]
 */
router.get('/requests/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const request = await prisma.articleProofRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } },
        assignedTo: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } },
        reviewedBy: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } },
        evidence: {
          include: {
            uploadedBy: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } }
          },
          orderBy: { createdAt: 'asc' }
        },
        tenant: { select: { id: true, name: true, slug: true } }
      }
    });
    
    if (!request) return res.status(404).json({ error: 'Proof request not found' });
    
    // Fetch the article details based on type
    let article = null;
    if (request.articleType === 'web' && request.webArticleId) {
      article = await prisma.tenantWebArticle.findUnique({
        where: { id: request.webArticleId },
        select: { id: true, title: true, slug: true, status: true, coverImageUrl: true }
      });
    } else if (request.articleType === 'short' && request.shortNewsId) {
      article = await prisma.shortNews.findUnique({
        where: { id: request.shortNewsId },
        select: { id: true, title: true, slug: true, status: true, featuredImage: true }
      });
    } else if (request.articleType === 'article' && request.articleId) {
      article = await prisma.article.findUnique({
        where: { id: request.articleId },
        select: { id: true, title: true, status: true, images: true }
      });
    }
    
    res.json({ ...request, article });
  } catch (error: any) {
    console.error('Get proof request error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/v1/articles/{articleId}/request-proof:
 *   post:
 *     summary: Request proof from reporter for an article
 *     tags: [Proofs]
 */
router.post('/articles/:articleId/request-proof', requireAuth, requireTenantAdminOrSuper, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { articleId } = req.params;
    const { articleType, reason, priority = 'NORMAL', dueDate, assignedToId } = req.body;
    
    if (!articleType || !['web', 'short', 'article'].includes(articleType)) {
      return res.status(400).json({ error: 'articleType must be "web", "short", or "article"' });
    }
    
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }
    
    // Fetch the article and validate
    let article: any = null;
    let authorId: string | null = null;
    let tenantId: string | null = null;
    let previousStatus: string = '';
    
    if (articleType === 'web') {
      article = await prisma.tenantWebArticle.findUnique({ where: { id: articleId } });
      if (!article) return res.status(404).json({ error: 'Web article not found' });
      authorId = article.authorId;
      tenantId = article.tenantId;
      previousStatus = article.status;
    } else if (articleType === 'short') {
      article = await prisma.shortNews.findUnique({ where: { id: articleId } });
      if (!article) return res.status(404).json({ error: 'Short news not found' });
      authorId = article.authorId;
      // Short news may not have tenantId, get from reporter
      const reporter = await prisma.reporter.findFirst({ where: { userId: article.authorId } });
      tenantId = reporter?.tenantId || null;
      previousStatus = article.status;
    } else {
      article = await prisma.article.findUnique({ where: { id: articleId } });
      if (!article) return res.status(404).json({ error: 'Article not found' });
      authorId = article.authorId;
      tenantId = article.tenantId;
      previousStatus = article.status;
    }
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Article must belong to a tenant' });
    }
    
    // Check if there's already a pending proof request
    const existingRequest = await prisma.articleProofRequest.findFirst({
      where: {
        OR: [
          { webArticleId: articleType === 'web' ? articleId : undefined },
          { shortNewsId: articleType === 'short' ? articleId : undefined },
          { articleId: articleType === 'article' ? articleId : undefined }
        ],
        status: { in: ['PENDING', 'SUBMITTED'] }
      }
    });
    
    if (existingRequest) {
      return res.status(400).json({ 
        error: 'Active proof request already exists for this article',
        existingRequestId: existingRequest.id
      });
    }
    
    // Determine who to assign to (default: article author)
    const finalAssignedToId = assignedToId || authorId;
    if (!finalAssignedToId) {
      return res.status(400).json({ error: 'Cannot determine reporter to assign proof request' });
    }
    
    // Create proof request
    const proofRequest = await prisma.articleProofRequest.create({
      data: {
        articleType,
        webArticleId: articleType === 'web' ? articleId : null,
        shortNewsId: articleType === 'short' ? articleId : null,
        articleId: articleType === 'article' ? articleId : null,
        tenantId,
        requestedById: user.id,
        assignedToId: finalAssignedToId,
        reason,
        priority,
        previousStatus,
        dueDate: dueDate ? new Date(dueDate) : null
      },
      include: {
        requestedBy: { select: { id: true, profile: { select: { fullName: true } } } },
        assignedTo: { select: { id: true, profile: { select: { fullName: true } } } }
      }
    });
    
    // Update article status to EVIDENCE_PENDING if it was PUBLISHED
    if (previousStatus === 'PUBLISHED') {
      if (articleType === 'web') {
        await prisma.tenantWebArticle.update({
          where: { id: articleId },
          data: { status: 'EVIDENCE_PENDING' }
        });
      } else if (articleType === 'short') {
        await prisma.shortNews.update({
          where: { id: articleId },
          data: { status: 'EVIDENCE_PENDING' }
        });
      } else {
        await prisma.article.update({
          where: { id: articleId },
          data: { status: 'EVIDENCE_PENDING' }
        });
      }
    }
    
    res.status(201).json({
      proofRequest,
      articleStatusChanged: previousStatus === 'PUBLISHED',
      newStatus: previousStatus === 'PUBLISHED' ? 'EVIDENCE_PENDING' : previousStatus
    });
  } catch (error: any) {
    console.error('Request proof error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// REPORTER ENDPOINTS (Upload Evidence)
// ============================================================================

/**
 * @swagger
 * /api/v1/proofs/my-requests:
 *   get:
 *     summary: List proof requests assigned to current reporter
 *     tags: [Proofs]
 */
router.get('/my-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { status, limit = '50', offset = '0' } = req.query;
    
    const where: any = { assignedToId: user.id };
    if (status) where.status = status as string;
    
    const [requests, total] = await Promise.all([
      prisma.articleProofRequest.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, profile: { select: { fullName: true } } } },
          evidence: true,
          tenant: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.articleProofRequest.count({ where })
    ]);
    
    // Fetch article info for each request
    const requestsWithArticles = await Promise.all(requests.map(async (proofReq: any) => {
      let article = null;
      if (proofReq.articleType === 'web' && proofReq.webArticleId) {
        article = await prisma.tenantWebArticle.findUnique({
          where: { id: proofReq.webArticleId },
          select: { id: true, title: true, slug: true, status: true }
        });
      } else if (proofReq.articleType === 'short' && proofReq.shortNewsId) {
        article = await prisma.shortNews.findUnique({
          where: { id: proofReq.shortNewsId },
          select: { id: true, title: true, slug: true, status: true }
        });
      } else if (proofReq.articleType === 'article' && proofReq.articleId) {
        article = await prisma.article.findUnique({
          where: { id: proofReq.articleId },
          select: { id: true, title: true, status: true }
        });
      }
      return { ...proofReq, article };
    }));
    
    res.json({ requests: requestsWithArticles, total });
  } catch (error: any) {
    console.error('List my proof requests error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/v1/proofs/requests/{id}/evidence:
 *   post:
 *     summary: Upload evidence for a proof request (reporter)
 *     tags: [Proofs]
 */
router.post('/requests/:id/evidence', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const { evidence } = req.body;
    
    // evidence should be an array: [{ mediaType, mediaUrl, description?, thumbnailUrl?, fileName?, fileSize?, mimeType? }]
    if (!evidence || !Array.isArray(evidence) || evidence.length === 0) {
      return res.status(400).json({ error: 'evidence array is required with at least one item' });
    }
    
    // Validate each evidence item
    for (const item of evidence) {
      if (!item.mediaType || !['IMAGE', 'VIDEO', 'DOCUMENT'].includes(item.mediaType)) {
        return res.status(400).json({ error: 'Each evidence must have mediaType: IMAGE, VIDEO, or DOCUMENT' });
      }
      if (!item.mediaUrl) {
        return res.status(400).json({ error: 'Each evidence must have mediaUrl' });
      }
    }
    
    // Fetch proof request
    const proofRequest = await prisma.articleProofRequest.findUnique({ where: { id } });
    if (!proofRequest) return res.status(404).json({ error: 'Proof request not found' });
    
    // Check if user is assigned to this request
    if (proofRequest.assignedToId !== user.id) {
      return res.status(403).json({ error: 'You are not assigned to this proof request' });
    }
    
    // Check status
    if (!['PENDING', 'SUBMITTED'].includes(proofRequest.status)) {
      return res.status(400).json({ error: `Cannot add evidence to ${proofRequest.status} request` });
    }
    
    // Create evidence records
    const createdEvidence = await prisma.articleProofEvidence.createMany({
      data: evidence.map((item: any) => ({
        proofRequestId: id,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        thumbnailUrl: item.thumbnailUrl || null,
        fileName: item.fileName || null,
        fileSize: item.fileSize || null,
        mimeType: item.mimeType || null,
        description: item.description || null,
        uploadedById: user.id
      }))
    });
    
    // Update request status to SUBMITTED if it was PENDING
    if (proofRequest.status === 'PENDING') {
      await prisma.articleProofRequest.update({
        where: { id },
        data: { 
          status: 'SUBMITTED',
          submittedAt: new Date()
        }
      });
    }
    
    // Fetch updated request with evidence
    const updated = await prisma.articleProofRequest.findUnique({
      where: { id },
      include: {
        evidence: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    res.status(201).json({
      message: `${createdEvidence.count} evidence item(s) uploaded`,
      proofRequest: updated
    });
  } catch (error: any) {
    console.error('Upload evidence error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/v1/proofs/requests/{id}/submit:
 *   post:
 *     summary: Submit proof request for review (reporter)
 *     tags: [Proofs]
 */
router.post('/requests/:id/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    
    const proofRequest = await prisma.articleProofRequest.findUnique({
      where: { id },
      include: { evidence: true }
    });
    
    if (!proofRequest) return res.status(404).json({ error: 'Proof request not found' });
    
    if (proofRequest.assignedToId !== user.id) {
      return res.status(403).json({ error: 'You are not assigned to this proof request' });
    }
    
    if (proofRequest.status !== 'PENDING') {
      return res.status(400).json({ error: `Request is already ${proofRequest.status}` });
    }
    
    if (proofRequest.evidence.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one evidence before submitting' });
    }
    
    const updated = await prisma.articleProofRequest.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date()
      },
      include: { evidence: true }
    });
    
    res.json({ message: 'Proof request submitted for review', proofRequest: updated });
  } catch (error: any) {
    console.error('Submit proof error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ADMIN REVIEW ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/v1/proofs/requests/{id}/approve:
 *   patch:
 *     summary: Approve evidence and publish article
 *     tags: [Proofs]
 */
router.patch('/requests/:id/approve', requireAuth, requireTenantAdminOrSuper, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const { reviewNote } = req.body;
    
    const proofRequest = await prisma.articleProofRequest.findUnique({
      where: { id },
      include: { evidence: true }
    });
    
    if (!proofRequest) return res.status(404).json({ error: 'Proof request not found' });
    
    if (proofRequest.status !== 'SUBMITTED') {
      return res.status(400).json({ error: `Can only approve SUBMITTED requests, current: ${proofRequest.status}` });
    }
    
    // Update proof request
    const updated = await prisma.articleProofRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: user.id,
        reviewNote: reviewNote || null,
        resolvedAt: new Date()
      }
    });
    
    // Publish the article
    let articleUpdated = false;
    if (proofRequest.articleType === 'web' && proofRequest.webArticleId) {
      await prisma.tenantWebArticle.update({
        where: { id: proofRequest.webArticleId },
        data: { status: 'PUBLISHED', publishedAt: new Date() }
      });
      articleUpdated = true;
    } else if (proofRequest.articleType === 'short' && proofRequest.shortNewsId) {
      await prisma.shortNews.update({
        where: { id: proofRequest.shortNewsId },
        data: { status: 'DESK_APPROVED', publishDate: new Date() }
      });
      articleUpdated = true;
    } else if (proofRequest.articleType === 'article' && proofRequest.articleId) {
      await prisma.article.update({
        where: { id: proofRequest.articleId },
        data: { status: 'PUBLISHED' }
      });
      articleUpdated = true;
    }
    
    res.json({
      message: 'Proof approved and article published',
      proofRequest: updated,
      articlePublished: articleUpdated
    });
  } catch (error: any) {
    console.error('Approve proof error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/v1/proofs/requests/{id}/reject:
 *   patch:
 *     summary: Reject evidence
 *     tags: [Proofs]
 */
router.patch('/requests/:id/reject', requireAuth, requireTenantAdminOrSuper, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const { reviewNote } = req.body;
    
    if (!reviewNote) {
      return res.status(400).json({ error: 'reviewNote is required when rejecting' });
    }
    
    const proofRequest = await prisma.articleProofRequest.findUnique({ where: { id } });
    if (!proofRequest) return res.status(404).json({ error: 'Proof request not found' });
    
    if (!['PENDING', 'SUBMITTED'].includes(proofRequest.status)) {
      return res.status(400).json({ error: `Cannot reject ${proofRequest.status} request` });
    }
    
    // Update proof request
    const updated = await prisma.articleProofRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: user.id,
        reviewNote,
        resolvedAt: new Date()
      }
    });
    
    // Set article to PENDING (not published)
    if (proofRequest.articleType === 'web' && proofRequest.webArticleId) {
      await prisma.tenantWebArticle.update({
        where: { id: proofRequest.webArticleId },
        data: { status: 'PENDING' }
      });
    } else if (proofRequest.articleType === 'short' && proofRequest.shortNewsId) {
      await prisma.shortNews.update({
        where: { id: proofRequest.shortNewsId },
        data: { status: 'PENDING' }
      });
    } else if (proofRequest.articleType === 'article' && proofRequest.articleId) {
      await prisma.article.update({
        where: { id: proofRequest.articleId },
        data: { status: 'PENDING' }
      });
    }
    
    res.json({
      message: 'Proof rejected, article moved to pending',
      proofRequest: updated
    });
  } catch (error: any) {
    console.error('Reject proof error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/v1/proofs/requests/{id}/request-more:
 *   patch:
 *     summary: Request more evidence from reporter
 *     tags: [Proofs]
 */
router.patch('/requests/:id/request-more', requireAuth, requireTenantAdminOrSuper, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const { reviewNote } = req.body;
    
    if (!reviewNote) {
      return res.status(400).json({ error: 'reviewNote is required to explain what more is needed' });
    }
    
    const proofRequest = await prisma.articleProofRequest.findUnique({ where: { id } });
    if (!proofRequest) return res.status(404).json({ error: 'Proof request not found' });
    
    if (proofRequest.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Can only request more evidence from SUBMITTED requests' });
    }
    
    // Reset to PENDING so reporter can upload more
    const updated = await prisma.articleProofRequest.update({
      where: { id },
      data: {
        status: 'PENDING',
        reviewNote,
        submittedAt: null
      }
    });
    
    res.json({
      message: 'Requested more evidence from reporter',
      proofRequest: updated
    });
  } catch (error: any) {
    console.error('Request more evidence error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/v1/proofs/evidence/{evidenceId}:
 *   delete:
 *     summary: Delete a specific evidence item
 *     tags: [Proofs]
 */
router.delete('/evidence/:evidenceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { evidenceId } = req.params;
    
    const evidence = await prisma.articleProofEvidence.findUnique({
      where: { id: evidenceId },
      include: { proofRequest: true }
    });
    
    if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
    
    // Only uploader or admin can delete
    const isUploader = evidence.uploadedById === user.id;
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true }
    });
    const isAdmin = dbUser?.role.name === 'SUPER_ADMIN' || dbUser?.role.name === 'TENANT_ADMIN';
    
    if (!isUploader && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this evidence' });
    }
    
    // Can't delete if already approved/rejected
    if (['APPROVED', 'REJECTED'].includes(evidence.proofRequest.status)) {
      return res.status(400).json({ error: 'Cannot delete evidence from resolved requests' });
    }
    
    await prisma.articleProofEvidence.delete({ where: { id: evidenceId } });
    
    res.json({ message: 'Evidence deleted' });
  } catch (error: any) {
    console.error('Delete evidence error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
