/**
 * Super Admin — union member survey campaigns (simple CRUD + assign to members).
 */
import prisma from './prisma';
import { unlockSurveyInsuranceBenefits } from './unionMemberSurvey';

const p: any = prisma;

const PARTY_CODES = new Set(['BJP', 'CONGRESS', 'BRS', 'TRS', 'OTHER']);
const SURVEY_TYPES = new Set(['GENERAL', 'POLITICAL_PARTY']);
const CAMPAIGN_STATUSES = new Set(['DRAFT', 'ACTIVE', 'CLOSED']);
const REVIEW_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const QUESTION_TYPES = new Set([
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  'YES_NO',
  'TEXT',
  'VIDEO_UPLOAD',
]);
const INSURANCE_TYPES = new Set(['ACCIDENTAL', 'HEALTH']);

function mapShortCodeToPartyCode(shortCode: string): string {
  const m: Record<string, string> = {
    BJP: 'BJP',
    INC: 'CONGRESS',
    CONGRESS: 'CONGRESS',
    BRS: 'BRS',
    TRS: 'TRS',
  };
  return m[shortCode.toUpperCase()] || 'OTHER';
}

export type SurveyQuestionInput = {
  questionText: string;
  nativeQuestionText?: string | null;
  questionType: string;
  options?: unknown;
  required?: boolean;
  sortOrder?: number;
  videoMaxSeconds?: number | null;
};

/** Simple form payload for React admin (flat fields). */
export type SimpleSurveyAnswer = {
  id?: string;
  label: string;
  color?: string;
  symbolUrl?: string;
  partyId?: string;
};

export type SimpleSurveyQuestion = {
  questionType: string;
  question: string;
  answers?: SimpleSurveyAnswer[];
  required?: boolean;
  videoMaxSeconds?: number;
};

export type SimpleCreateSurveyInput = {
  surveyType: 'GENERAL' | 'PARTY' | 'POLITICAL_PARTY';
  politicalPartyId?: string | null;
  surveyName: string;
  unionName?: string | null;
  state?: string | null;
  frameImageUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  /** Exactly one question — or use flat fields: questionType, question, answers */
  questions?: SimpleSurveyQuestion[];
  questionType?: string;
  question?: string;
  answers?: SimpleSurveyAnswer[];
  videoMaxSeconds?: number;
  required?: boolean;
  assignToAllMembers?: boolean;
};

const DEFAULT_UNION_FALLBACK = 'Democratic Journalist Federation (Working)';

/** Single union on platform — use settings row or env when unionName omitted */
export async function resolveDefaultUnionName(): Promise<string> {
  const fromEnv = cleanText(process.env.DEFAULT_UNION_NAME || process.env.JOURNALIST_UNION_NAME);
  if (fromEnv) return fromEnv;

  const settings = await p.journalistUnionSettings.findFirst({
    select: { unionName: true },
    orderBy: { createdAt: 'asc' },
  });
  if (settings?.unionName) return settings.unionName;

  return DEFAULT_UNION_FALLBACK;
}

function normalizeSimpleQuestions(body: SimpleCreateSurveyInput): SimpleSurveyQuestion[] {
  if (cleanText(body.question) || body.questionType) {
    return [
      {
        questionType: body.questionType || 'choice',
        question: body.question || '',
        answers: body.answers,
        required: body.required,
        videoMaxSeconds: body.videoMaxSeconds,
      },
    ];
  }

  const list = Array.isArray(body.questions)
    ? body.questions
    : body.questions
      ? [body.questions as SimpleSurveyQuestion]
      : [];

  if (list.length > 1) {
    throw new Error('Only one question allowed per survey');
  }
  return list;
}

function normalizeQuestionType(raw: string): string {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  const map: Record<string, string> = {
    choice: 'SINGLE_CHOICE',
    single: 'SINGLE_CHOICE',
    single_choice: 'SINGLE_CHOICE',
    multi: 'MULTI_CHOICE',
    multi_choice: 'MULTI_CHOICE',
    yes_no: 'YES_NO',
    yesno: 'YES_NO',
    yes: 'YES_NO',
    text: 'TEXT',
    video: 'VIDEO_UPLOAD',
    video_upload: 'VIDEO_UPLOAD',
  };
  const out = map[k] || raw.toUpperCase().replace(/-/g, '_');
  if (!QUESTION_TYPES.has(out)) throw new Error(`Invalid questionType: ${raw}`);
  return out;
}

function answersToOptions(answers?: SimpleSurveyAnswer[]) {
  if (!answers?.length) return null;
  return answers.map((a, i) => ({
    id: cleanText(a.id) || `opt_${i + 1}`,
    label: cleanText(a.label) || `Option ${i + 1}`,
    ...(a.color ? { color: a.color } : {}),
    ...(a.symbolUrl ? { symbolUrl: a.symbolUrl } : {}),
    ...(a.partyId ? { partyId: a.partyId } : {}),
  }));
}

/** Map simple UI body → internal createSurvey input */
export async function mapSimpleCreateSurveyInput(
  body: SimpleCreateSurveyInput,
  defaultUnionName?: string,
): Promise<CreateSurveyInput> {
  const surveyTypeRaw = cleanText(body.surveyType)?.toUpperCase() || 'GENERAL';
  const surveyType = surveyTypeRaw === 'PARTY' ? 'POLITICAL_PARTY' : surveyTypeRaw;

  if (!SURVEY_TYPES.has(surveyType)) throw new Error('surveyType must be GENERAL or PARTY');

  const surveyName = cleanText(body.surveyName);
  if (!surveyName) throw new Error('surveyName is required');

  const unionName = cleanText(body.unionName) || defaultUnionName || DEFAULT_UNION_FALLBACK;

  const simpleQuestions = normalizeSimpleQuestions(body);
  if (simpleQuestions.length !== 1) {
    throw new Error('Exactly one question is required');
  }

  const questions = simpleQuestions.map((q, idx) => {
    const questionType = normalizeQuestionType(q.questionType);
    const questionText = cleanText(q.question);
    if (!questionText) throw new Error(`questions[${idx}].question is required`);

    if (
      (questionType === 'SINGLE_CHOICE' || questionType === 'MULTI_CHOICE') &&
      (!q.answers || !q.answers.length)
    ) {
      throw new Error(`questions[${idx}]: answers required for choice type`);
    }

    return {
      questionText,
      questionType,
      options: answersToOptions(q.answers),
      required: q.required !== false,
      sortOrder: idx,
      videoMaxSeconds: questionType === 'VIDEO_UPLOAD' ? q.videoMaxSeconds ?? 30 : null,
    };
  });

  return {
    unionName,
    state: body.state,
    surveyType,
    politicalPartyId: body.politicalPartyId,
    displayName: body.surveyName,
    frameImageUrl: body.frameImageUrl,
    primaryColor: body.primaryColor,
    secondaryColor: body.secondaryColor,
    campaignStatus: 'DRAFT',
    requiresReview: true,
    questions,
    assignToAllMembers: !!body.assignToAllMembers,
  };
}

export async function createSurveySimple(body: SimpleCreateSurveyInput) {
  const unionName = await resolveDefaultUnionName();
  return createSurvey(await mapSimpleCreateSurveyInput(body, unionName));
}

export type CreateSurveyInput = {
  unionName: string;
  state?: string | null;
  surveyType?: string;
  politicalPartyId?: string | null;
  partyCode?: string;
  displayName: string;
  description?: string | null;
  logoUrl?: string | null;
  frameImageUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  frameStyleKey?: string | null;
  campaignStatus?: string;
  requiresReview?: boolean;
  requiredForInsuranceType?: string | null;
  endsAt?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  questions?: SurveyQuestionInput[];
  assignToAllMembers?: boolean;
};

function cleanText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s || null;
}

function mapCampaign(c: any, extras?: Record<string, unknown>) {
  return {
    id: c.id,
    unionName: c.unionName,
    state: c.state,
    surveyType: c.surveyType ?? 'POLITICAL_PARTY',
    politicalPartyId: c.politicalPartyId ?? null,
    politicalParty: c.politicalParty
      ? {
          id: c.politicalParty.id,
          shortCode: c.politicalParty.shortCode,
          name: c.politicalParty.name,
          symbolImageUrl: c.politicalParty.symbolImageUrl,
          primaryColor: c.politicalParty.primaryColor,
          secondaryColor: c.politicalParty.secondaryColor,
        }
      : undefined,
    partyCode: c.partyCode,
    displayName: c.displayName,
    description: c.description,
    logoUrl: c.logoUrl,
    frameImageUrl: c.frameImageUrl ?? null,
    primaryColor: c.primaryColor,
    secondaryColor: c.secondaryColor,
    frameStyleKey: c.frameStyleKey,
    campaignStatus: c.campaignStatus ?? 'DRAFT',
    requiresReview: c.requiresReview !== false,
    requiredForInsuranceType: c.requiredForInsuranceType,
    endsAt: c.endsAt ?? null,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    questionCount: c.questions?.length ?? c._count?.questions ?? 0,
    assignedCount: c._count?.progress ?? undefined,
    completedCount: undefined,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    questions: c.questions
      ? c.questions.map((q: any) => ({
          id: q.id,
          questionText: q.questionText,
          nativeQuestionText: q.nativeQuestionText,
          questionType: q.questionType,
          options: q.options,
          required: q.required,
          sortOrder: q.sortOrder,
          videoMaxSeconds: q.videoMaxSeconds,
          yesCount: q.yesCount,
          noCount: q.noCount,
        }))
      : undefined,
    ...extras,
  };
}

export async function listSurveys(filters: {
  unionName?: string | null;
  state?: string | null;
  isActive?: boolean | null;
}) {
  const where: any = {};
  if (filters.unionName) where.unionName = { contains: filters.unionName, mode: 'insensitive' };
  if (filters.state) where.state = { equals: filters.state, mode: 'insensitive' };
  if (filters.isActive === true) where.isActive = true;
  if (filters.isActive === false) where.isActive = false;

  const rows = await p.unionMemberSurveyCampaign.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      questions: { orderBy: { sortOrder: 'asc' }, select: { id: true } },
      _count: { select: { progress: true, questions: true } },
    },
  });

  const ids = rows.map((r: any) => r.id);
  const completedByCampaign = new Map<string, number>();
  if (ids.length) {
    const grouped = await p.unionMemberSurveyProgress.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: ids }, status: 'COMPLETED' },
      _count: { _all: true },
    });
    for (const g of grouped) completedByCampaign.set(g.campaignId, g._count._all);
  }

  return rows.map((r: any) =>
    mapCampaign(r, {
      questionCount: r._count.questions,
      assignedCount: r._count.progress,
      completedCount: completedByCampaign.get(r.id) ?? 0,
    }),
  );
}

export async function getSurveyById(campaignId: string) {
  const c = await p.unionMemberSurveyCampaign.findUnique({
    where: { id: campaignId },
    include: {
      questions: { orderBy: { sortOrder: 'asc' } },
      politicalParty: true,
      _count: { select: { progress: true } },
    },
  });
  if (!c) return null;

  const [completed, inProgress, notStarted, pendingReview, approved, rejected] = await Promise.all([
    p.unionMemberSurveyProgress.count({ where: { campaignId, status: 'COMPLETED' } }),
    p.unionMemberSurveyProgress.count({ where: { campaignId, status: 'IN_PROGRESS' } }),
    p.unionMemberSurveyProgress.count({ where: { campaignId, status: 'NOT_STARTED' } }),
    p.unionMemberSurveyProgress.count({ where: { campaignId, reviewStatus: 'PENDING' } }),
    p.unionMemberSurveyProgress.count({ where: { campaignId, reviewStatus: 'APPROVED' } }),
    p.unionMemberSurveyProgress.count({ where: { campaignId, reviewStatus: 'REJECTED' } }),
  ]);

  return mapCampaign(c, {
    assignedCount: c._count.progress,
    completion: { completed, inProgress, notStarted, total: c._count.progress },
    review: { pending: pendingReview, approved, rejected },
  });
}

async function resolveSurveyBranding(input: CreateSurveyInput) {
  let surveyType = cleanText(input.surveyType)?.toUpperCase() || 'GENERAL';
  if (surveyType === 'PARTY') surveyType = 'POLITICAL_PARTY';
  if (!SURVEY_TYPES.has(surveyType)) throw new Error('Invalid surveyType');

  let partyCode = cleanText(input.partyCode)?.toUpperCase() || 'OTHER';
  let primaryColor = cleanText(input.primaryColor) || '#0D47A1';
  let secondaryColor = cleanText(input.secondaryColor) || '#FFB300';
  let logoUrl = cleanText(input.logoUrl);
  let frameImageUrl = cleanText(input.frameImageUrl);
  let politicalPartyId = cleanText(input.politicalPartyId);

  if (surveyType === 'POLITICAL_PARTY') {
    if (politicalPartyId) {
      const party = await p.indianPoliticalParty.findUnique({ where: { id: politicalPartyId } });
      if (!party) throw new Error('politicalPartyId not found');
      partyCode = mapShortCodeToPartyCode(party.shortCode);
      primaryColor = cleanText(input.primaryColor) || party.primaryColor;
      secondaryColor = cleanText(input.secondaryColor) || party.secondaryColor;
      logoUrl = logoUrl || party.symbolImageUrl;
      frameImageUrl = frameImageUrl || party.symbolImageUrl;
    } else if (!PARTY_CODES.has(partyCode) || partyCode === 'OTHER') {
      throw new Error('POLITICAL_PARTY survey requires politicalPartyId or valid partyCode');
    }
  } else {
    partyCode = 'OTHER';
    politicalPartyId = null;
  }

  if (!PARTY_CODES.has(partyCode)) throw new Error('Invalid partyCode');

  const campaignStatus = cleanText(input.campaignStatus)?.toUpperCase() || 'DRAFT';
  if (!CAMPAIGN_STATUSES.has(campaignStatus)) throw new Error('Invalid campaignStatus');

  return {
    surveyType,
    politicalPartyId,
    partyCode,
    primaryColor,
    secondaryColor,
    logoUrl,
    frameImageUrl,
    campaignStatus,
  };
}

export async function createSurvey(input: CreateSurveyInput) {
  let unionName = cleanText(input.unionName);
  if (!unionName) {
    unionName = await resolveDefaultUnionName();
  }
  const displayName = cleanText(input.displayName);
  if (!displayName) {
    throw new Error('displayName or surveyName is required');
  }

  const questions = Array.isArray(input.questions) ? input.questions : [];
  if (questions.length !== 1) {
    throw new Error(questions.length > 1 ? 'Only one question allowed per survey' : 'Exactly one question is required');
  }

  const branding = await resolveSurveyBranding(input);

  const insurance = cleanText(input.requiredForInsuranceType)?.toUpperCase();
  if (insurance && !INSURANCE_TYPES.has(insurance)) throw new Error('Invalid requiredForInsuranceType');

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!cleanText(q.questionText)) throw new Error(`questions[${i}].questionText is required`);
    if (!QUESTION_TYPES.has(q.questionType)) throw new Error(`questions[${i}].questionType is invalid`);
  }

  const campaign = await p.unionMemberSurveyCampaign.create({
    data: {
      unionName,
      state: cleanText(input.state),
      surveyType: branding.surveyType,
      politicalPartyId: branding.politicalPartyId,
      partyCode: branding.partyCode,
      displayName,
      description: cleanText(input.description),
      logoUrl: branding.logoUrl,
      frameImageUrl: branding.frameImageUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      frameStyleKey: cleanText(input.frameStyleKey),
      campaignStatus: branding.campaignStatus,
      requiresReview: input.requiresReview !== false,
      requiredForInsuranceType: insurance || null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
      isActive: input.isActive !== false,
      questions: {
        create: questions.map((q, idx) => ({
          questionText: cleanText(q.questionText)!,
          nativeQuestionText: cleanText(q.nativeQuestionText),
          questionType: q.questionType,
          options: q.options ?? null,
          required: q.required !== false,
          sortOrder: q.sortOrder ?? idx,
          videoMaxSeconds: q.videoMaxSeconds ?? null,
        })),
      },
    },
    include: { questions: { orderBy: { sortOrder: 'asc' } }, politicalParty: true },
  });

  let assignResult = null;
  if (input.assignToAllMembers) {
    assignResult = await assignSurveyToMembers(campaign.id, { allMembers: true });
  }

  return { campaign: mapCampaign(campaign, { questionCount: campaign.questions.length }), assignResult };
}

export async function updateSurvey(
  campaignId: string,
  patch: Partial<CreateSurveyInput> & { questions?: SurveyQuestionInput[] },
) {
  const existing = await p.unionMemberSurveyCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) return null;

  const data: any = { updatedAt: new Date() };
  if (patch.unionName !== undefined) data.unionName = cleanText(patch.unionName) || existing.unionName;
  if (patch.state !== undefined) data.state = cleanText(patch.state);
  if (patch.displayName !== undefined) data.displayName = cleanText(patch.displayName) || existing.displayName;
  if (patch.description !== undefined) data.description = cleanText(patch.description);
  if (patch.logoUrl !== undefined) data.logoUrl = cleanText(patch.logoUrl);
  if (patch.primaryColor !== undefined) data.primaryColor = cleanText(patch.primaryColor) || existing.primaryColor;
  if (patch.secondaryColor !== undefined) data.secondaryColor = cleanText(patch.secondaryColor) || existing.secondaryColor;
  if (patch.frameStyleKey !== undefined) data.frameStyleKey = cleanText(patch.frameStyleKey);
  if (patch.sortOrder !== undefined) data.sortOrder = Number(patch.sortOrder);
  if (patch.isActive !== undefined) data.isActive = !!patch.isActive;
  if (patch.surveyType !== undefined || patch.politicalPartyId !== undefined || patch.partyCode !== undefined) {
    const branding = await resolveSurveyBranding({
      surveyType: patch.surveyType ?? existing.surveyType,
      politicalPartyId: patch.politicalPartyId ?? existing.politicalPartyId,
      partyCode: patch.partyCode ?? existing.partyCode,
      primaryColor: patch.primaryColor ?? existing.primaryColor,
      secondaryColor: patch.secondaryColor ?? existing.secondaryColor,
      logoUrl: patch.logoUrl ?? existing.logoUrl,
      frameImageUrl: patch.frameImageUrl ?? existing.frameImageUrl,
    } as CreateSurveyInput);
    data.surveyType = branding.surveyType;
    data.politicalPartyId = branding.politicalPartyId;
    data.partyCode = branding.partyCode;
    if (patch.primaryColor === undefined) data.primaryColor = branding.primaryColor;
    if (patch.secondaryColor === undefined) data.secondaryColor = branding.secondaryColor;
    if (patch.logoUrl === undefined && branding.logoUrl) data.logoUrl = branding.logoUrl;
    if (patch.frameImageUrl === undefined && branding.frameImageUrl) data.frameImageUrl = branding.frameImageUrl;
  } else if (patch.partyCode !== undefined) {
    const pc = cleanText(patch.partyCode)?.toUpperCase();
    if (!pc || !PARTY_CODES.has(pc)) throw new Error('Invalid partyCode');
    data.partyCode = pc;
  }
  if (patch.frameImageUrl !== undefined) data.frameImageUrl = cleanText(patch.frameImageUrl);
  if (patch.campaignStatus !== undefined) {
    const cs = cleanText(patch.campaignStatus)?.toUpperCase();
    if (!cs || !CAMPAIGN_STATUSES.has(cs)) throw new Error('Invalid campaignStatus');
    data.campaignStatus = cs;
    if (cs === 'ACTIVE') data.isActive = true;
    if (cs === 'CLOSED') data.isActive = false;
  }
  if (patch.requiresReview !== undefined) data.requiresReview = !!patch.requiresReview;
  if (patch.endsAt !== undefined) data.endsAt = patch.endsAt ? new Date(patch.endsAt) : null;
  if (patch.requiredForInsuranceType !== undefined) {
    const ins = cleanText(patch.requiredForInsuranceType)?.toUpperCase();
    if (ins && !INSURANCE_TYPES.has(ins)) throw new Error('Invalid requiredForInsuranceType');
    data.requiredForInsuranceType = ins || null;
  }

  await p.$transaction(async (tx: any) => {
    await tx.unionMemberSurveyCampaign.update({ where: { id: campaignId }, data });

    if (Array.isArray(patch.questions)) {
      if (patch.questions.length > 1) {
        throw new Error('Only one question allowed per survey');
      }
      await tx.unionMemberSurveyQuestion.deleteMany({ where: { campaignId } });
      if (patch.questions.length) {
        await tx.unionMemberSurveyQuestion.createMany({
          data: patch.questions.map((q, idx) => ({
            campaignId,
            questionText: cleanText(q.questionText)!,
            nativeQuestionText: cleanText(q.nativeQuestionText),
            questionType: q.questionType,
            options: q.options ?? null,
            required: q.required !== false,
            sortOrder: q.sortOrder ?? idx,
            videoMaxSeconds: q.videoMaxSeconds ?? null,
          })),
        });
      }
    }
  });

  return getSurveyById(campaignId);
}

export async function deleteSurvey(campaignId: string) {
  const existing = await p.unionMemberSurveyCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) return null;
  await p.unionMemberSurveyCampaign.update({
    where: { id: campaignId },
    data: { isActive: false, updatedAt: new Date() },
  });
  return { id: campaignId, isActive: false };
}

/** Create NOT_STARTED progress rows so members see this survey in their app. */
export async function publishSurvey(campaignId: string) {
  const c = await p.unionMemberSurveyCampaign.findUnique({ where: { id: campaignId } });
  if (!c) return null;
  const updated = await p.unionMemberSurveyCampaign.update({
    where: { id: campaignId },
    data: { campaignStatus: 'ACTIVE', isActive: true, updatedAt: new Date() },
    include: { questions: { orderBy: { sortOrder: 'asc' } }, politicalParty: true },
  });
  return mapCampaign(updated);
}

export async function closeSurvey(campaignId: string) {
  const c = await p.unionMemberSurveyCampaign.findUnique({ where: { id: campaignId } });
  if (!c) return null;
  const updated = await p.unionMemberSurveyCampaign.update({
    where: { id: campaignId },
    data: { campaignStatus: 'CLOSED', isActive: false, updatedAt: new Date() },
    include: { questions: { orderBy: { sortOrder: 'asc' } }, politicalParty: true },
  });
  return mapCampaign(updated);
}

export async function assignSurveyToMembers(
  campaignId: string,
  opts: {
    profileIds?: string[];
    allMembers?: boolean;
    approvedOnly?: boolean;
    districts?: string[];
    mandals?: string[];
  },
) {
  const campaign = await p.unionMemberSurveyCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, unionName: true, state: true, isActive: true, campaignStatus: true },
  });
  if (!campaign) throw new Error('Survey not found');
  if (!campaign.isActive || campaign.campaignStatus === 'CLOSED') {
    throw new Error('Survey is not open for assignment');
  }

  const where: any = { unionName: campaign.unionName };
  if (opts.approvedOnly !== false) where.approved = true;
  if (campaign.state) {
    where.state = { equals: campaign.state, mode: 'insensitive' };
  }
  if (opts.districts?.length) {
    const districts = opts.districts.map((d) => d.trim()).filter(Boolean);
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      { OR: districts.map((d) => ({ district: { equals: d, mode: 'insensitive' } })) },
    ];
  }
  if (opts.mandals?.length) {
    const mandals = opts.mandals.map((m) => m.trim()).filter(Boolean);
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      { OR: mandals.map((m) => ({ mandal: { equals: m, mode: 'insensitive' } })) },
    ];
  }

  let profileIds = opts.profileIds?.filter(Boolean) ?? [];
  if (opts.allMembers) {
    const profiles = await p.journalistProfile.findMany({ where, select: { id: true } });
    profileIds = profiles.map((x: { id: string }) => x.id);
  } else if (profileIds.length) {
    const profiles = await p.journalistProfile.findMany({
      where: { id: { in: profileIds }, unionName: campaign.unionName },
      select: { id: true },
    });
    profileIds = profiles.map((x: { id: string }) => x.id);
  } else {
    throw new Error('Provide profileIds or set allMembers=true');
  }

  if (!profileIds.length) {
    return { campaignId, assigned: 0, skipped: 0, totalMembers: 0 };
  }

  const result = await p.unionMemberSurveyProgress.createMany({
    data: profileIds.map((profileId) => ({
      campaignId,
      profileId,
      status: 'NOT_STARTED',
    })),
    skipDuplicates: true,
  });

  return {
    campaignId,
    assigned: result.count,
    totalTargeted: profileIds.length,
    skipped: profileIds.length - result.count,
  };
}

export async function listSurveyMemberProgress(
  campaignId: string,
  filters: { status?: string; reviewStatus?: string; district?: string; page?: number; limit?: number },
) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: any = { campaignId };
  if (filters.status && ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(filters.status)) {
    where.status = filters.status;
  }
  if (filters.reviewStatus && REVIEW_STATUSES.has(filters.reviewStatus)) {
    where.reviewStatus = filters.reviewStatus;
  }
  if (filters.district) {
    where.profile = { district: { equals: filters.district, mode: 'insensitive' } };
  }

  const [total, rows] = await Promise.all([
    p.unionMemberSurveyProgress.count({ where }),
    p.unionMemberSurveyProgress.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        profile: {
          select: {
            id: true,
            pressId: true,
            unionName: true,
            state: true,
            district: true,
            mandal: true,
            memberType: true,
            user: {
              select: {
                mobileNumber: true,
                profile: { select: { fullName: true } },
              },
            },
          },
        },
        answers: {
          select: {
            id: true,
            questionId: true,
            yesNoValue: true,
            videoUrl: true,
            answerText: true,
            answerJson: true,
          },
        },
      },
    }),
  ]);

  return {
    total,
    page,
    limit,
    items: rows.map((row: any) => ({
      progressId: row.id,
      profileId: row.profileId,
      memberName: row.profile?.user?.profile?.fullName ?? null,
      mobileNumber: row.profile?.user?.mobileNumber ?? null,
      pressId: row.profile?.pressId ?? null,
      memberType: row.profile?.memberType ?? null,
      state: row.profile?.state ?? null,
      district: row.profile?.district ?? null,
      mandal: row.profile?.mandal ?? null,
      status: row.status,
      reviewStatus: row.reviewStatus,
      reviewNote: row.reviewNote,
      reviewedAt: row.reviewedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      answerCount: row.answers?.length ?? 0,
      hasVideo: row.answers?.some((a: any) => !!a.videoUrl) ?? false,
      answers: row.answers,
    })),
  };
}

export async function getMemberSurveyDetail(campaignId: string, progressId: string) {
  const row = await p.unionMemberSurveyProgress.findFirst({
    where: { id: progressId, campaignId },
    include: {
      campaign: { include: { questions: { orderBy: { sortOrder: 'asc' } } } },
      profile: {
        select: {
          id: true,
          pressId: true,
          state: true,
          district: true,
          mandal: true,
          user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
        },
      },
      answers: true,
    },
  });
  if (!row) return null;
  return row;
}

export async function approveSurveySubmission(
  progressId: string,
  reviewerUserId: string,
  note?: string | null,
) {
  const progress = await p.unionMemberSurveyProgress.findUnique({
    where: { id: progressId },
    include: { campaign: true },
  });
  if (!progress) throw new Error('Submission not found');
  if (progress.status !== 'COMPLETED') throw new Error('Survey not completed yet');

  await p.unionMemberSurveyProgress.update({
    where: { id: progressId },
    data: {
      reviewStatus: 'APPROVED',
      reviewNote: cleanText(note),
      reviewedAt: new Date(),
      reviewedByUserId: reviewerUserId,
    },
  });

  await unlockSurveyInsuranceBenefits(progress.profileId, progress.campaign);

  return { progressId, reviewStatus: 'APPROVED' };
}

export async function rejectSurveySubmission(
  progressId: string,
  reviewerUserId: string,
  note: string,
) {
  const reason = cleanText(note);
  if (!reason) throw new Error('reviewNote is required when rejecting');

  const progress = await p.unionMemberSurveyProgress.findUnique({ where: { id: progressId } });
  if (!progress) throw new Error('Submission not found');

  await p.unionMemberSurveyProgress.update({
    where: { id: progressId },
    data: {
      reviewStatus: 'REJECTED',
      reviewNote: reason,
      reviewedAt: new Date(),
      reviewedByUserId: reviewerUserId,
      status: 'IN_PROGRESS',
      completedAt: null,
    },
  });

  return { progressId, reviewStatus: 'REJECTED', message: 'Member can re-submit answers' };
}

function extractChoiceId(answer: any): string | null {
  if (!answer) return null;
  const j = answer.answerJson;
  if (j && typeof j === 'object') {
    const raw = (j as any).selectedId ?? (j as any).value ?? (j as any).optionId;
    if (raw != null) return String(raw);
  }
  const t = String(answer.answerText ?? '').trim();
  return t || null;
}

/** Area-wise completion + choice breakdown for GENERAL / SINGLE_CHOICE surveys */
export async function getSurveyAreaReport(
  campaignId: string,
  filters: { state?: string | null; district?: string | null },
) {
  const campaign = await p.unionMemberSurveyCampaign.findUnique({
    where: { id: campaignId },
    include: { questions: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!campaign) return null;

  const progressRows = await p.unionMemberSurveyProgress.findMany({
    where: { campaignId },
    include: {
      profile: {
        select: { state: true, district: true, mandal: true },
      },
      answers: true,
    },
  });

  const filtered = progressRows.filter((pr: any) => {
    if (filters.state && pr.profile?.state?.toLowerCase() !== filters.state.toLowerCase()) return false;
    if (filters.district && pr.profile?.district?.toLowerCase() !== filters.district.toLowerCase()) {
      return false;
    }
    return true;
  });

  type AreaKey = string;
  const areaMap = new Map<
    AreaKey,
    {
      state: string | null;
      district: string | null;
      mandal: string | null;
      assigned: number;
      completed: number;
      pendingReview: number;
      approved: number;
      rejected: number;
      choiceCounts: Record<string, number>;
    }
  >();

  for (const pr of filtered) {
    const state = pr.profile?.state ?? 'Unknown';
    const district = pr.profile?.district ?? 'Unknown';
    const mandal = pr.profile?.mandal ?? 'Unknown';
    const key = `${state}|${district}|${mandal}`;
    if (!areaMap.has(key)) {
      areaMap.set(key, {
        state,
        district,
        mandal,
        assigned: 0,
        completed: 0,
        pendingReview: 0,
        approved: 0,
        rejected: 0,
        choiceCounts: {},
      });
    }
    const bucket = areaMap.get(key)!;
    bucket.assigned += 1;
    if (pr.status === 'COMPLETED') bucket.completed += 1;
    if (pr.reviewStatus === 'PENDING') bucket.pendingReview += 1;
    if (pr.reviewStatus === 'APPROVED') bucket.approved += 1;
    if (pr.reviewStatus === 'REJECTED') bucket.rejected += 1;

    const firstChoiceQ = campaign.questions.find(
      (q: any) => q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTI_CHOICE',
    );
    if (firstChoiceQ && pr.answers?.length) {
      const ans = pr.answers.find((a: any) => a.questionId === firstChoiceQ.id);
      const choiceId = extractChoiceId(ans);
      if (choiceId) bucket.choiceCounts[choiceId] = (bucket.choiceCounts[choiceId] || 0) + 1;
    }
  }

  const choiceQuestion = campaign.questions.find((q: any) => q.questionType === 'SINGLE_CHOICE');
  const optionLabels: Record<string, string> = {};
  if (choiceQuestion?.options && Array.isArray(choiceQuestion.options)) {
    for (const opt of choiceQuestion.options as any[]) {
      if (opt?.id) optionLabels[String(opt.id)] = opt.label || opt.id;
    }
  }

  return {
    campaignId: campaign.id,
    displayName: campaign.displayName,
    surveyType: campaign.surveyType,
    state: campaign.state,
    areas: Array.from(areaMap.values()).map((a) => ({
      ...a,
      choiceBreakdown: Object.entries(a.choiceCounts).map(([id, count]) => ({
        optionId: id,
        label: optionLabels[id] || id,
        count,
      })),
    })),
    totals: {
      assigned: filtered.length,
      completed: filtered.filter((p: any) => p.status === 'COMPLETED').length,
      pendingReview: filtered.filter((p: any) => p.reviewStatus === 'PENDING').length,
    },
  };
}
