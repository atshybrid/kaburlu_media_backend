/**
 * Super Admin — all union members list, survey status, insurance assign/unlock.
 */
import { Router, Request, Response } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperAdmin } from '../middlewares/authz';
import { cleanText } from '../../lib/journalistUnionMember';
import {
  buildInsuranceUiStatus,
  ensureBenefitStatus,
  formatMemberOverview,
  loadActiveCampaignsForUnion,
  matchesInsuranceFilter,
  matchesSurveyFilter,
  memberListInclude,
} from '../../lib/journalistUnionMemberOverview';

const p: any = prisma;
const router = Router();
const jwtAuth = passport.authenticate('jwt', { session: false });

function currentUser(req: Request) {
  return (req as any).user as { id: string; role: { name: string } };
}

/**
 * @swagger
 * /journalist/admin/members:
 *   get:
 *     summary: List all journalist union members (Super Admin)
 *     description: |
 *       Returns every union member with:
 *       - **membership** — PENDING / APPROVED
 *       - **documents** — per-doc approval (photo, aadhaar, pan, working ID)
 *       - **survey** — per-party campaign status (NOT_STARTED, IN_PROGRESS, COMPLETED) + overall
 *       - **insurance** — accidental & health UI status + active policy if assigned
 *
 *       **Insurance status values:** `LOCKED_SURVEY_REQUIRED` | `UNLOCKED_CAN_APPLY` | `ACTIVE` | `LOCKED_REQUIRES_ACCIDENTAL` (health only)
 *
 *       **Survey overall:** `NOT_STARTED` | `IN_PROGRESS` | `PARTIALLY_COMPLETE` | `ALL_COMPLETED` | `NO_CAMPAIGNS`
 *     tags: [Journalist Union — Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search name, mobile, press ID, newspaper
 *       - in: query
 *         name: unionName
 *         schema: { type: string }
 *       - in: query
 *         name: memberType
 *         schema: { type: string, enum: [TENANT_REPORTER, NON_TENANT_REPORTER] }
 *       - in: query
 *         name: membershipStatus
 *         schema: { type: string, enum: [ALL, PENDING, APPROVED], default: ALL }
 *       - in: query
 *         name: surveyStatus
 *         schema: { type: string, enum: [ALL, PENDING, NOT_STARTED, IN_PROGRESS, COMPLETED] }
 *         description: PENDING = not all surveys completed
 *       - in: query
 *         name: insuranceAccidental
 *         schema:
 *           type: string
 *           enum: [ALL, LOCKED_SURVEY_REQUIRED, UNLOCKED_CAN_APPLY, ACTIVE]
 *       - in: query
 *         name: insuranceHealth
 *         schema:
 *           type: string
 *           enum: [ALL, LOCKED_REQUIRES_ACCIDENTAL, LOCKED_SURVEY_REQUIRED, UNLOCKED_CAN_APPLY, ACTIVE]
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated member list with survey + insurance
 *       403:
 *         description: Super Admin only
 */
router.get('/admin/members', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10)));
    const unionName = cleanText(q.unionName);
    const memberType = cleanText(q.memberType)?.toUpperCase();
    const membershipStatus = cleanText(q.membershipStatus) || 'ALL';
    const surveyStatusFilter = cleanText(q.surveyStatus) || 'ALL';
    const insuranceAccidentalFilter = cleanText(q.insuranceAccidental) || 'ALL';
    const insuranceHealthFilter = cleanText(q.insuranceHealth) || 'ALL';
    const stateFilter = cleanText(q.state);
    const searchQ = cleanText(q.q);

    const where: any = {};
    if (unionName) where.unionName = { contains: unionName, mode: 'insensitive' };
    if (memberType && ['TENANT_REPORTER', 'NON_TENANT_REPORTER'].includes(memberType)) {
      where.memberType = memberType;
    }
    if (membershipStatus === 'PENDING') where.approved = false;
    if (membershipStatus === 'APPROVED') where.approved = true;
    if (stateFilter) where.state = { equals: stateFilter, mode: 'insensitive' };
    if (searchQ) {
      where.OR = [
        { pressId: { contains: searchQ, mode: 'insensitive' } },
        { organization: { contains: searchQ, mode: 'insensitive' } },
        { currentNewspaper: { contains: searchQ, mode: 'insensitive' } },
        { linkedTenantName: { contains: searchQ, mode: 'insensitive' } },
        { user: { mobileNumber: { contains: searchQ } } },
        { user: { profile: { fullName: { contains: searchQ, mode: 'insensitive' } } } },
      ];
    }

    const needsPostFilter =
      surveyStatusFilter !== 'ALL' ||
      insuranceAccidentalFilter !== 'ALL' ||
      insuranceHealthFilter !== 'ALL';

    const fetchTake = needsPostFilter ? Math.min(500, limit * 10) : limit;
    const fetchSkip = needsPostFilter ? 0 : (page - 1) * limit;

    const [dbTotal, rows] = await Promise.all([
      p.journalistProfile.count({ where }),
      p.journalistProfile.findMany({
        where,
        skip: fetchSkip,
        take: fetchTake,
        orderBy: { createdAt: 'desc' },
        include: memberListInclude,
      }),
    ]);

    const unionNames = [...new Set(rows.map((r: any) => r.unionName).filter(Boolean))] as string[];
    const campaignsByUnion = new Map<string, any[]>();
    for (const un of unionNames) {
      campaignsByUnion.set(un, await loadActiveCampaignsForUnion(un, stateFilter));
    }

    let items = rows.map((profile: any) => {
      const campaigns = campaignsByUnion.get(profile.unionName) || [];
      return formatMemberOverview(profile, campaigns, profile.surveyProgress || []);
    });

    if (needsPostFilter) {
      items = items.filter((item: any) => {
        if (!matchesSurveyFilter(item.survey.overallStatus, surveyStatusFilter)) return false;
        if (!matchesInsuranceFilter(item.insurance.accidental.status, insuranceAccidentalFilter)) return false;
        if (!matchesInsuranceFilter(item.insurance.health.status, insuranceHealthFilter)) return false;
        return true;
      });
    }

    const total = needsPostFilter ? items.length : dbTotal;
    const paged = needsPostFilter ? items.slice((page - 1) * limit, page * limit) : items;

    return res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
      filters: {
        membershipStatus,
        surveyStatus: surveyStatusFilter,
        insuranceAccidental: insuranceAccidentalFilter,
        insuranceHealth: insuranceHealthFilter,
      },
      items: paged,
    });
  } catch (e: any) {
    console.error('[unionMemberAdmin/list]', e);
    return res.status(500).json({ success: false, code: 'LIST_FAILED', error: e?.message || 'Failed' });
  }
});

/**
 * @swagger
 * /journalist/admin/members/{profileId}:
 *   get:
 *     summary: Get one member — full survey + insurance detail (Super Admin)
 *     tags: [Journalist Union — Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member detail
 *       404:
 *         description: Not found
 */
router.get('/admin/members/:profileId', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const profile = await p.journalistProfile.findUnique({
      where: { id: req.params.profileId },
      include: {
        ...memberListInclude,
        insurances: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!profile) {
      return res.status(404).json({ success: false, code: 'MEMBER_NOT_FOUND', error: 'Member not found' });
    }
    const campaigns = await loadActiveCampaignsForUnion(profile.unionName, profile.state);
    const data = formatMemberOverview(profile, campaigns, profile.surveyProgress || []);
    return res.json({
      success: true,
      data: {
        ...data,
        allInsurances: (profile.insurances || []).map((ins: any) => ({
          id: ins.id,
          type: ins.type,
          policyNumber: ins.policyNumber,
          insurer: ins.insurer,
          coverAmount: ins.coverAmount,
          premium: ins.premium,
          validFrom: ins.validFrom,
          validTo: ins.validTo,
          isActive: ins.isActive,
          notes: ins.notes,
        })),
      },
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, code: 'DETAIL_FAILED', error: e?.message || 'Failed' });
  }
});

/**
 * @swagger
 * /journalist/admin/members/{profileId}/benefits:
 *   patch:
 *     summary: Unlock or activate insurance eligibility (Super Admin)
 *     description: |
 *       Manually unlock accidental/health insurance (e.g. skip survey) or mark insurance as **active** after policy issued.
 *
 *       **Common actions:**
 *       - Unlock accidental after survey: `accidentalUnlocked: true`
 *       - Mark accidental active: `accidentalInsuranceActive: true` (also sets unlocked if missing)
 *       - Unlock health: `healthUnlocked: true` (requires accidental active unless `forceHealthUnlock: true`)
 *       - Mark health active: `healthInsuranceActive: true`
 *     tags: [Journalist Union — Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           examples:
 *             unlockAccidental:
 *               summary: Unlock accidental (can assign policy)
 *               value:
 *                 accidentalUnlocked: true
 *             activateAccidental:
 *               summary: Mark accidental insurance active
 *               value:
 *                 accidentalInsuranceActive: true
 *             unlockAndActivateHealth:
 *               summary: Activate health (accidental must be active or force)
 *               value:
 *                 healthInsuranceActive: true
 *                 forceHealthUnlock: true
 *     responses:
 *       200:
 *         description: Updated benefit status
 */
router.patch('/admin/members/:profileId/benefits', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const profile = await p.journalistProfile.findUnique({ where: { id: req.params.profileId } });
    if (!profile) {
      return res.status(404).json({ success: false, code: 'MEMBER_NOT_FOUND', error: 'Member not found' });
    }

    const body = req.body || {};
    const now = new Date();
    const patch: Record<string, unknown> = { unionName: profile.unionName, updatedAt: now };

    if (body.firstMembershipWaived === true) {
      patch.firstMembershipWaived = true;
      patch.firstMembershipWaivedAt = now;
    }

    if (body.accidentalUnlocked === true) {
      patch.accidentalUnlockedAt = now;
    }
    if (body.healthUnlocked === true) {
      patch.healthUnlockedAt = now;
    }

    if (body.accidentalInsuranceActive === true) {
      patch.accidentalInsuranceActive = true;
      if (!patch.accidentalUnlockedAt) patch.accidentalUnlockedAt = now;
    }
    if (body.accidentalInsuranceActive === false) {
      patch.accidentalInsuranceActive = false;
    }

    if (body.healthInsuranceActive === true) {
      const existing = await p.unionMemberBenefitStatus.findUnique({ where: { profileId: profile.id } });
      const accidentalOk =
        body.forceHealthUnlock === true ||
        existing?.accidentalInsuranceActive ||
        patch.accidentalInsuranceActive === true;
      if (!accidentalOk) {
        return res.status(400).json({
          success: false,
          code: 'ACCIDENTAL_REQUIRED_FIRST',
          error: 'Accidental insurance must be active before health, or set forceHealthUnlock=true',
        });
      }
      patch.healthInsuranceActive = true;
      if (!patch.healthUnlockedAt) patch.healthUnlockedAt = now;
    }
    if (body.healthInsuranceActive === false) {
      patch.healthInsuranceActive = false;
    }

    const benefit = await p.unionMemberBenefitStatus.upsert({
      where: { profileId: profile.id },
      create: {
        profileId: profile.id,
        unionName: profile.unionName,
        firstMembershipWaived: true,
        firstMembershipWaivedAt: now,
        ...(patch as object),
      },
      update: patch,
    });

    const campaigns = await loadActiveCampaignsForUnion(profile.unionName, profile.state);
    const progress = await p.unionMemberSurveyProgress.findMany({ where: { profileId: profile.id } });
    const overview = formatMemberOverview(
      { ...profile, benefitStatus: benefit, surveyProgress: progress, insurances: [], card: null, user: null },
      campaigns,
      progress,
    );

    return res.json({
      success: true,
      code: 'BENEFITS_UPDATED',
      message: 'Member benefits updated',
      benefit,
      insurance: overview.insurance,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, code: 'BENEFITS_UPDATE_FAILED', error: e?.message || 'Failed' });
  }
});

/**
 * @swagger
 * /journalist/admin/members/{profileId}/insurance:
 *   post:
 *     summary: Assign accidental or health insurance policy (Super Admin)
 *     description: |
 *       Creates `JournalistInsurance` record and sets benefit flag active for that type.
 *       Previous active policy of same type is deactivated.
 *     tags: [Journalist Union — Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, policyNumber, insurer, validFrom, validTo]
 *             properties:
 *               type: { type: string, enum: [ACCIDENTAL, HEALTH] }
 *               policyNumber: { type: string, example: "LIC/ACC/2026/00421" }
 *               insurer: { type: string, example: "LIC of India" }
 *               coverAmount: { type: integer, example: 500000 }
 *               premium: { type: integer, example: 1200 }
 *               validFrom: { type: string, format: date, example: "2026-04-01" }
 *               validTo: { type: string, format: date, example: "2027-03-31" }
 *               notes: { type: string }
 *               skipUnlockCheck: { type: boolean, description: "If true, assign even if not unlocked (Super Admin override)" }
 *     responses:
 *       201:
 *         description: Policy assigned
 *       400:
 *         description: Not unlocked or not approved
 *       404:
 *         description: Member not found
 */
router.post('/admin/members/:profileId/insurance', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const { profileId } = req.params;
    const { type, policyNumber, insurer, coverAmount, premium, validFrom, validTo, notes, skipUnlockCheck } =
      req.body || {};

    if (!type || !policyNumber || !insurer || !validFrom || !validTo) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_INSURANCE_FIELDS',
        error: 'type, policyNumber, insurer, validFrom, validTo are required',
      });
    }
    if (!['ACCIDENTAL', 'HEALTH'].includes(type)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_INSURANCE_TYPE',
        error: 'type must be ACCIDENTAL or HEALTH',
      });
    }

    const profile = await p.journalistProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return res.status(404).json({ success: false, code: 'MEMBER_NOT_FOUND', error: 'Member not found' });
    }

    const benefit = await ensureBenefitStatus(profile.id, profile.unionName);
    const accidentalStatus = buildInsuranceUiStatus('ACCIDENTAL', benefit);
    const healthStatus = buildInsuranceUiStatus('HEALTH', benefit);

    if (!skipUnlockCheck) {
      if (type === 'ACCIDENTAL' && accidentalStatus === 'LOCKED_SURVEY_REQUIRED') {
        return res.status(400).json({
          success: false,
          code: 'ACCIDENTAL_NOT_UNLOCKED',
          error: 'Accidental insurance not unlocked. Complete survey or PATCH benefits with accidentalUnlocked=true',
          insurance: { accidental: accidentalStatus, health: healthStatus },
        });
      }
      if (type === 'HEALTH' && healthStatus !== 'UNLOCKED_CAN_APPLY' && healthStatus !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          code: 'HEALTH_NOT_UNLOCKED',
          error: 'Health insurance not unlocked yet',
          insurance: { accidental: accidentalStatus, health: healthStatus },
        });
      }
    }

    await p.journalistInsurance.updateMany({
      where: { profileId, type, isActive: true },
      data: { isActive: false },
    });

    const insurance = await p.journalistInsurance.create({
      data: {
        profileId,
        type,
        policyNumber: String(policyNumber).trim(),
        insurer: String(insurer).trim(),
        coverAmount: coverAmount ? parseInt(String(coverAmount), 10) : null,
        premium: premium ? parseInt(String(premium), 10) : null,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        isActive: true,
        notes: notes ? String(notes).trim() : null,
        assignedById: user.id,
      },
    });

    const benefitPatch: Record<string, unknown> = { updatedAt: new Date() };
    if (type === 'ACCIDENTAL') {
      benefitPatch.accidentalInsuranceActive = true;
      benefitPatch.accidentalUnlockedAt = benefit.accidentalUnlockedAt || new Date();
    } else {
      benefitPatch.healthInsuranceActive = true;
      benefitPatch.healthUnlockedAt = benefit.healthUnlockedAt || new Date();
    }
    const updatedBenefit = await p.unionMemberBenefitStatus.update({
      where: { profileId },
      data: benefitPatch,
    });

    const campaigns = await loadActiveCampaignsForUnion(profile.unionName, profile.state);
    const progress = await p.unionMemberSurveyProgress.findMany({ where: { profileId } });
    const overview = formatMemberOverview(
      {
        ...profile,
        benefitStatus: updatedBenefit,
        insurances: [insurance],
        surveyProgress: progress,
        card: null,
        user: null,
      },
      campaigns,
      progress,
    );

    return res.status(201).json({
      success: true,
      code: 'INSURANCE_ASSIGNED',
      message: `${type} insurance assigned`,
      insurance: insurance,
      memberInsurance: overview.insurance,
    });
  } catch (e: any) {
    console.error('[unionMemberAdmin/insurance POST]', e);
    return res.status(500).json({ success: false, code: 'INSURANCE_ASSIGN_FAILED', error: e?.message || 'Failed' });
  }
});

export default router;
