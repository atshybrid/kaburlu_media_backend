/**
 * Journalist union member list — survey + insurance overview for admin dashboards.
 */
import prisma from './prisma';
import { buildDocumentsPayload, formatMemberApprovalRow } from './journalistUnionMember';

const p: any = prisma;

export type InsuranceUiStatus =
  | 'LOCKED_SURVEY_REQUIRED'
  | 'LOCKED_REQUIRES_ACCIDENTAL'
  | 'UNLOCKED_CAN_APPLY'
  | 'ACTIVE';

export function buildInsuranceUiStatus(
  type: 'ACCIDENTAL' | 'HEALTH',
  benefit: any | null,
): InsuranceUiStatus {
  if (!benefit) {
    return type === 'ACCIDENTAL' ? 'LOCKED_SURVEY_REQUIRED' : 'LOCKED_REQUIRES_ACCIDENTAL';
  }
  if (type === 'ACCIDENTAL') {
    if (benefit.accidentalInsuranceActive) return 'ACTIVE';
    if (benefit.accidentalUnlockedAt) return 'UNLOCKED_CAN_APPLY';
    return 'LOCKED_SURVEY_REQUIRED';
  }
  if (benefit.healthInsuranceActive) return 'ACTIVE';
  if (benefit.healthUnlockedAt) return 'UNLOCKED_CAN_APPLY';
  if (benefit.accidentalInsuranceActive) return 'LOCKED_SURVEY_REQUIRED';
  return 'LOCKED_REQUIRES_ACCIDENTAL';
}

export type SurveyOverallStatus =
  | 'NO_CAMPAIGNS'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PARTIALLY_COMPLETE'
  | 'ALL_COMPLETED';

export function buildSurveyOverallStatus(
  campaignIds: string[],
  progressRows: { campaignId: string; status: string }[],
): SurveyOverallStatus {
  if (!campaignIds.length) return 'NO_CAMPAIGNS';
  const map = new Map(progressRows.map((r) => [r.campaignId, r.status]));
  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  for (const cid of campaignIds) {
    const st = map.get(cid) || 'NOT_STARTED';
    if (st === 'COMPLETED') completed++;
    else if (st === 'IN_PROGRESS') inProgress++;
    else notStarted++;
  }
  if (completed === campaignIds.length) return 'ALL_COMPLETED';
  if (inProgress > 0) return 'IN_PROGRESS';
  if (completed > 0 && notStarted > 0) return 'PARTIALLY_COMPLETE';
  if (completed > 0) return 'PARTIALLY_COMPLETE';
  return 'NOT_STARTED';
}

export function buildSurveyCampaignsSummary(
  campaigns: { id: string; partyCode: string; displayName: string; requiredForInsuranceType?: string | null }[],
  progressRows: any[],
) {
  const progressMap = new Map(progressRows.map((pr) => [pr.campaignId, pr]));
  return campaigns.map((c) => {
    const pr = progressMap.get(c.id);
    return {
      campaignId: c.id,
      partyCode: c.partyCode,
      displayName: c.displayName,
      requiredForInsuranceType: c.requiredForInsuranceType,
      status: pr?.status || 'NOT_STARTED',
      startedAt: pr?.startedAt || null,
      completedAt: pr?.completedAt || null,
      progressId: pr?.id || null,
    };
  });
}

export function formatMemberOverview(profile: any, campaigns: any[], progressRows: any[]) {
  const benefit = profile.benefitStatus;
  const activeInsurances = (profile.insurances || []).filter((i: any) => i.isActive);
  const accidentalPolicy = activeInsurances.find((i: any) => i.type === 'ACCIDENTAL');
  const healthPolicy = activeInsurances.find((i: any) => i.type === 'HEALTH');

  const insurance = {
    accidental: {
      status: buildInsuranceUiStatus('ACCIDENTAL', benefit),
      unlockedAt: benefit?.accidentalUnlockedAt || null,
      active: !!benefit?.accidentalInsuranceActive,
      policy: accidentalPolicy
        ? {
            id: accidentalPolicy.id,
            policyNumber: accidentalPolicy.policyNumber,
            insurer: accidentalPolicy.insurer,
            coverAmount: accidentalPolicy.coverAmount,
            validFrom: accidentalPolicy.validFrom,
            validTo: accidentalPolicy.validTo,
          }
        : null,
      nextStep:
        buildInsuranceUiStatus('ACCIDENTAL', benefit) === 'LOCKED_SURVEY_REQUIRED'
          ? 'COMPLETE_PARTY_SURVEY'
          : buildInsuranceUiStatus('ACCIDENTAL', benefit) === 'UNLOCKED_CAN_APPLY'
            ? 'SUPER_ADMIN_ASSIGN_ACCIDENTAL_POLICY'
            : null,
    },
    health: {
      status: buildInsuranceUiStatus('HEALTH', benefit),
      unlockedAt: benefit?.healthUnlockedAt || null,
      active: !!benefit?.healthInsuranceActive,
      policy: healthPolicy
        ? {
            id: healthPolicy.id,
            policyNumber: healthPolicy.policyNumber,
            insurer: healthPolicy.insurer,
            coverAmount: healthPolicy.coverAmount,
            validFrom: healthPolicy.validFrom,
            validTo: healthPolicy.validTo,
          }
        : null,
      nextStep:
        buildInsuranceUiStatus('HEALTH', benefit) === 'LOCKED_REQUIRES_ACCIDENTAL'
          ? 'ACTIVATE_ACCIDENTAL_FIRST'
          : buildInsuranceUiStatus('HEALTH', benefit) === 'LOCKED_SURVEY_REQUIRED'
            ? 'COMPLETE_HEALTH_SURVEY_OR_ADMIN_UNLOCK'
            : buildInsuranceUiStatus('HEALTH', benefit) === 'UNLOCKED_CAN_APPLY'
              ? 'SUPER_ADMIN_ASSIGN_HEALTH_POLICY'
              : null,
    },
  };

  const surveyCampaigns = buildSurveyCampaignsSummary(campaigns, progressRows);
  const surveyOverallStatus = buildSurveyOverallStatus(
    campaigns.map((c) => c.id),
    progressRows.map((pr: any) => ({ campaignId: pr.campaignId, status: pr.status })),
  );

  const approvalRow = formatMemberApprovalRow(profile);

  return {
    ...approvalRow,
    membershipStatus: profile.approved ? 'APPROVED' : 'PENDING',
    documents: buildDocumentsPayload(profile),
    documentsApprovalPending: ['photo', 'aadhaar', 'pan', 'workingIdCard'].filter((key) => {
      const d = buildDocumentsPayload(profile)[key as keyof ReturnType<typeof buildDocumentsPayload>];
      return d?.uploaded && d.status === 'PENDING';
    }),
    pressCard: profile.card
      ? {
          cardNumber: profile.card.cardNumber,
          status: profile.card.status,
          pdfUrl: profile.card.pdfUrl,
          expiryDate: profile.card.expiryDate,
        }
      : null,
    survey: {
      overallStatus: surveyOverallStatus,
      campaigns: surveyCampaigns,
      completedCount: surveyCampaigns.filter((c) => c.status === 'COMPLETED').length,
      totalCampaigns: surveyCampaigns.length,
    },
    insurance,
    membership: {
      firstMembershipFree: benefit?.firstMembershipWaived ?? true,
      feeWaived: benefit?.firstMembershipWaived ?? true,
    },
  };
}

export async function loadActiveCampaignsForUnion(unionName: string, state?: string | null) {
  const where: any = { unionName, isActive: true };
  if (state) where.OR = [{ state: null }, { state }];
  return p.unionMemberSurveyCampaign.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    select: {
      id: true,
      partyCode: true,
      displayName: true,
      requiredForInsuranceType: true,
      state: true,
    },
  });
}

export async function ensureBenefitStatus(profileId: string, unionName: string) {
  return p.unionMemberBenefitStatus.upsert({
    where: { profileId },
    create: {
      profileId,
      unionName,
      firstMembershipWaived: true,
      firstMembershipWaivedAt: new Date(),
    },
    update: { unionName },
  });
}

export const memberListInclude = {
  card: true,
  benefitStatus: true,
  insurances: { where: { isActive: true }, orderBy: { validTo: 'desc' as const } },
  surveyProgress: {
    include: {
      campaign: {
        select: { id: true, partyCode: true, displayName: true, requiredForInsuranceType: true },
      },
    },
  },
  user: {
    select: {
      id: true,
      mobileNumber: true,
      profile: { select: { fullName: true, profilePhotoUrl: true } },
    },
  },
};

export function matchesInsuranceFilter(
  status: InsuranceUiStatus | undefined,
  filter: string | null | undefined,
): boolean {
  if (!filter || filter === 'ALL') return true;
  return status === filter;
}

export function matchesSurveyFilter(
  overall: SurveyOverallStatus,
  filter: string | null | undefined,
): boolean {
  if (!filter || filter === 'ALL') return true;
  if (filter === 'PENDING') {
    return overall === 'NOT_STARTED' || overall === 'IN_PROGRESS' || overall === 'PARTIALLY_COMPLETE';
  }
  if (filter === 'COMPLETED') return overall === 'ALL_COMPLETED';
  if (filter === 'NOT_STARTED') return overall === 'NOT_STARTED' || overall === 'NO_CAMPAIGNS';
  if (filter === 'IN_PROGRESS') return overall === 'IN_PROGRESS' || overall === 'PARTIALLY_COMPLETE';
  return overall === filter;
}
