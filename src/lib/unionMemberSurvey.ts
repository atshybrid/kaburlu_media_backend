import prisma from './prisma';

const p: any = prisma;

export type YesNoValue = 'YES' | 'NO';

export type SurveyAnswerInput = {
  questionId: string;
  answerText?: string | null;
  answerJson?: Record<string, unknown> | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
};

/** Parse YES/NO from answer payload (app may send value, selectedId, or text). */
export function parseYesNoValue(input: SurveyAnswerInput): YesNoValue | null {
  const j = input.answerJson;
  if (j && typeof j === 'object') {
    const raw = (j as any).value ?? (j as any).selectedId ?? (j as any).answer;
    if (raw != null) {
      const v = String(raw).trim().toUpperCase();
      if (v === 'YES' || v === 'Y') return 'YES';
      if (v === 'NO' || v === 'N') return 'NO';
      const low = String(raw).trim().toLowerCase();
      if (low === 'yes') return 'YES';
      if (low === 'no') return 'NO';
    }
  }
  const t = String(input.answerText ?? '').trim().toLowerCase();
  if (['yes', 'y', 'అవును', 'avunu', 'true'].includes(t)) return 'YES';
  if (['no', 'n', 'లేదు', 'ledu', 'false'].includes(t)) return 'NO';
  return null;
}

async function adjustYesNoCountsTx(
  tx: any,
  questionId: string,
  from: YesNoValue | null,
  to: YesNoValue | null,
) {
  if (from === to) return;
  const data: Record<string, { increment?: number; decrement?: number }> = {};
  if (from === 'YES') data.yesCount = { decrement: 1 };
  if (from === 'NO') data.noCount = { decrement: 1 };
  if (to === 'YES') data.yesCount = { ...(data.yesCount || {}), increment: 1 };
  if (to === 'NO') data.noCount = { ...(data.noCount || {}), increment: 1 };
  if (!Object.keys(data).length) return;
  await tx.unionMemberSurveyQuestion.update({ where: { id: questionId }, data });
}

export async function getOrCreateProgress(campaignId: string, profileId: string) {
  const existing = await p.unionMemberSurveyProgress.findUnique({
    where: { campaignId_profileId: { campaignId, profileId } },
  });
  if (existing) return existing;
  return p.unionMemberSurveyProgress.create({
    data: {
      campaignId,
      profileId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  });
}

export type SavedSurveyAnswer = {
  answerId: string;
  questionId: string;
  videoUrl: string | null;
  answerText: string | null;
  answerJson: unknown;
};

export async function upsertSurveyAnswers(
  progressId: string,
  campaignId: string,
  answers: SurveyAnswerInput[],
): Promise<{
  saved: number;
  answers: SavedSurveyAnswer[];
  yesNoUpdates: { questionId: string; yesCount: number; noCount: number }[];
}> {
  const questions = await p.unionMemberSurveyQuestion.findMany({
    where: { campaignId },
    select: { id: true, questionType: true },
  });
  const qMap = new Map<string, { id: string; questionType: string }>(
    questions.map((q: { id: string; questionType: string }) => [q.id, q]),
  );

  let saved = 0;
  const savedAnswers: SavedSurveyAnswer[] = [];
  const yesNoUpdates: { questionId: string; yesCount: number; noCount: number }[] = [];

  for (const a of answers) {
    const q = qMap.get(a.questionId);
    if (!q) continue;

    const parsed = parseYesNoValue(a);
    const yesNo = q.questionType === 'YES_NO' || parsed != null ? parsed : null;

    const existing = await p.unionMemberSurveyAnswer.findUnique({
      where: { progressId_questionId: { progressId, questionId: a.questionId } },
      select: { id: true, yesNoValue: true },
    });

    const prevYesNo = (existing?.yesNoValue as YesNoValue | null) || null;

    const row = await p.$transaction(async (tx: any) => {
      const answerRow = await tx.unionMemberSurveyAnswer.upsert({
        where: { progressId_questionId: { progressId, questionId: a.questionId } },
        create: {
          progressId,
          questionId: a.questionId,
          answerText: a.answerText ?? null,
          answerJson: a.answerJson ?? null,
          yesNoValue: yesNo,
          videoUrl: a.videoUrl ?? null,
          imageUrl: a.imageUrl ?? null,
        },
        update: {
          answerText: a.answerText ?? null,
          answerJson: a.answerJson ?? undefined,
          yesNoValue: yesNo,
          videoUrl: a.videoUrl ?? undefined,
          imageUrl: a.imageUrl ?? undefined,
        },
      });

      if (yesNo !== null || prevYesNo !== null) {
        await adjustYesNoCountsTx(tx, a.questionId, prevYesNo, yesNo);
      }
      return answerRow;
    });

    savedAnswers.push({
      answerId: row.id,
      questionId: row.questionId,
      videoUrl: row.videoUrl,
      answerText: row.answerText,
      answerJson: row.answerJson,
    });

    if (yesNo !== null) {
      const counts = await p.unionMemberSurveyQuestion.findUnique({
        where: { id: a.questionId },
        select: { yesCount: true, noCount: true },
      });
      yesNoUpdates.push({
        questionId: a.questionId,
        yesCount: counts?.yesCount ?? 0,
        noCount: counts?.noCount ?? 0,
      });
    }

    saved += 1;
  }

  await p.unionMemberSurveyProgress.update({
    where: { id: progressId },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
  });

  return { saved, answers: savedAnswers, yesNoUpdates };
}

export async function unlockSurveyInsuranceBenefits(
  profileId: string,
  campaign: { unionName: string; requiredForInsuranceType: string | null },
) {
  if (!campaign.requiredForInsuranceType) return;
  const profile = await p.journalistProfile.findUnique({
    where: { id: profileId },
    select: { unionName: true },
  });
  const unionName = profile?.unionName || campaign.unionName;
  const now = new Date();
  const patch: Record<string, unknown> = { unionName, updatedAt: now };
  if (campaign.requiredForInsuranceType === 'ACCIDENTAL') patch.accidentalUnlockedAt = now;
  if (campaign.requiredForInsuranceType === 'HEALTH') patch.healthUnlockedAt = now;
  await p.unionMemberBenefitStatus.upsert({
    where: { profileId },
    create: {
      profileId,
      unionName,
      firstMembershipWaived: true,
      firstMembershipWaivedAt: now,
      ...(patch as object),
    },
    update: patch,
  });
}

export async function completeSurveyProgress(
  progressId: string,
  profileId: string,
  campaignId: string,
): Promise<{
  ok: boolean;
  missingQuestionIds?: string[];
  reason?: string;
  reviewStatus?: 'PENDING' | 'APPROVED';
}> {
  const campaign = await p.unionMemberSurveyCampaign.findUnique({
    where: { id: campaignId },
    include: { questions: { where: { required: true }, select: { id: true, questionType: true } } },
  });
  if (!campaign) return { ok: false };
  if (campaign.campaignStatus && campaign.campaignStatus !== 'ACTIVE') {
    return { ok: false, reason: 'CAMPAIGN_NOT_ACTIVE' };
  }

  const answers = await p.unionMemberSurveyAnswer.findMany({
    where: { progressId },
    select: { questionId: true, answerText: true, answerJson: true, videoUrl: true, yesNoValue: true },
  });
  const answered = new Set(answers.map((a: any) => a.questionId));

  const missing: string[] = [];
  for (const q of campaign.questions) {
    if (!answered.has(q.id)) {
      missing.push(q.id);
      continue;
    }
    const row = answers.find((a: any) => a.questionId === q.id);
    if (q.questionType === 'VIDEO_UPLOAD' && !row?.videoUrl) missing.push(q.id);
    if (q.questionType === 'YES_NO' && !row?.yesNoValue) missing.push(q.id);
    if (q.questionType === 'TEXT' && !String(row?.answerText ?? '').trim()) missing.push(q.id);
  }

  if (missing.length) return { ok: false, missingQuestionIds: missing };

  const needsReview = campaign.requiresReview !== false;
  await p.unionMemberSurveyProgress.update({
    where: { id: progressId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      reviewStatus: needsReview ? 'PENDING' : 'APPROVED',
      reviewNote: null,
      reviewedAt: needsReview ? null : new Date(),
    },
  });

  if (!needsReview) {
    await unlockSurveyInsuranceBenefits(profileId, campaign);
  }

  return { ok: true, reviewStatus: needsReview ? 'PENDING' : 'APPROVED' };
}

export async function getCampaignQuestionStats(campaignId: string) {
  const questions = await p.unionMemberSurveyQuestion.findMany({
    where: { campaignId },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      questionText: true,
      questionType: true,
      yesCount: true,
      noCount: true,
      sortOrder: true,
    },
  });

  return questions.map((q: any) => ({
    questionId: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    yesCount: q.yesCount,
    noCount: q.noCount,
    totalResponses: q.yesCount + q.noCount,
  }));
}
