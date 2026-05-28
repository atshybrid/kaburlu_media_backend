/**
 * Super Admin — simple survey CRUD + assign to union members.
 *
 * Paths (both work):
 *   /api/v1/journalist/admin/surveys/...
 *   /api/v1/journalist/president/union-member-surveys/...
 */
import { Router, Request, Response } from 'express';
import passport from 'passport';
import { requireSuperAdmin } from '../middlewares/authz';
import { getCampaignQuestionStats } from '../../lib/unionMemberSurvey';
import {
  approveSurveySubmission,
  assignSurveyToMembers,
  closeSurvey,
  createSurvey,
  createSurveySimple,
  deleteSurvey,
  getMemberSurveyDetail,
  getSurveyAreaReport,
  getSurveyById,
  listSurveyMemberProgress,
  listSurveys,
  publishSurvey,
  rejectSurveySubmission,
  updateSurvey,
} from '../../lib/unionMemberSurveyAdmin';
import prisma from '../../lib/prisma';

const p: any = prisma;
const router = Router();
const jwtAuth = passport.authenticate('jwt', { session: false });

function handleError(res: Response, e: any) {
  const msg = e?.message || 'Request failed';
  if (msg.includes('not found') || msg.includes('Not found')) {
    return res.status(404).json({ success: false, error: msg });
  }
  if (msg.includes('required') || msg.includes('Invalid') || msg.includes('Provide')) {
    return res.status(400).json({ success: false, error: msg });
  }
  console.error('[survey/admin]', e);
  return res.status(500).json({ success: false, error: msg });
}

/**
 * @swagger
 * /journalist/admin/surveys:
 *   get:
 *     summary: List surveys (Super Admin)
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: unionName
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Survey list with assignment/completion counts
 *   post:
 *     summary: Create survey — simple form (recommended)
 *     description: |
 *       **Simple body** (use `surveyName`, not `displayName`):
 *       - surveyType: `GENERAL` or `PARTY`
 *       - surveyName (required), unionName optional (auto default union)
 *       - **Only ONE question** per survey
 *       - Flat: questionType, question, answers OR questions: [ single item ]
 *       - optional frameImageUrl, primaryColor, secondaryColor
 *       - questionType: `choice` | `yes_no` | `text` | `video`
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             surveyType: GENERAL
 *             surveyName: 2026 Election Prediction
 *             state: Telangana
 *             primaryColor: "#FF9933"
 *             secondaryColor: "#FFFFFF"
 *             frameImageUrl: https://cdn.example.com/frame.png
 *             questionType: choice
 *             question: "2026 lo ee party gelustundi?"
 *             answers:
 *               - { id: BJP, label: BJP, color: "#FF9933" }
 *               - { id: CONGRESS, label: Congress }
 *               - { id: BRS, label: BRS }
 *     responses:
 *       201:
 *         description: Survey created
 */
router.get('/', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const isActive =
      q.isActive === 'true' ? true : q.isActive === 'false' ? false : null;
    const items = await listSurveys({
      unionName: q.unionName,
      state: q.state,
      isActive,
    });
    return res.json({ success: true, total: items.length, items });
  } catch (e: any) {
    return handleError(res, e);
  }
});

router.post('/', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const isSimple = !!(body.surveyName || body.question || body.questionType);
    const result = isSimple ? await createSurveySimple(body) : await createSurvey(body);
    return res.status(201).json({ success: true, ...result });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}:
 *   get:
 *     summary: Get survey detail + completion stats
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     summary: Update survey (replace questions if questions[] sent)
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     summary: Deactivate survey (soft delete)
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:surveyId', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await getSurveyById(req.params.surveyId);
    if (!data) return res.status(404).json({ success: false, error: 'Survey not found' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return handleError(res, e);
  }
});

router.put('/:surveyId', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await updateSurvey(req.params.surveyId, req.body);
    if (!data) return res.status(404).json({ success: false, error: 'Survey not found' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return handleError(res, e);
  }
});

router.delete('/:surveyId', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await deleteSurvey(req.params.surveyId);
    if (!data) return res.status(404).json({ success: false, error: 'Survey not found' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}/assign:
 *   post:
 *     summary: Assign survey to members (creates per-member task)
 *     description: |
 *       Each assigned member gets a progress row (NOT_STARTED).
 *       Members only see surveys assigned to them.
 *       Use `allMembers:true` to assign every approved member in the union (and state if set).
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           examples:
 *             allMembers:
 *               value: { allMembers: true, approvedOnly: true }
 *             specific:
 *               value: { profileIds: ["clprof_abc", "clprof_xyz"] }
 *     responses:
 *       200:
 *         description: Assignment result
 */
router.post('/:surveyId/assign', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { profileIds, allMembers, approvedOnly, districts, mandals } = req.body || {};
    const result = await assignSurveyToMembers(req.params.surveyId, {
      profileIds: Array.isArray(profileIds) ? profileIds : undefined,
      allMembers: !!allMembers,
      approvedOnly: approvedOnly !== false,
      districts: Array.isArray(districts) ? districts : undefined,
      mandals: Array.isArray(mandals) ? mandals : undefined,
    });
    return res.json({ success: true, ...result });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}/publish:
 *   post:
 *     summary: Publish survey (DRAFT → ACTIVE)
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:surveyId/publish', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await publishSurvey(req.params.surveyId);
    if (!data) return res.status(404).json({ success: false, error: 'Survey not found' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}/close:
 *   post:
 *     summary: Close survey (no new answers)
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:surveyId/close', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await closeSurvey(req.params.surveyId);
    if (!data) return res.status(404).json({ success: false, error: 'Survey not found' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}/members:
 *   get:
 *     summary: List members assigned to this survey + completion status
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NOT_STARTED, IN_PROGRESS, COMPLETED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 */
router.get('/:surveyId/members', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const data = await listSurveyMemberProgress(req.params.surveyId, {
      status: q.status,
      reviewStatus: q.reviewStatus,
      district: q.district,
      page: parseInt(q.page ?? '1', 10),
      limit: parseInt(q.limit ?? '20', 10),
    });
    const survey = await getSurveyById(req.params.surveyId);
    if (!survey) return res.status(404).json({ success: false, error: 'Survey not found' });
    return res.json({
      success: true,
      survey: {
        id: survey.id,
        displayName: survey.displayName,
        completion: (survey as { completion?: unknown }).completion,
      },
      ...data,
    });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}/stats:
 *   get:
 *     summary: YES/NO question stats for a survey
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 */
/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}/report/area:
 *   get:
 *     summary: Area-wise survey report (state / district / mandal + choice breakdown)
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 */
router.get('/:surveyId/report/area', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const data = await getSurveyAreaReport(req.params.surveyId, { state: q.state, district: q.district });
    if (!data) return res.status(404).json({ success: false, error: 'Survey not found' });
    return res.json({ success: true, ...data });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}/submissions/{progressId}:
 *   get:
 *     summary: Member submission detail (answers + videos)
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:surveyId/submissions/:progressId',
  jwtAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const data = await getMemberSurveyDetail(req.params.surveyId, req.params.progressId);
      if (!data) return res.status(404).json({ success: false, error: 'Submission not found' });
      return res.json({ success: true, data });
    } catch (e: any) {
      return handleError(res, e);
    }
  },
);

/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}/submissions/{progressId}/approve:
 *   post:
 *     summary: Approve member survey (unlocks insurance if configured)
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:surveyId/submissions/:progressId/approve',
  jwtAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const result = await approveSurveySubmission(
        req.params.progressId,
        user.id,
        req.body?.note,
      );
      return res.json({ success: true, ...result });
    } catch (e: any) {
      return handleError(res, e);
    }
  },
);

/**
 * @swagger
 * /journalist/admin/surveys/{surveyId}/submissions/{progressId}/reject:
 *   post:
 *     summary: Reject submission (member can re-submit)
 *     tags: [Journalist Union — Super Admin]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:surveyId/submissions/:progressId/reject',
  jwtAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const result = await rejectSurveySubmission(
        req.params.progressId,
        user.id,
        req.body?.note || req.body?.reviewNote,
      );
      return res.json({ success: true, ...result });
    } catch (e: any) {
      return handleError(res, e);
    }
  },
);

router.get('/:surveyId/stats', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { surveyId } = req.params;
    const survey = await p.unionMemberSurveyCampaign.findUnique({
      where: { id: surveyId },
      select: { id: true, displayName: true, partyCode: true },
    });
    if (!survey) return res.status(404).json({ success: false, error: 'Survey not found' });
    const questions = await getCampaignQuestionStats(surveyId);
    const completed = await p.unionMemberSurveyProgress.count({
      where: { campaignId: surveyId, status: 'COMPLETED' },
    });
    const assigned = await p.unionMemberSurveyProgress.count({ where: { campaignId: surveyId } });
    return res.json({
      success: true,
      campaignId: survey.id,
      displayName: survey.displayName,
      partyCode: survey.partyCode,
      assigned,
      completedSubmissions: completed,
      pending: Math.max(0, assigned - completed),
      questions,
    });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/** @deprecated Use GET /journalist/admin/surveys */
router.get('/campaigns', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const isActive =
      q.isActive === 'true' ? true : q.isActive === 'false' ? false : null;
    const items = await listSurveys({ unionName: q.unionName, state: q.state, isActive });
    return res.json({ success: true, total: items.length, items });
  } catch (e: any) {
    return handleError(res, e);
  }
});

/** @deprecated Use POST /journalist/admin/surveys */
router.post('/campaigns', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await createSurvey(req.body);
    return res.status(201).json({ success: true, ...result });
  } catch (e: any) {
    return handleError(res, e);
  }
});

router.get('/campaigns/:surveyId/stats', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  req.params.surveyId = req.params.surveyId;
  const { surveyId } = req.params;
  try {
    const survey = await p.unionMemberSurveyCampaign.findUnique({
      where: { id: surveyId },
      select: { id: true, displayName: true, partyCode: true },
    });
    if (!survey) return res.status(404).json({ success: false, error: 'Survey not found' });
    const questions = await getCampaignQuestionStats(surveyId);
    const completed = await p.unionMemberSurveyProgress.count({
      where: { campaignId: surveyId, status: 'COMPLETED' },
    });
    const assigned = await p.unionMemberSurveyProgress.count({ where: { campaignId: surveyId } });
    return res.json({
      success: true,
      campaignId: survey.id,
      displayName: survey.displayName,
      partyCode: survey.partyCode,
      assigned,
      completedSubmissions: completed,
      pending: Math.max(0, assigned - completed),
      questions,
    });
  } catch (e: any) {
    return handleError(res, e);
  }
});

export default router;
