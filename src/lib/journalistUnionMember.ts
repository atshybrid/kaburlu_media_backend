/**
 * Journalist Union — member create/join, document approval, ID card eligibility.
 */
import * as bcrypt from 'bcrypt';
import sharp from 'sharp';
import prisma from './prisma';
import { putPublicObject } from './objectStorage';
import { bunnyStoragePutObject, isBunnyStorageConfigured } from './bunnyStorage';
import { generateAndUploadPressCardPdf } from './journalistPressCardPdf';
import { sendWhatsappIdCardTemplate } from './whatsapp';

const p: any = prisma;

export type JournalistMemberTypeValue = 'TENANT_REPORTER' | 'NON_TENANT_REPORTER';
export type DocKey = 'photo' | 'aadhaar' | 'pan' | 'workingIdCard';

const DOC_FIELD_MAP: Record<DocKey, { url: string; status: string; approvedAt: string }> = {
  photo: { url: 'photoUrl', status: 'photoApprovalStatus', approvedAt: 'photoApprovedAt' },
  aadhaar: { url: 'aadhaarUrl', status: 'aadhaarApprovalStatus', approvedAt: 'aadhaarApprovedAt' },
  pan: { url: 'panCardUrl', status: 'panApprovalStatus', approvedAt: 'panApprovedAt' },
  workingIdCard: { url: 'workingIdCardUrl', status: 'workingIdCardApprovalStatus', approvedAt: 'workingIdCardApprovedAt' },
};

export function cleanText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
}

export function maskAadhaarLast4(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const digits = v.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

/** Row for super-admin approval UI (membership + all document URLs). */
export function formatMemberApprovalRow(profile: any) {
  const documents = buildDocumentsPayload(profile);
  const pendingActions: string[] = [];
  if (!profile.approved) pendingActions.push('MEMBERSHIP');
  for (const key of ['photo', 'aadhaar', 'pan', 'workingIdCard'] as DocKey[]) {
    const d = documents[key];
    if (d.uploaded && d.status === 'PENDING') pendingActions.push(key);
    if (d.uploaded && d.status === 'REJECTED') pendingActions.push(`${key}_REJECTED`);
  }

  const user = profile.user;
  const userProfile = user?.profile;

  return {
    id: profile.id,
    userId: profile.userId,
    memberType: profile.memberType,
    membershipStatus: profile.approved ? 'APPROVED' : 'PENDING',
    approved: profile.approved,
    rejectedAt: profile.rejectedAt ? new Date(profile.rejectedAt).toISOString() : null,
    pressId: profile.pressId,
    fullName: userProfile?.fullName || null,
    fatherName: profile.fatherName,
    mobileNumber: user?.mobileNumber || null,
    publisherMobileNumber: profile.publisherMobileNumber,
    unionName: profile.unionName,
    state: profile.state,
    district: profile.district,
    mandal: profile.mandal,
    workingArea: profile.workingArea,
    currentNewspaper: profile.currentNewspaper,
    currentDesignation: profile.currentDesignation,
    designation: profile.designation,
    organization: profile.organization,
    totalExperienceYears: profile.totalExperienceYears,
    linkedTenantId: profile.linkedTenantId,
    linkedTenantName: profile.linkedTenantName,
    documents,
    aadhaarBackUrl: profile.aadhaarBackUrl || null,
    unionPressCard: profile.card
      ? {
          cardNumber: profile.card.cardNumber,
          status: profile.card.status,
          pdfUrl: profile.card.pdfUrl,
          expiryDate: profile.card.expiryDate
            ? new Date(profile.card.expiryDate).toISOString()
            : null,
        }
      : null,
    pendingActions,
    canDownloadIdCard: canDownloadUnionIdCard(profile, profile.card || null).allowed,
    createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : null,
    updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : null,
  };
}

export function buildDocumentsPayload(profile: any) {
  const doc = (key: DocKey) => {
    const m = DOC_FIELD_MAP[key];
    const url = profile[m.url] as string | null;
    const status = profile[m.status] as string;
    return {
      url,
      status,
      approvedAt: profile[m.approvedAt] ? new Date(profile[m.approvedAt]).toISOString() : null,
      uploaded: !!url,
    };
  };
  return {
    photo: doc('photo'),
    aadhaar: doc('aadhaar'),
    pan: doc('pan'),
    workingIdCard: doc('workingIdCard'),
  };
}

/** Required documents must be uploaded + APPROVED before union press ID download. */
export function canDownloadUnionIdCard(profile: any, card: any | null): { allowed: boolean; reason?: string } {
  if (!profile) return { allowed: false, reason: 'NO_PROFILE' };
  if (!profile.approved) return { allowed: false, reason: 'MEMBERSHIP_PENDING' };
  if (!card?.pdfUrl && !card?.cardNumber) return { allowed: false, reason: 'NO_CARD' };

  const docs = buildDocumentsPayload(profile);
  const memberType = profile.memberType as JournalistMemberTypeValue | null;

  const need = (key: DocKey) => {
    const d = docs[key];
    if (!d.uploaded) return `${key}_MISSING`;
    if (d.status !== 'APPROVED') return `${key}_NOT_APPROVED`;
    return null;
  };

  if (memberType === 'TENANT_REPORTER') {
    for (const k of ['photo', 'aadhaar', 'pan'] as DocKey[]) {
      const err = need(k);
      if (err) return { allowed: false, reason: err };
    }
    return { allowed: true };
  }

  if (memberType === 'NON_TENANT_REPORTER') {
    for (const k of ['photo', 'aadhaar', 'pan', 'workingIdCard'] as DocKey[]) {
      const err = need(k);
      if (err) return { allowed: false, reason: err };
    }
    return { allowed: true };
  }

  // Legacy profiles without memberType: require KYC verified
  if (profile.kycVerified) return { allowed: true };
  return { allowed: false, reason: 'DOCUMENTS_NOT_APPROVED' };
}

export function buildUnionMemberLoginContext(profile: any, card: any | null) {
  const documents = buildDocumentsPayload(profile);
  const download = canDownloadUnionIdCard(profile, card);
  return {
    profileId: profile.id,
    memberType: profile.memberType,
    unionName: profile.unionName,
    membershipStatus: profile.approved ? 'APPROVED' : 'PENDING',
    approved: profile.approved,
    pressId: profile.pressId,
    publisherMobileNumber: profile.publisherMobileNumber,
    documents,
    canDownloadIdCard: download.allowed,
    idCardDownloadBlockedReason: download.allowed ? null : download.reason,
    unionPressCard: card
      ? {
          cardNumber: card.cardNumber,
          status: card.status,
          pdfUrl: download.allowed ? card.pdfUrl : null,
          expiryDate: card.expiryDate,
        }
      : null,
  };
}

async function uploadKycFile(
  profileId: string,
  subpath: string,
  file: Express.Multer.File,
  asWebp = true,
): Promise<string> {
  const buffer = asWebp ? await sharp(file.buffer).webp({ quality: 85 }).toBuffer() : file.buffer;
  const ext = asWebp ? 'webp' : (file.mimetype === 'application/pdf' ? 'pdf' : 'jpg');
  const contentType = asWebp ? 'image/webp' : file.mimetype;
  const key = `journalist-union/kyc/${profileId}/${subpath}.${ext}`;
  if (isBunnyStorageConfigured()) {
    const r = await bunnyStoragePutObject({ key, body: buffer, contentType });
    return r.publicUrl;
  }
  const r = await putPublicObject({ key, body: buffer, contentType });
  return r.publicUrl;
}

export async function applyDocumentUpload(
  profileId: string,
  doc: DocKey,
  file: Express.Multer.File,
  options?: { autoApprove?: boolean },
) {
  const subpaths: Record<DocKey, string> = {
    photo: 'photo',
    aadhaar: 'aadhaar',
    pan: 'pan',
    workingIdCard: 'working-id-card',
  };
  const asWebp = doc !== 'pan' && file.mimetype !== 'application/pdf';
  const url = await uploadKycFile(profileId, subpaths[doc], file, asWebp);
  const m = DOC_FIELD_MAP[doc];
  const status = options?.autoApprove ? 'APPROVED' : 'PENDING';
  const data: any = {
    [m.url]: url,
    [m.status]: status,
    [m.approvedAt]: options?.autoApprove ? new Date() : null,
  };
  return p.journalistProfile.update({ where: { id: profileId }, data });
}

export async function setDocumentApproval(profileId: string, doc: DocKey, action: 'approve' | 'reject') {
  const m = DOC_FIELD_MAP[doc];
  const profile = await p.journalistProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error('Profile not found');
  if (!profile[m.url]) throw new Error(`${doc} not uploaded`);

  const data: any = {
    [m.status]: action === 'approve' ? 'APPROVED' : 'REJECTED',
    [m.approvedAt]: action === 'approve' ? new Date() : null,
  };
  return p.journalistProfile.update({ where: { id: profileId }, data });
}

export async function ensureNonTenantReporterRole() {
  let role = await p.role.findUnique({ where: { name: 'NON_TENANT_REPORTER' } });
  if (!role) {
    role = await p.role.create({
      data: {
        name: 'NON_TENANT_REPORTER',
        permissions: { journalistUnion: ['member'], shortNews: ['create', 'edit_own'] },
      },
    });
  }
  return role;
}

export async function ensureUserWithMpin(
  mobileNumber: string,
  mpin: string,
  roleId: string,
  languageId: string,
  options?: { forceRole?: boolean },
) {
  let user = await p.user.findUnique({ where: { mobileNumber } });
  if (!user) {
    const hashedMpin = await bcrypt.hash(mpin, 10);
    user = await p.user.create({
      data: {
        mobileNumber,
        mpin: hashedMpin,
        roleId,
        languageId,
        status: 'PENDING',
      },
    });
    return user;
  }
  if (options?.forceRole && user.roleId !== roleId) {
    user = await p.user.update({
      where: { id: user.id },
      data: { roleId },
    });
  }
  return user;
}

export async function ensureCardAndNotify(
  profileId: string,
  mobileNumber: string | null,
  orgName: string | null,
  pressId: string | null,
  options?: { onlyIfPhoto?: boolean },
) {
  const profile = await p.journalistProfile.findUnique({
    where: { id: profileId },
    select: { photoUrl: true },
  });
  if (options?.onlyIfPhoto && !profile?.photoUrl) {
    return { card: null, pdfResult: null, whatsappSent: false, skipped: true };
  }

  const existingCard = await p.journalistCard.findUnique({ where: { profileId } });
  if (!existingCard) {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    await p.journalistCard.create({
      data: {
        profileId,
        cardNumber: `JU-${Date.now()}`,
        expiryDate: expiry,
        status: 'ACTIVE',
      },
    });
  }

  const pdfResult = await generateAndUploadPressCardPdf(profileId);
  let whatsappSent = false;
  if (pdfResult.ok && pdfResult.pdfUrl && mobileNumber) {
    await sendWhatsappIdCardTemplate({
      toMobileNumber: mobileNumber,
      pdfUrl: pdfResult.pdfUrl,
      cardType: 'Journalist Press ID',
      organizationName: orgName || 'Journalist Union',
      documentType: 'Press ID Card',
      pdfFilename: `Press_ID_${pressId || pdfResult.cardNumber || profileId}.pdf`,
    });
    whatsappSent = true;
  }
  const card = await p.journalistCard.findUnique({ where: { profileId } });
  return { card, pdfResult, whatsappSent, skipped: false };
}

export async function loadUserForMemberCreate(mobileNumber: string) {
  return p.user.findUnique({
    where: { mobileNumber },
    include: {
      role: { select: { name: true } },
      profile: { select: { fullName: true, profilePhotoUrl: true } },
      reporterProfile: {
        include: {
          tenant: { select: { id: true, name: true } },
          state: { select: { name: true } },
          district: { select: { name: true } },
          mandal: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
      journalistProfile: true,
    },
  });
}

export async function resolveAdminTenantScope(userId: string, roleName: string) {
  if (roleName === 'SUPER_ADMIN') return { isSuperAdmin: true, tenantId: null as string | null };
  if (roleName === 'TENANT_ADMIN') {
    const reporter = await p.reporter.findUnique({
      where: { userId },
      select: { tenantId: true },
    });
    if (!reporter?.tenantId) throw new Error('TENANT_ADMIN has no tenant linkage');
    return { isSuperAdmin: false, tenantId: reporter.tenantId as string };
  }
  throw new Error('Forbidden');
}

export async function attachUnionMemberToLogin(result: any, userId: string) {
  const profile = await p.journalistProfile.findUnique({
    where: { userId },
    include: { card: true },
  });
  if (!profile) return result;
  (result as any).unionMember = buildUnionMemberLoginContext(profile, profile.card);
  return result;
}
