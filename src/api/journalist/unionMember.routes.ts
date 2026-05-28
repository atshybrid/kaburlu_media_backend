/**
 * Union member create / join / document approval APIs.
 * Swagger: src/api/journalist/journalistUnion.swagger.ts
 */
import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import multer from 'multer';
import prisma from '../../lib/prisma';
import { requireSuperAdmin, requireSuperOrTenantAdmin } from '../middlewares/authz';
import { generatePressCardBuffer } from '../../lib/journalistPressCardPdf';
import {
  applyDocumentUpload,
  buildDocumentsPayload,
  buildUnionMemberLoginContext,
  canDownloadUnionIdCard,
  cleanText,
  ensureCardAndNotify,
  ensureNonTenantReporterRole,
  ensureUserWithMpin,
  formatMemberApprovalRow,
  loadUserForMemberCreate,
  maskAadhaarLast4,
  resolveAdminTenantScope,
  setDocumentApproval,
  type DocKey,
  type JournalistMemberTypeValue,
} from '../../lib/journalistUnionMember';

const p: any = prisma;
const router = Router();
const jwtAuth = passport.authenticate('jwt', { session: false });

const uploadDocs = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype);
    cb(null, ok);
  },
});

const uploadFields = uploadDocs.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'aadhaar', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'workingIdCard', maxCount: 1 },
]);

function currentUser(req: Request) {
  return (req as any).user as { id: string; role: { name: string } };
}

function filesMap(req: Request): Record<string, Express.Multer.File> {
  const f = req.files as Record<string, Express.Multer.File[]> | undefined;
  const out: Record<string, Express.Multer.File> = {};
  if (!f) return out;
  for (const [k, arr] of Object.entries(f)) {
    if (arr?.[0]) out[k] = arr[0];
  }
  return out;
}

async function requireReporterJwt(req: Request, res: Response, next: NextFunction) {
  jwtAuth(req, res, (err?: any) => {
    if (err) return next(err);
    const user = currentUser(req);
    if (user?.role?.name !== 'REPORTER') {
      return res.status(403).json({ error: 'Tenant reporter login required' });
    }
    return next();
  });
}

async function requireUnionMemberJwt(req: Request, res: Response, next: NextFunction) {
  jwtAuth(req, res, async (err?: any) => {
    if (err) return next(err);
    try {
      const user = currentUser(req);
      const profile = await p.journalistProfile.findUnique({ where: { userId: user.id } });
      if (!profile) {
        return res.status(403).json({ code: 'UNION_MEMBER_REQUIRED', message: 'Union membership profile required' });
      }
      (res.locals as any).journalistProfile = profile;
      return next();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed' });
    }
  });
}

async function applyOptionalUploads(
  profileId: string,
  files: Record<string, Express.Multer.File>,
  autoApprove: boolean,
) {
  const keys: DocKey[] = ['photo', 'aadhaar', 'pan', 'workingIdCard'];
  for (const key of keys) {
    if (files[key]) await applyDocumentUpload(profileId, key, files[key], { autoApprove });
  }
}

router.post(
  '/admin/members/create',
  jwtAuth,
  requireSuperOrTenantAdmin,
  uploadFields,
  async (req: Request, res: Response) => {
    try {
      const user = currentUser(req);
      const scope = await resolveAdminTenantScope(user.id, user.role.name);
      const memberType = cleanText(req.body.memberType)?.toUpperCase() as JournalistMemberTypeValue;
      const mobileNumber = cleanText(req.body.mobileNumber);
      const unionName = cleanText(req.body.unionName);

      if (!mobileNumber || !unionName) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_REQUIRED_FIELDS',
          error: 'mobileNumber and unionName are required',
        });
      }
      if (!memberType || !['TENANT_REPORTER', 'NON_TENANT_REPORTER'].includes(memberType)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_MEMBER_TYPE',
          error: 'memberType must be TENANT_REPORTER or NON_TENANT_REPORTER',
        });
      }

      if (!scope.isSuperAdmin && memberType !== 'TENANT_REPORTER') {
        return res.status(403).json({
          success: false,
          code: 'TENANT_ADMIN_SCOPE_DENIED',
          error: 'Tenant Admin can only create TENANT_REPORTER members for their newspaper',
        });
      }

      const existingUser = await loadUserForMemberCreate(mobileNumber);
      if (existingUser?.journalistProfile) {
        return res.status(409).json({
          success: false,
          code: 'UNION_MEMBER_ALREADY_EXISTS',
          error: 'Mobile already registered as union member',
          profileId: existingUser.journalistProfile.id,
          profile: existingUser.journalistProfile,
        });
      }

      const autoApproveMembership = String(req.body.autoApproveMembership ?? 'true') === 'true';
      const autoApproveDocuments = String(req.body.autoApproveDocuments ?? 'false') === 'true';
      const skipRequiredUploads = String(req.body.skipRequiredUploads ?? 'true') === 'true';
      const files = filesMap(req);

      const lang =
        (await p.language.findFirst({ where: { code: 'te' } })) || (await p.language.findFirst());
      if (!lang) {
        return res.status(500).json({
          success: false,
          code: 'NO_LANGUAGE_CONFIGURED',
          error: 'No language configured',
        });
      }

      if (memberType === 'TENANT_REPORTER') {
        if (!existingUser?.reporterProfile) {
          return res.status(400).json({
            success: false,
            code: 'TENANT_REPORTER_NOT_FOUND',
            error: 'No tenant reporter found for this mobile number',
            hint: 'User must exist as REPORTER under your newspaper before union create',
          });
        }
        if (!scope.isSuperAdmin && existingUser.reporterProfile.tenantId !== scope.tenantId) {
          return res.status(403).json({
            success: false,
            code: 'TENANT_MISMATCH',
            error: 'Reporter belongs to a different tenant',
          });
        }

        const rp = existingUser.reporterProfile;
        const loginUser =
          existingUser ||
          (await ensureUserWithMpin(
            mobileNumber,
            cleanText(req.body.mpin) || mobileNumber.slice(-4),
            (
              await p.role.findUnique({ where: { name: 'REPORTER' } })
            )?.id || (await ensureNonTenantReporterRole()).id,
            lang.id,
          ));

        await p.userProfile.upsert({
          where: { userId: loginUser.id },
          create: {
            userId: loginUser.id,
            fullName: existingUser.profile?.fullName || `Reporter ${mobileNumber.slice(-4)}`,
          },
          update: {},
        });

        let profile = await p.journalistProfile.create({
          data: {
            userId: loginUser.id,
            memberType: 'TENANT_REPORTER',
            designation: rp.designation?.name || 'Reporter',
            district: rp.district?.name || 'Unknown',
            state: rp.state?.name,
            mandal: rp.mandal?.name,
            organization: rp.tenant?.name || 'Reporter',
            unionName,
            linkedTenantId: rp.tenantId,
            linkedTenantName: rp.tenant?.name,
            currentNewspaper: rp.tenant?.name,
            currentDesignation: rp.designation?.name,
            approved: autoApproveMembership,
            approvedAt: autoApproveMembership ? new Date() : null,
            photoUrl: rp.profilePhotoUrl || existingUser.profile?.profilePhotoUrl,
            photoApprovalStatus: rp.profilePhotoUrl || existingUser.profile?.profilePhotoUrl
              ? autoApproveDocuments ? 'APPROVED' : 'PENDING'
              : 'NOT_UPLOADED',
            photoApprovedAt:
              (rp.profilePhotoUrl || existingUser.profile?.profilePhotoUrl) && autoApproveDocuments
                ? new Date()
                : null,
          },
        });

        await applyOptionalUploads(profile.id, files, autoApproveDocuments);

        profile = await p.journalistProfile.findUnique({ where: { id: profile.id }, include: { card: true } });

        let cardFlow: any = { skipped: true };
        if (autoApproveMembership && profile.photoUrl) {
          cardFlow = await ensureCardAndNotify(
            profile.id,
            mobileNumber,
            profile.linkedTenantName || profile.organization,
            profile.pressId,
            { onlyIfPhoto: true },
          );
        }

        const loginPayload = await buildLoginPreview(loginUser.id);

        return res.status(201).json({
          success: true,
          code: 'TENANT_REPORTER_CREATED',
          message: 'Tenant reporter union member created',
          memberType: 'TENANT_REPORTER',
          member: profile,
          documents: buildDocumentsPayload(profile),
          idCard: cardFlow,
          login: loginPayload,
        });
      }

      // NON_TENANT_REPORTER — super admin only
      const fullName = cleanText(req.body.fullName);
      const fatherName = cleanText(req.body.fatherName);
      const currentNewspaper = cleanText(req.body.currentNewspaper) || cleanText(req.body.currentWorkingPaper);
      const workingArea = cleanText(req.body.workingArea);
      const designation = cleanText(req.body.designation) || cleanText(req.body.currentJournalistRole);
      const publisherMobileNumber = cleanText(req.body.publisherMobileNumber);
      const totalExperienceYears = req.body.totalExperienceYears
        ? parseInt(String(req.body.totalExperienceYears), 10)
        : null;

      if (!fullName || !currentNewspaper || !workingArea || !designation) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_NON_TENANT_FIELDS',
          error: 'fullName, currentNewspaper, workingArea, and designation (currentJournalistRole) are required',
        });
      }
      if (!publisherMobileNumber) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_PUBLISHER_MOBILE',
          error: 'publisherMobileNumber is required',
        });
      }

      if (!skipRequiredUploads && (!files.photo || !files.aadhaar || !files.pan || !files.workingIdCard)) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_DOCUMENT_UPLOADS',
          error: 'photo, aadhaar, pan, and workingIdCard uploads are required unless skipRequiredUploads=true',
          missing: ['photo', 'aadhaar', 'pan', 'workingIdCard'].filter((k) => !files[k as DocKey]),
        });
      }

      const role = await ensureNonTenantReporterRole();
      const mpin = cleanText(req.body.mpin) || mobileNumber.slice(-4);
      if (!/^\d{4}$/.test(mpin)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_MPIN',
          error: 'mpin must be 4 digits',
        });
      }

      const loginUser = await ensureUserWithMpin(mobileNumber, mpin, role.id, lang.id, { forceRole: true });

      await p.userProfile.upsert({
        where: { userId: loginUser.id },
        create: { userId: loginUser.id, fullName },
        update: { fullName },
      });

      let profile = await p.journalistProfile.create({
        data: {
          userId: loginUser.id,
          memberType: 'NON_TENANT_REPORTER',
          fatherName,
          workingArea,
          publisherMobileNumber,
          designation,
          district: workingArea,
          organization: currentNewspaper,
          currentNewspaper,
          currentDesignation: designation,
          unionName,
          state: cleanText(req.body.state),
          mandal: cleanText(req.body.mandal),
          totalExperienceYears: Number.isFinite(totalExperienceYears) ? totalExperienceYears : null,
          aadhaarNumber: maskAadhaarLast4(req.body.aadhaarNumber),
          approved: autoApproveMembership,
          approvedAt: autoApproveMembership ? new Date() : null,
        },
      });

      await applyOptionalUploads(profile.id, files, autoApproveDocuments);
      profile = await p.journalistProfile.findUnique({ where: { id: profile.id }, include: { card: true } });

      const loginPayload = await buildLoginPreview(loginUser.id);

      return res.status(201).json({
        success: true,
        code: 'NON_TENANT_REPORTER_CREATED',
        message: 'Non-tenant reporter union member created',
        memberType: 'NON_TENANT_REPORTER',
        role: 'NON_TENANT_REPORTER',
        member: profile,
        documents: buildDocumentsPayload(profile),
        login: loginPayload,
        mpinHint: 'Login with mobileNumber and mpin (default last 4 digits of mobile)',
      });
    } catch (e: any) {
      console.error('[unionMember/admin/create]', e);
      return res.status(500).json({
        success: false,
        code: 'CREATE_FAILED',
        error: e?.message || 'Create failed',
      });
    }
  },
);

async function buildLoginPreview(userId: string) {
  const user = await p.user.findUnique({
    where: { id: userId },
    include: { role: true, journalistProfile: { include: { card: true } } },
  });
  if (!user?.journalistProfile) return null;
  return {
    mobileNumber: user.mobileNumber,
    role: user.role?.name,
    unionMember: buildUnionMemberLoginContext(user.journalistProfile, user.journalistProfile.card),
  };
}

router.post('/members/join', requireReporterJwt, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const unionName = cleanText(req.body.unionName);
    if (!unionName) return res.status(400).json({ error: 'unionName is required' });

    const existing = await p.journalistProfile.findUnique({ where: { userId: user.id } });
    if (existing) {
      const card = await p.journalistCard.findUnique({ where: { profileId: existing.id } });
      const download = canDownloadUnionIdCard(existing, card);
      return res.status(200).json({
        message: 'Already a union member',
        member: existing,
        documents: buildDocumentsPayload(existing),
        canDownloadIdCard: download.allowed,
        unionPressCard: card,
      });
    }

    const reporter = await p.reporter.findUnique({
      where: { userId: user.id },
      include: {
        tenant: { select: { id: true, name: true } },
        state: { select: { name: true } },
        district: { select: { name: true } },
        mandal: { select: { name: true } },
        designation: { select: { name: true } },
      },
    });
    if (!reporter) {
      return res.status(403).json({ error: 'Tenant reporter profile required' });
    }

    const hasPhoto = !!(reporter.profilePhotoUrl);
    let profile = await p.journalistProfile.create({
      data: {
        userId: user.id,
        memberType: 'TENANT_REPORTER',
        designation: reporter.designation?.name || 'Reporter',
        district: reporter.district?.name || 'Unknown',
        state: reporter.state?.name,
        mandal: reporter.mandal?.name,
        organization: reporter.tenant?.name || 'Reporter',
        unionName,
        linkedTenantId: reporter.tenantId,
        linkedTenantName: reporter.tenant?.name,
        currentNewspaper: reporter.tenant?.name,
        currentDesignation: reporter.designation?.name,
        approved: true,
        approvedAt: new Date(),
        photoUrl: reporter.profilePhotoUrl,
        photoApprovalStatus: hasPhoto ? 'APPROVED' : 'NOT_UPLOADED',
        photoApprovedAt: hasPhoto ? new Date() : null,
      },
    });

    let cardFlow: any = { skipped: true };
    if (hasPhoto) {
      cardFlow = await ensureCardAndNotify(
        profile.id,
        (await p.user.findUnique({ where: { id: user.id }, select: { mobileNumber: true } }))?.mobileNumber,
        profile.linkedTenantName || profile.organization,
        profile.pressId,
        { onlyIfPhoto: true },
      );
    }

    profile = await p.journalistProfile.findUnique({ where: { id: profile.id }, include: { card: true } });
    const download = canDownloadUnionIdCard(profile, profile.card);

    return res.status(201).json({
      message: 'Joined journalist union',
      memberType: 'TENANT_REPORTER',
      member: profile,
      documents: buildDocumentsPayload(profile),
      canDownloadIdCard: download.allowed,
      idCardDownloadAvailable: download.allowed,
      idCard: cardFlow,
    });
  } catch (e: any) {
    console.error('[unionMember/join]', e);
    return res.status(500).json({ error: e?.message || 'Join failed' });
  }
});

router.post('/public/join-union', uploadFields, async (req: Request, res: Response) => {
  try {
    const mobileNumber = cleanText(req.body.mobileNumber);
    const unionName = cleanText(req.body.unionName);
    const fullName = cleanText(req.body.fullName);
    const fatherName = cleanText(req.body.fatherName);
    const currentNewspaper = cleanText(req.body.currentNewspaper);
    const workingArea = cleanText(req.body.workingArea);
    const designation = cleanText(req.body.designation);
    const publisherMobileNumber = cleanText(req.body.publisherMobileNumber);
    const files = filesMap(req);

    if (!mobileNumber || !unionName || !fullName || !currentNewspaper || !workingArea || !designation) {
      return res.status(400).json({
        error: 'mobileNumber, unionName, fullName, currentNewspaper, workingArea, designation are required',
      });
    }
    if (!publisherMobileNumber) {
      return res.status(400).json({ error: 'publisherMobileNumber is required' });
    }
    if (!files.photo || !files.aadhaar || !files.pan || !files.workingIdCard) {
      return res.status(400).json({
        error: 'photo, aadhaar, pan, and workingIdCard files are required',
      });
    }

    const existing = await loadUserForMemberCreate(mobileNumber);
    if (existing?.journalistProfile) {
      return res.status(409).json({ error: 'Already registered', profile: existing.journalistProfile });
    }

    const lang =
      (await p.language.findFirst({ where: { code: 'te' } })) || (await p.language.findFirst());
    if (!lang) return res.status(500).json({ error: 'No language configured' });

    const role = await ensureNonTenantReporterRole();
    const mpin = mobileNumber.slice(-4);
    const loginUser = await ensureUserWithMpin(mobileNumber, mpin, role.id, lang.id, { forceRole: true });

    await p.userProfile.upsert({
      where: { userId: loginUser.id },
      create: { userId: loginUser.id, fullName },
      update: { fullName },
    });

    let profile = await p.journalistProfile.create({
      data: {
        userId: loginUser.id,
        memberType: 'NON_TENANT_REPORTER',
        fatherName,
        workingArea,
        publisherMobileNumber,
        designation,
        district: workingArea,
        organization: currentNewspaper,
        currentNewspaper,
        currentDesignation: designation,
        unionName,
        state: cleanText(req.body.state),
        mandal: cleanText(req.body.mandal),
        totalExperienceYears: req.body.totalExperienceYears
          ? parseInt(String(req.body.totalExperienceYears), 10)
          : null,
        aadhaarNumber: maskAadhaarLast4(req.body.aadhaarNumber),
        approved: false,
      },
    });

    await applyOptionalUploads(profile.id, files, false);
    profile = await p.journalistProfile.findUnique({ where: { id: profile.id } });

    return res.status(201).json({
      message: 'Application submitted. Login with mobile and last 4 digits as MPIN. Awaiting super admin approval.',
      membershipStatus: 'PENDING',
      memberType: 'NON_TENANT_REPORTER',
      role: 'NON_TENANT_REPORTER',
      member: profile,
      documents: buildDocumentsPayload(profile),
      canDownloadIdCard: false,
      login: {
        mobileNumber,
        mpin: 'Use last 4 digits of mobile number',
        role: 'NON_TENANT_REPORTER',
      },
    });
  } catch (e: any) {
    console.error('[unionMember/public/join-union]', e);
    return res.status(500).json({ error: e?.message || 'Registration failed' });
  }
});

router.get('/members/me/status', requireUnionMemberJwt, async (req: Request, res: Response) => {
  const profile = (res.locals as any).journalistProfile;
  const card = await p.journalistCard.findUnique({ where: { profileId: profile.id } });
  const download = canDownloadUnionIdCard(profile, card);
  return res.json({
    ...buildUnionMemberLoginContext(profile, card),
    idCardDownloadUrl: download.allowed ? `/api/v1/journalist/members/id-card/download` : null,
  });
});

router.get('/members/id-card/download', requireUnionMemberJwt, async (req: Request, res: Response) => {
  const profile = (res.locals as any).journalistProfile;
  const card = await p.journalistCard.findUnique({ where: { profileId: profile.id } });
  const download = canDownloadUnionIdCard(profile, card);
  if (!download.allowed) {
    return res.status(403).json({
      error: 'ID card download not available',
      reason: download.reason,
      documents: buildDocumentsPayload(profile),
      membershipStatus: profile.approved ? 'APPROVED' : 'PENDING',
    });
  }
  if (card?.pdfUrl) {
    return res.redirect(302, card.pdfUrl);
  }
  const result = await generatePressCardBuffer(profile.id);
  if (!result.ok || !result.pdfBuffer) {
    return res.status(500).json({ error: result.error || 'PDF generation failed' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Union_Press_ID_${card?.cardNumber || profile.id}.pdf"`);
  return res.end(result.pdfBuffer);
});

router.get('/admin/members/pending', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10)));
    const skip = (page - 1) * limit;
    const statusFilter = cleanText(q.status) || 'all_pending';
    const unionName = cleanText(q.unionName);
    const memberType = cleanText(q.memberType)?.toUpperCase();

    const where: any = {};

    if (unionName) where.unionName = { contains: unionName, mode: 'insensitive' };
    if (memberType && ['TENANT_REPORTER', 'NON_TENANT_REPORTER'].includes(memberType)) {
      where.memberType = memberType;
    }

    if (statusFilter === 'pending_membership') {
      where.approved = false;
    } else if (statusFilter === 'pending_documents') {
      where.OR = [
        { photoApprovalStatus: 'PENDING' },
        { aadhaarApprovalStatus: 'PENDING' },
        { panApprovalStatus: 'PENDING' },
        { workingIdCardApprovalStatus: 'PENDING' },
      ];
    } else {
      where.OR = [
        { approved: false },
        { photoApprovalStatus: 'PENDING' },
        { aadhaarApprovalStatus: 'PENDING' },
        { panApprovalStatus: 'PENDING' },
        { workingIdCardApprovalStatus: 'PENDING' },
      ];
    }

    const [total, rows] = await Promise.all([
      p.journalistProfile.count({ where }),
      p.journalistProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          card: true,
          user: {
            select: {
              id: true,
              mobileNumber: true,
              profile: { select: { fullName: true, profilePhotoUrl: true } },
            },
          },
        },
      }),
    ]);

    const items = rows.map((profile: any) => formatMemberApprovalRow(profile));

    return res.json({
      statusFilter,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
      items,
    });
  } catch (e: any) {
    console.error('[unionMember/admin/members/pending]', e);
    return res.status(500).json({ error: e?.message || 'Failed to load pending members' });
  }
});

router.get('/admin/members/:profileId', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const profile = await p.journalistProfile.findUnique({
      where: { id: req.params.profileId },
      include: {
        card: true,
        user: {
          select: {
            id: true,
            mobileNumber: true,
            profile: { select: { fullName: true, profilePhotoUrl: true } },
          },
        },
      },
    });
    if (!profile) return res.status(404).json({ error: 'Member not found' });
    return res.json(formatMemberApprovalRow(profile));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed' });
  }
});

router.patch(
  '/admin/members/:profileId/approve-membership',
  jwtAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const { profileId } = req.params;
      const { approved, pressId, generateIdCard } = req.body;
      if (typeof approved !== 'boolean') {
        return res.status(400).json({ error: 'approved boolean required' });
      }

      const profile = await p.journalistProfile.update({
        where: { id: profileId },
        data: {
          approved,
          approvedAt: approved ? new Date() : null,
          rejectedAt: approved ? null : new Date(),
          ...(pressId ? { pressId: String(pressId).trim() } : {}),
        },
        include: { user: { select: { mobileNumber: true } }, card: true },
      });

      let cardFlow: any = null;
      if (approved && generateIdCard !== false) {
        cardFlow = await ensureCardAndNotify(
          profile.id,
          profile.user?.mobileNumber,
          profile.organization,
          profile.pressId,
          { onlyIfPhoto: true },
        );
      }

      const updated = await p.journalistProfile.findUnique({
        where: { id: profileId },
        include: { card: true },
      });
      const download = canDownloadUnionIdCard(updated, updated?.card);

      return res.json({
        message: approved ? 'Membership approved' : 'Membership rejected',
        member: updated,
        documents: buildDocumentsPayload(updated),
        canDownloadIdCard: download.allowed,
        idCard: cardFlow,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed' });
    }
  },
);

router.patch(
  '/admin/members/:profileId/documents',
  jwtAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const { profileId } = req.params;
      const body = req.body as Record<string, string>;
      const allowed: DocKey[] = ['photo', 'aadhaar', 'pan', 'workingIdCard'];

      for (const key of allowed) {
        const action = body[key];
        if (!action) continue;
        if (!['approve', 'reject'].includes(action)) {
          return res.status(400).json({ error: `${key} must be approve or reject` });
        }
        await setDocumentApproval(profileId, key, action as 'approve' | 'reject');
      }

      const profile = await p.journalistProfile.findUnique({
        where: { id: profileId },
        include: { card: true },
      });
      const download = canDownloadUnionIdCard(profile, profile?.card);

      return res.json({
        message: 'Documents updated',
        member: profile,
        documents: buildDocumentsPayload(profile),
        canDownloadIdCard: download.allowed,
      });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Failed' });
    }
  },
);

router.post(
  '/members/upload-document',
  requireUnionMemberJwt,
  uploadDocs.single('file'),
  async (req: Request, res: Response) => {
    try {
      const profile = (res.locals as any).journalistProfile;
      const doc = cleanText(req.body.document)?.toLowerCase() as DocKey;
      const map: Record<string, DocKey> = {
        photo: 'photo',
        aadhaar: 'aadhaar',
        pan: 'pan',
        workingidcard: 'workingIdCard',
        working_id_card: 'workingIdCard',
      };
      const key = map[doc || ''];
      if (!key || !req.file) {
        return res.status(400).json({
          error: 'file and document required (photo|aadhaar|pan|workingIdCard)',
        });
      }
      const updated = await applyDocumentUpload(profile.id, key, req.file, { autoApprove: false });
      return res.json({
        message: 'Uploaded — pending admin approval',
        documents: buildDocumentsPayload(updated),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Upload failed' });
    }
  },
);

export default router;
