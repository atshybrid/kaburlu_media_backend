/**
 * Union Members Survey — member-facing APIs (Kaburlu app + WhatsApp deep links).
 * Phase 1: Swagger contract + example responses. DB handlers wire in Phase 2 after migration.
 */
import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import multer from 'multer';
import prisma from '../../lib/prisma';
import { putPublicObject } from '../../lib/objectStorage';
import {
  completeSurveyProgress,
  upsertSurveyAnswers,
  type SurveyAnswerInput,
} from '../../lib/unionMemberSurvey';

const p: any = prisma;
const router = Router();
const jwtAuth = passport.authenticate('jwt', { session: false });

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.mimetype);
    cb(null, ok);
  },
});

function currentUser(req: Request): { id: string } {
  return (req as any).user;
}

async function requireJournalistMember(req: Request, res: Response, next: NextFunction) {
  try {
    const user = currentUser(req);
    const profile = await p.journalistProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        unionName: true,
        approved: true,
        state: true,
        district: true,
        mandal: true,
        memberType: true,
      },
    });
    if (!profile?.id) {
      return res.status(403).json({
        code: 'UNION_MEMBER_REQUIRED',
        message: 'Union member or tenant reporter with journalist profile required',
      });
    }
    (res.locals as any).journalistProfile = profile;
    return next();
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to resolve member profile' });
  }
}

function mapCampaignBranding(c: any) {
  return {
    logoUrl: c.logoUrl,
    frameImageUrl: c.frameImageUrl,
    primaryColor: c.primaryColor,
    secondaryColor: c.secondaryColor,
    frameStyleKey: c.frameStyleKey,
  };
}

function mapQuestionsForMember(questions: any[]) {
  return questions.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    nativeQuestionText: q.nativeQuestionText,
    questionType: q.questionType,
    options: q.options,
    required: q.required,
    sortOrder: q.sortOrder,
    videoMaxSeconds: q.videoMaxSeconds,
  }));
}

/** Example payload for app integration (Phase 1). */
const EXAMPLE_ELIGIBILITY = {
  profileId: 'cmprof_example',
  unionName: 'Democratic Journalist Federation (Working)',
  membership: {
    firstMembershipFree: true,
    feeWaived: true,
    feeWaivedReason: 'FIRST_MEMBERSHIP_FREE',
  },
  insurance: {
    accidental: {
      status: 'LOCKED_SURVEY_REQUIRED',
      label: 'Accidental Insurance',
      coverAmountInr: 500000,
      unlockHint: 'Complete your party survey (e.g. Ex-BJP) to unlock',
    },
    health: {
      status: 'LOCKED_REQUIRES_ACCIDENTAL',
      label: 'Health Insurance',
      coverAmountInr: 300000,
      unlockHint: 'Activate Accidental insurance first',
    },
  },
  nextActions: [
    { type: 'START_SURVEY', campaignId: 'camp_bjp_ts', title: 'Ex-BJP Members — Telangana' },
  ],
};

const EXAMPLE_CATALOG = {
  state: 'Telangana',
  unionName: 'Democratic Journalist Federation (Working)',
  campaigns: [
    {
      id: 'camp_bjp_ts',
      partyCode: 'BJP',
      displayName: 'Ex-BJP Members',
      description: 'Former BJP members — complete survey + short video to unlock accidental cover',
      branding: { logoUrl: 'https://cdn.example.com/bjp-logo.png', primaryColor: '#FF9933', secondaryColor: '#138808', frameStyleKey: 'FRAME_BJP_V1' },
      requiredForInsuranceType: 'ACCIDENTAL',
      progress: { status: 'NOT_STARTED', completedQuestions: 0, totalQuestions: 5 },
    },
    {
      id: 'camp_congress_ts',
      partyCode: 'CONGRESS',
      displayName: 'Ex-Congress Members',
      branding: { logoUrl: 'https://cdn.example.com/inc-logo.png', primaryColor: '#00AEEF', secondaryColor: '#FFFFFF', frameStyleKey: 'FRAME_CONGRESS_V1' },
      requiredForInsuranceType: 'ACCIDENTAL',
      progress: { status: 'NOT_STARTED', completedQuestions: 0, totalQuestions: 4 },
    },
    {
      id: 'camp_brs_ts',
      partyCode: 'BRS',
      displayName: 'Ex-BRS / TRS Members',
      branding: { logoUrl: 'https://cdn.example.com/brs-logo.png', primaryColor: '#E91E63', secondaryColor: '#FFFFFF', frameStyleKey: 'FRAME_BRS_V1' },
      requiredForInsuranceType: 'ACCIDENTAL',
      progress: { status: 'NOT_STARTED', completedQuestions: 0, totalQuestions: 4 },
    },
  ],
};

const EXAMPLE_SURVEY_DETAIL = {
  id: 'camp_bjp_ts',
  partyCode: 'BJP',
  displayName: 'Ex-BJP Members',
  branding: {
    logoUrl: 'https://cdn.example.com/bjp-logo.png',
    primaryColor: '#FF9933',
    secondaryColor: '#138808',
    frameStyleKey: 'FRAME_BJP_V1',
  },
  questions: [
    {
      id: 'q1',
      questionType: 'SINGLE_CHOICE',
      questionText: 'How long were you associated with BJP?',
      required: true,
      options: [
        { id: 'lt1', label: 'Less than 1 year' },
        { id: '1_3', label: '1–3 years' },
        { id: '3plus', label: '3+ years' },
      ],
    },
    {
      id: 'q2',
      questionType: 'TEXT',
      questionText: 'Why did you leave the party?',
      required: true,
    },
    {
      id: 'q3',
      questionType: 'VIDEO_UPLOAD',
      questionText: 'Record a 30-second video: introduce yourself as a journalist',
      required: true,
      videoMaxSeconds: 30,
    },
  ],
};

/**
 * @swagger
 * tags:
 *   - name: Journalist Union — Survey (Member)
 *     description: |
 *       Party-based member surveys (BJP, Congress, BRS, TRS) for Telangana union members.
 *       Members complete surveys + optional video upload to unlock insurance benefits.
 *       First union membership is free; Accidental insurance unlocks after survey; Health after Accidental is active.
 */

/**
 * @swagger
 * /journalist/union-member-surveys/benefits/eligibility:
 *   get:
 *     summary: Get membership & insurance unlock status for logged-in member
 *     description: |
 *       Returns whether first membership fee is waived and which insurance types are locked/unlocked/active.
 *       App home screen uses this to show task cards (survey → accidental → health).
 *     tags: [Journalist Union — Survey (Member)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Benefit eligibility
 *         content:
 *           application/json:
 *             example:
 *               profileId: cmprof_example
 *               unionName: Democratic Journalist Federation (Working)
 *               membership:
 *                 firstMembershipFree: true
 *                 feeWaived: true
 *               insurance:
 *                 accidental:
 *                   status: LOCKED_SURVEY_REQUIRED
 *                 health:
 *                   status: LOCKED_REQUIRES_ACCIDENTAL
 *               nextActions:
 *                 - type: START_SURVEY
 *                   campaignId: camp_bjp_ts
 *                   title: Ex-BJP Members — Telangana
 *       403:
 *         description: Not a union member
 */
router.get('/benefits/eligibility', jwtAuth, requireJournalistMember, async (_req, res) => {
  try {
    const profile = (res.locals as any).journalistProfile;
    const row = await p.unionMemberBenefitStatus?.findUnique?.({ where: { profileId: profile.id } }).catch(() => null);
    if (row) {
      return res.json({
        profileId: profile.id,
        unionName: row.unionName,
        membership: { firstMembershipFree: row.firstMembershipWaived, feeWaived: row.firstMembershipWaived },
        insurance: {
          accidental: {
            status: row.accidentalInsuranceActive
              ? 'ACTIVE'
              : row.accidentalUnlockedAt
                ? 'UNLOCKED_CAN_APPLY'
                : 'LOCKED_SURVEY_REQUIRED',
          },
          health: {
            status: row.healthInsuranceActive
              ? 'ACTIVE'
              : row.healthUnlockedAt
                ? 'UNLOCKED_CAN_APPLY'
                : row.accidentalInsuranceActive
                  ? 'LOCKED_SURVEY_REQUIRED'
                  : 'LOCKED_REQUIRES_ACCIDENTAL',
          },
        },
      });
    }
    return res.json(EXAMPLE_ELIGIBILITY);
  } catch {
    return res.json(EXAMPLE_ELIGIBILITY);
  }
});

/**
 * @swagger
 * /journalist/union-member-surveys/campaigns:
 *   get:
 *     summary: List party survey campaigns for member (Telangana BJP, Congress, BRS, TRS, …)
 *     description: |
 *       Filtered by member union + state. Includes branding for in-app frames (logo, colors, frameStyleKey).
 *     tags: [Journalist Union — Survey (Member)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string, example: Telangana }
 *     responses:
 *       200:
 *         description: Campaign catalog with per-member progress
 *         content:
 *           application/json:
 *             example:
 *               state: Telangana
 *               campaigns:
 *                 - id: camp_bjp_ts
 *                   partyCode: BJP
 *                   displayName: Ex-BJP Members
 *                   branding:
 *                     primaryColor: "#FF9933"
 *                     frameStyleKey: FRAME_BJP_V1
 *                   progress:
 *                     status: NOT_STARTED
 */
router.get('/campaigns', jwtAuth, requireJournalistMember, async (req, res) => {
  const profile = (res.locals as any).journalistProfile;
  const state = String((req.query as any).state || profile.state || 'Telangana').trim();
  try {
    const progressRows = await p.unionMemberSurveyProgress.findMany({
      where: {
        profileId: profile.id,
        campaign: { isActive: true, campaignStatus: 'ACTIVE' },
      },
      include: {
        campaign: {
          include: { questions: { select: { id: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const assigned = progressRows.filter((pr: any) => pr.campaign);
    if (assigned.length) {
      const answerCounts = await p.unionMemberSurveyAnswer.groupBy({
        by: ['progressId'],
        where: { progressId: { in: assigned.map((pr: any) => pr.id) } },
        _count: { _all: true },
      });
      const answerCountMap = new Map(answerCounts.map((a: any) => [a.progressId, a._count._all]));

      return res.json({
        success: true,
        state,
        unionName: profile.unionName,
        campaigns: assigned.map((pr: any) => {
          const c = pr.campaign;
          const totalQuestions = c.questions?.length || 0;
          const completedQuestions = answerCountMap.get(pr.id) ?? 0;
          return {
            id: c.id,
            surveyType: c.surveyType,
            partyCode: c.partyCode,
            politicalPartyId: c.politicalPartyId,
            displayName: c.displayName,
            description: c.description,
            branding: mapCampaignBranding(c),
            requiredForInsuranceType: c.requiredForInsuranceType,
            progress: {
              progressId: pr.id,
              status: pr.status,
              startedAt: pr.startedAt,
              completedAt: pr.completedAt,
              completedQuestions,
              totalQuestions,
            },
          };
        }),
      });
    }

    return res.json({
      success: true,
      state,
      unionName: profile.unionName,
      campaigns: [],
      message: 'No surveys assigned yet. Contact union admin.',
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to load surveys' });
  }
});

/**
 * @swagger
 * /journalist/union-member-surveys/campaigns/{campaignId}:
 *   get:
 *     summary: Get survey detail (questions + branding) for in-app UI
 *     tags: [Journalist Union — Survey (Member)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Survey with ordered questions
 *         content:
 *           application/json:
 *             example:
 *               id: camp_bjp_ts
 *               partyCode: BJP
 *               questions:
 *                 - id: q1
 *                   questionType: SINGLE_CHOICE
 *                   questionText: How long were you associated with BJP?
 */
router.get('/campaigns/:campaignId', jwtAuth, requireJournalistMember, async (req, res) => {
  const { campaignId } = req.params;
  const profile = (res.locals as any).journalistProfile;
  try {
    const assignment = await p.unionMemberSurveyProgress.findUnique({
      where: { campaignId_profileId: { campaignId, profileId: profile.id } },
    });
    if (!assignment) {
      return res.status(403).json({
        success: false,
        code: 'SURVEY_NOT_ASSIGNED',
        error: 'This survey is not assigned to you',
      });
    }

    const c = await p.unionMemberSurveyCampaign.findFirst({
      where: {
        id: campaignId,
        isActive: true,
        campaignStatus: 'ACTIVE',
        unionName: profile.unionName,
      },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!c) return res.status(404).json({ success: false, error: 'Survey not found' });

    const existingAnswers = await p.unionMemberSurveyAnswer.findMany({
      where: { progressId: assignment.id },
      select: { id: true, questionId: true, answerText: true, answerJson: true, videoUrl: true },
    });

    return res.json({
      success: true,
      id: c.id,
      surveyType: c.surveyType,
      partyCode: c.partyCode,
      politicalPartyId: c.politicalPartyId,
      displayName: c.displayName,
      description: c.description,
      branding: mapCampaignBranding(c),
      requiredForInsuranceType: c.requiredForInsuranceType,
      progress: {
        progressId: assignment.id,
        status: assignment.status,
        reviewStatus: assignment.reviewStatus,
        reviewNote: assignment.reviewNote,
        startedAt: assignment.startedAt,
        completedAt: assignment.completedAt,
      },
      myAnswers: existingAnswers.map((a: any) => ({
        answerId: a.id,
        questionId: a.questionId,
        answerText: a.answerText,
        answerJson: a.answerJson,
        videoUrl: a.videoUrl,
      })),
      questions: mapQuestionsForMember(c.questions),
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to load survey' });
  }
});

/**
 * @swagger
 * /journalist/union-member-surveys/campaigns/{campaignId}/start:
 *   post:
 *     summary: Start or resume a survey attempt
 *     tags: [Journalist Union — Survey (Member)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Progress row created/returned
 *         content:
 *           application/json:
 *             example:
 *               progressId: prog_abc
 *               status: IN_PROGRESS
 *               startedAt: "2026-05-17T10:00:00.000Z"
 */
router.post('/campaigns/:campaignId/start', jwtAuth, requireJournalistMember, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const profile = (res.locals as any).journalistProfile;
    const campaign = await p.unionMemberSurveyCampaign.findFirst({
      where: {
        id: campaignId,
        isActive: true,
        campaignStatus: 'ACTIVE',
        unionName: profile.unionName,
      },
    });
    if (!campaign) return res.status(404).json({ success: false, error: 'Survey not found' });

    let progress = await p.unionMemberSurveyProgress.findUnique({
      where: { campaignId_profileId: { campaignId, profileId: profile.id } },
    });
    if (!progress) {
      return res.status(403).json({
        success: false,
        code: 'SURVEY_NOT_ASSIGNED',
        error: 'Survey not assigned to you',
      });
    }
    if (progress.reviewStatus === 'REJECTED') {
      await p.unionMemberSurveyProgress.update({
        where: { id: progress.id },
        data: { reviewStatus: null, reviewNote: null },
      });
    }
    if (progress.status === 'NOT_STARTED' || !progress.startedAt) {
      progress = await p.unionMemberSurveyProgress.update({
        where: { id: progress.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });
    }
    return res.json({
      success: true,
      progressId: progress.id,
      status: progress.status,
      startedAt: progress.startedAt,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to start survey' });
  }
});

/**
 * @swagger
 * /journalist/union-member-surveys/campaigns/{campaignId}/answers:
 *   post:
 *     summary: Submit one or more question answers (batch)
 *     description: |
 *       For YES_NO use answerJson `{ "value": "YES" }` or `{ "value": "NO" }` — updates yesCount/noCount on the question.
 *       For SINGLE_CHOICE / MULTI_CHOICE use answerJson. For TEXT use answerText.
 *       VIDEO_UPLOAD questions should use the dedicated video endpoint first, then reference videoUrl here.
 *     tags: [Journalist Union — Survey (Member)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             answers:
 *               - questionId: q_yesno_1
 *                 answerJson: { value: "YES" }
 *               - questionId: q_text_1
 *                 answerText: "Personal reasons"
 *     responses:
 *       200:
 *         description: Answers saved
 *         content:
 *           application/json:
 *             example:
 *               saved: 2
 *               yesNoStats:
 *                 - questionId: q_yesno_1
 *                   yesCount: 42
 *                   noCount: 8
 */
router.post('/campaigns/:campaignId/answers', jwtAuth, requireJournalistMember, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const profile = (res.locals as any).journalistProfile;
    const body = req.body as { answers?: SurveyAnswerInput[] };
    const answers = Array.isArray(body?.answers) ? body.answers : [];
    if (!answers.length) return res.status(400).json({ error: 'answers array is required' });

    const campaign = await p.unionMemberSurveyCampaign.findFirst({
      where: { id: campaignId, isActive: true, unionName: profile.unionName },
    });
    if (!campaign) return res.status(404).json({ success: false, error: 'Survey not found' });

    const progress = await p.unionMemberSurveyProgress.findUnique({
      where: { campaignId_profileId: { campaignId, profileId: profile.id } },
    });
    if (!progress) {
      return res.status(403).json({ success: false, code: 'SURVEY_NOT_ASSIGNED', error: 'Survey not assigned' });
    }
    if (progress.status === 'NOT_STARTED') {
      await p.unionMemberSurveyProgress.update({
        where: { id: progress.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });
    }

    const result = await upsertSurveyAnswers(progress.id, campaignId, answers);
    return res.json({
      success: true,
      surveyId: campaignId,
      progressId: progress.id,
      saved: result.saved,
      answers: result.answers,
      yesNoStats: result.yesNoUpdates,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to save answers' });
  }
});

/**
 * @swagger
 * /journalist/union-member-surveys/campaigns/{campaignId}/video:
 *   post:
 *     summary: Upload survey video (multipart)
 *     tags: [Journalist Union — Survey (Member)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: questionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Video stored; returns public URL
 *         content:
 *           application/json:
 *             example:
 *               videoUrl: https://cdn.example.com/union-surveys/member/video.mp4
 *               questionId: q3
 */
router.post(
  '/campaigns/:campaignId/video',
  jwtAuth,
  requireJournalistMember,
  uploadVideo.single('video'),
  async (req, res) => {
    try {
      const { campaignId } = req.params;
      const questionId = String((req.query as any).questionId || '').trim();
      if (!questionId) return res.status(400).json({ error: 'questionId query param is required' });
      if (!req.file?.buffer) return res.status(400).json({ error: 'video file is required' });

      const profile = (res.locals as any).journalistProfile;
      const campaign = await p.unionMemberSurveyCampaign.findFirst({
        where: { id: campaignId, isActive: true, unionName: profile.unionName },
      });
      if (!campaign) return res.status(404).json({ success: false, error: 'Survey not found' });

      const progress = await p.unionMemberSurveyProgress.findUnique({
        where: { campaignId_profileId: { campaignId, profileId: profile.id } },
      });
      if (!progress) {
        return res.status(403).json({ success: false, code: 'SURVEY_NOT_ASSIGNED', error: 'Survey not assigned' });
      }

      const ext = req.file.mimetype.includes('quicktime') ? 'mov' : req.file.mimetype.split('/')[1] || 'mp4';
      const key = `union-surveys/${campaignId}/${profile.id}/${questionId}-${Date.now()}.${ext}`;
      const uploaded = await putPublicObject({
        key,
        body: req.file.buffer,
        contentType: req.file.mimetype,
      });
      const saved = await upsertSurveyAnswers(progress.id, campaignId, [
        { questionId, videoUrl: uploaded.publicUrl },
      ]);
      const answerRow = saved.answers[0];

      return res.json({
        success: true,
        surveyId: campaignId,
        progressId: progress.id,
        questionId,
        answerId: answerRow?.answerId,
        videoUrl: uploaded.publicUrl,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Video upload failed' });
    }
  },
);

/**
 * @swagger
 * /journalist/union-member-surveys/campaigns/{campaignId}/complete:
 *   post:
 *     summary: Mark survey complete and unlock insurance if rules pass
 *     description: |
 *       Validates all required answers (+ video if required). Updates UnionMemberBenefitStatus
 *       (e.g. accidentalUnlockedAt). President/admin still assigns actual JournalistInsurance policy.
 *     tags: [Journalist Union — Survey (Member)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Survey completed
 *         content:
 *           application/json:
 *             example:
 *               status: COMPLETED
 *               unlocked:
 *                 insuranceType: ACCIDENTAL
 *                 message: Accidental insurance unlocked. Apply in app or contact union desk.
 *               membership:
 *                 firstMembershipFree: true
 */
router.post('/campaigns/:campaignId/complete', jwtAuth, requireJournalistMember, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const profile = (res.locals as any).journalistProfile;
    const progress = await p.unionMemberSurveyProgress.findUnique({
      where: { campaignId_profileId: { campaignId, profileId: profile.id } },
    });
    if (!progress) return res.status(400).json({ error: 'Start survey first' });

    const result = await completeSurveyProgress(progress.id, profile.id, campaignId);
    if (!result.ok) {
      return res.status(400).json({
        error:
          (result as { reason?: string }).reason === 'CAMPAIGN_NOT_ACTIVE'
            ? 'Survey is not active'
            : 'Required questions not answered',
        missingQuestionIds: result.missingQuestionIds,
      });
    }

    const campaign = await p.unionMemberSurveyCampaign.findUnique({
      where: { id: campaignId },
      select: { requiredForInsuranceType: true, requiresReview: true },
    });

    const approved = result.reviewStatus === 'APPROVED';
    return res.json({
      success: true,
      surveyId: campaignId,
      progressId: progress.id,
      status: 'COMPLETED',
      reviewStatus: result.reviewStatus,
      message:
        result.reviewStatus === 'PENDING'
          ? 'Submitted for admin review'
          : 'Survey completed',
      unlocked:
        approved && campaign?.requiredForInsuranceType
          ? {
              insuranceType: campaign.requiredForInsuranceType,
              message: `${campaign.requiredForInsuranceType} insurance unlocked`,
            }
          : null,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to complete survey' });
  }
});

/**
 * @swagger
 * /journalist/union-member-surveys/my-progress:
 *   get:
 *     summary: List all survey progress rows for logged-in member
 *     tags: [Journalist Union — Survey (Member)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progress list
 */
router.get('/my-progress', jwtAuth, requireJournalistMember, async (_req, res) => {
  try {
    const profile = (res.locals as any).journalistProfile;
    const rows = await p.unionMemberSurveyProgress.findMany({
      where: { profileId: profile.id },
      include: {
        campaign: { select: { id: true, displayName: true, partyCode: true } },
        answers: { select: { questionId: true, answerText: true, yesNoValue: true, videoUrl: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ items: rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to load progress' });
  }
});

export default router;
