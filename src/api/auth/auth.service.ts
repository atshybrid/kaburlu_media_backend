export const logout = async (refreshToken: string, deviceId: string, sessionId?: string) => {
  // Close the session if provided
  if (sessionId) {
    try {
      const session = await prisma.userLoginSession.findUnique({ where: { id: sessionId } });
      if (session && !session.logoutAt) {
        const logoutAt = new Date();
        const durationMinutes = Math.round((logoutAt.getTime() - session.loginAt.getTime()) / 60000);
        await prisma.userLoginSession.update({
          where: { id: sessionId },
          data: {
            logoutAt,
            durationMinutes,
          },
        });
      }
    } catch (e) {
      console.error('[Auth] Failed to close session on logout', sessionId, e);
    }
  }
  return true;
};

/** Update session's lastActivityAt (for heartbeat / activity tracking) */
export const updateSessionActivity = async (sessionId: string) => {
  try {
    await prisma.userLoginSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
    return true;
  } catch (e) {
    console.error('[Auth] Failed to update session activity', sessionId, e);
    return false;
  }
};

/** End a session (e.g., manual logout or session timeout) */
export const endSession = async (sessionId: string) => {
  try {
    const session = await prisma.userLoginSession.findUnique({ where: { id: sessionId } });
    if (session && !session.logoutAt) {
      const logoutAt = new Date();
      const durationMinutes = Math.round((logoutAt.getTime() - session.loginAt.getTime()) / 60000);
      await prisma.userLoginSession.update({
        where: { id: sessionId },
        data: { logoutAt, durationMinutes },
      });
      return { closed: true, durationMinutes };
    }
    return { closed: false, durationMinutes: session?.durationMinutes || null };
  } catch (e) {
    console.error('[Auth] Failed to end session', sessionId, e);
    return null;
  }
};

export const checkUserExists = async (mobile: string) => {
  const user = await prisma.user.findUnique({ where: { mobileNumber: mobile } });
  return !!user;
};

import { findUserByMobileNumber } from '../users/users.service';
import { MpinLoginDto } from './mpin-login.dto';
import { RefreshDto } from './refresh.dto';
import { GuestRegistrationDto } from './guest-registration.dto';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { getRazorpayClientForTenant, getRazorpayConfigForTenant } from '../reporterPayments/razorpay.service';

type TenantAdminLoginContext = {
  reporterId: string;
  tenantId: string;
  domainId?: string;
  tenant?: { id: string; name: string; slug: string; nativeName?: string | null };
  domain?: { id: string; domain: string; isPrimary: boolean; status: string };
  domainSettings?: { id: string; data: unknown; updatedAt: string };
  newspaperName?: string | null;
  language?: { code: string | null; name: string | null; script: string | null; region: string | null };
};

type ReporterLoginContext = {
  reporterId: string;
  tenantId: string;
  domainId?: string;
  tenant?: { id: string; name: string; slug: string; prgiStatus?: string | null; nativeName?: string | null };
  tenantEntity?: any;
  domain?: { id: string; domain: string; isPrimary: boolean; status: string; kind?: string | null; verifiedAt?: string | null };
  domainSettings?: { id: string; data: unknown; updatedAt: string };
  reporter?: any;
  payments?: any[];
  paymentSummary?: any;
  autoPublish: boolean;
  newspaperName?: string | null;
  language?: { code: string | null; name: string | null; script: string | null; region: string | null };
};

function getAutoPublishFromKycData(kycData: any): boolean {
  try {
    if (!kycData || typeof kycData !== 'object') return false;
    if ((kycData as any).autoPublish === true) return true;
    if ((kycData as any)?.settings?.autoPublish === true) return true;
    return false;
  } catch {
    return false;
  }
}

function sanitizeKycDataForClient(kycData: any): any {
  // Best practice: KYC payloads may contain document URLs/IDs; do not return full blob to app clients.
  // Keep only safe editorial settings needed by client, such as autoPublish.
  try {
    if (!kycData || typeof kycData !== 'object') return null;
    const autoPublish = getAutoPublishFromKycData(kycData);
    return { autoPublish };
  } catch {
    return null;
  }
}

export const getTenantAdminLoginContext = async (userId: string): Promise<TenantAdminLoginContext | null> => {
  const reporter = await prisma.reporter.findUnique({
    where: { userId },
    select: {
      id: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          entity: {
            select: {
              nativeName: true,
              language: { select: { code: true, name: true } },
              publicationState: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!reporter) return null;

  const domain = await prisma.domain.findFirst({
    where: { tenantId: reporter.tenantId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, domain: true, isPrimary: true, status: true },
  });

  const domainSettingsRow = domain
    ? await prisma.domainSettings
        .findUnique({ where: { domainId: domain.id }, select: { id: true, data: true, updatedAt: true } })
        .catch(() => null)
    : null;

  // Build tenant object with nativeName from entity
  const tenantEntity = (reporter.tenant as any)?.entity;
  const tenantWithNativeName = reporter.tenant ? {
    id: reporter.tenant.id,
    name: reporter.tenant.name,
    slug: reporter.tenant.slug,
    nativeName: tenantEntity?.nativeName || null,
  } : undefined;

  // Build newspaperName and language info
  const newspaperName = tenantEntity?.nativeName || reporter.tenant?.name || null;
  const languageInfo = {
    code: tenantEntity?.language?.code || null,
    name: tenantEntity?.language?.name || null,
    script: tenantEntity?.language?.name || null, // script defaults to language name
    region: tenantEntity?.publicationState?.name || null,
  };

  return {
    reporterId: reporter.id,
    tenantId: reporter.tenantId,
    domainId: domain?.id,
    tenant: tenantWithNativeName,
    domain: domain || undefined,
    domainSettings: domainSettingsRow
      ? { id: domainSettingsRow.id, data: domainSettingsRow.data as unknown, updatedAt: domainSettingsRow.updatedAt.toISOString() }
      : undefined,
    newspaperName,
    language: languageInfo,
  };
};

export const getReporterLoginContext = async (userId: string): Promise<ReporterLoginContext | null> => {
  const reporter = await prisma.reporter.findUnique({
    where: { userId },
    select: {
      id: true,
      tenantId: true,
      level: true,
      designation: { select: { id: true, code: true, name: true, level: true } },
      state: { select: { id: true, name: true } },
      district: { select: { id: true, name: true } },
      mandal: { select: { id: true, name: true } },
      assemblyConstituency: { select: { id: true, name: true } },
      subscriptionActive: true,
      monthlySubscriptionAmount: true,
      idCardCharge: true,
      kycStatus: true,
      kycData: true,
      profilePhotoUrl: true,
      manualLoginEnabled: true,
      manualLoginDays: true,
      manualLoginActivatedAt: true,
      manualLoginExpiresAt: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      idCard: { select: { id: true, cardNumber: true, issuedAt: true, expiresAt: true, pdfUrl: true } },
      user: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } },
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          prgiStatus: true,
          entity: {
            select: {
              id: true,
              tenantId: true,
              prgiNumber: true,
              registrationTitle: true,
              nativeName: true,
              periodicity: true,
              registrationDate: true,
              ownerName: true,
              publisherName: true,
              editorName: true,
              address: true,
              publicationCountryId: true,
              publicationStateId: true,
              publicationDistrictId: true,
              publicationMandalId: true,
              printingPressName: true,
              printingDistrictId: true,
              printingMandalId: true,
              printingCityName: true,
              createdAt: true,
              updatedAt: true,
              language: { select: { code: true, name: true } },
              publicationState: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!reporter) return null;

  const domain = await prisma.domain.findFirst({
    where: { tenantId: reporter.tenantId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, domain: true, isPrimary: true, status: true, kind: true, verifiedAt: true },
  });

  const domainSettingsRow = domain
    ? await prisma.domainSettings
        .findUnique({ where: { domainId: domain.id }, select: { id: true, data: true, updatedAt: true } })
        .catch(() => null)
    : null;

  const autoPublish = getAutoPublishFromKycData(reporter.kycData);
  const safeKycData = sanitizeKycDataForClient(reporter.kycData);

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  const currentMonthly = await prisma.reporterPayment
    .findUnique({
      where: {
        reporterId_type_year_month: {
          reporterId: reporter.id,
          type: 'MONTHLY_SUBSCRIPTION',
          year: currentYear,
          month: currentMonth,
        },
      },
      select: {
        id: true,
        type: true,
        year: true,
        month: true,
        amount: true,
        currency: true,
        status: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    .catch(() => null);

  const recentPayments = await prisma.reporterPayment
    .findMany({
      where: { reporterId: reporter.id },
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        type: true,
        year: true,
        month: true,
        amount: true,
        currency: true,
        status: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        expiresAt: true,
        createdAt: true,
      },
    })
    .catch(() => []);

  const reporterProfile = {
    id: reporter.id,
    tenantId: reporter.tenantId,
    level: reporter.level,
    designation: reporter.designation,
    state: reporter.state,
    district: reporter.district,
    mandal: reporter.mandal,
    assemblyConstituency: reporter.assemblyConstituency,
    subscriptionActive: reporter.subscriptionActive,
    monthlySubscriptionAmount: reporter.monthlySubscriptionAmount,
    idCardCharge: reporter.idCardCharge,
    kycStatus: reporter.kycStatus,
    kycData: safeKycData,
    profilePhotoUrl: reporter.profilePhotoUrl,
    manualLoginEnabled: reporter.manualLoginEnabled,
    manualLoginDays: reporter.manualLoginDays,
    manualLoginActivatedAt: reporter.manualLoginActivatedAt ? reporter.manualLoginActivatedAt.toISOString() : null,
    manualLoginExpiresAt: reporter.manualLoginExpiresAt ? reporter.manualLoginExpiresAt.toISOString() : null,
    active: reporter.active,
    idCard: reporter.idCard
      ? {
          ...reporter.idCard,
          issuedAt: reporter.idCard.issuedAt.toISOString(),
          expiresAt: reporter.idCard.expiresAt.toISOString(),
        }
      : null,
    contact: {
      userId: reporter.user?.id || null,
      mobileNumber: reporter.user?.mobileNumber || null,
      fullName: reporter.user?.profile?.fullName || null,
    },
    autoPublish,
    createdAt: reporter.createdAt.toISOString(),
    updatedAt: reporter.updatedAt.toISOString(),
  };

  const paymentSummary = {
    subscriptionActive: reporter.subscriptionActive,
    monthlySubscriptionAmount: reporter.monthlySubscriptionAmount || 0,
    currentMonth: { year: currentYear, month: currentMonth },
    currentMonthlyPayment: currentMonthly
      ? {
          ...currentMonthly,
          expiresAt: currentMonthly.expiresAt.toISOString(),
          createdAt: currentMonthly.createdAt.toISOString(),
          updatedAt: currentMonthly.updatedAt.toISOString(),
        }
      : null,
  };

  // Build newspaperName and language info for reporter
  const tenantEntity = reporter.tenant?.entity;
  const newspaperName = tenantEntity?.nativeName || reporter.tenant?.name || null;
  const languageInfo = {
    code: (tenantEntity as any)?.language?.code || null,
    name: (tenantEntity as any)?.language?.name || null,
    script: (tenantEntity as any)?.language?.name || null, // script defaults to language name
    region: (tenantEntity as any)?.publicationState?.name || null,
  };

  return {
    reporterId: reporter.id,
    tenantId: reporter.tenantId,
    domainId: domain?.id,
    tenant: reporter.tenant
      ? {
          id: reporter.tenant.id,
          name: reporter.tenant.name,
          slug: reporter.tenant.slug,
          prgiStatus: (reporter.tenant as any).prgiStatus ?? undefined,
          nativeName: reporter.tenant?.entity?.nativeName || null,
        }
      : undefined,
    tenantEntity: reporter.tenant?.entity || undefined,
    domain: domain
      ? {
          id: domain.id,
          domain: domain.domain,
          isPrimary: domain.isPrimary,
          status: domain.status,
          kind: (domain as any).kind ?? undefined,
          verifiedAt: domain.verifiedAt ? domain.verifiedAt.toISOString() : null,
        }
      : undefined,
    domainSettings: domainSettingsRow
      ? { id: domainSettingsRow.id, data: domainSettingsRow.data as unknown, updatedAt: domainSettingsRow.updatedAt.toISOString() }
      : undefined,
    reporter: reporterProfile,
    payments: (recentPayments || []).map((p) => ({
      ...p,
      expiresAt: p.expiresAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    paymentSummary,
    autoPublish,
    newspaperName,
    language: languageInfo,
  };
};

// A simple exception class for HTTP errors
class HttpException extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

function addUtcDays(now: Date, days: number) {
  const ms = now.getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

// This is a placeholder. In a real app, you would have a robust OTP system.
const validateOtp = async (mobileNumber: string, otp: string): Promise<boolean> => {
  console.log(`Validating OTP ${otp} for ${mobileNumber}`);
  return true;
};

export const login = async (loginDto: MpinLoginDto) => {
    console.log("loginDto", loginDto)
  console.log("Attempting to log in with mobile number:", loginDto.mobileNumber);
    let user: any = null;
    try {
      user = await findUserByMobileNumber(loginDto.mobileNumber);
    } catch (e: any) {
      console.error('[Auth] DB error while fetching user by mobile:', e?.message || e);
      // Signal a temporary service outage instead of throwing generic 500
      throw new HttpException(503, 'Authentication service temporarily unavailable');
    }
  if (!user) {
    console.log("User not found for mobile number:", loginDto.mobileNumber);
    return null; // User not found
  }
  console.log("User found:", user);

  // Securely compare the provided mpin with the hashed mpin from the database
  console.log("Provided mpin:", loginDto.mpin);
  console.log("Hashed mpin from DB:", user.mpin);
  if (!user.mpin) {
    return null;
  }
  // Support legacy plaintext MPINs by detecting non-bcrypt values, then migrate to hashed on-the-fly
  const isBcryptHash = typeof user.mpin === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.mpin);
  let isMpinValid = false;
  if (isBcryptHash) {
    try {
      isMpinValid = await bcrypt.compare(loginDto.mpin, user.mpin);
    } catch (e) {
      console.warn('[Auth] bcrypt.compare failed, treating as invalid MPIN for user', user.id, e instanceof Error ? e.message : e);
      isMpinValid = false;
    }
  } else {
    // Plaintext stored (legacy) – compare directly and upgrade to hashed if match
    if (loginDto.mpin === user.mpin) {
      isMpinValid = true;
      try {
        const hashed = await bcrypt.hash(loginDto.mpin, 10);
        await prisma.user.update({ where: { id: user.id }, data: { mpin: hashed } });
        console.log('[Auth] Migrated plaintext MPIN to bcrypt hash for user', user.id);
      } catch (e) {
        console.error('[Auth] Failed to migrate plaintext MPIN to hash for user', user.id, e);
      }
    } else {
      isMpinValid = false;
    }
  }
  console.log("isMpinValid:", isMpinValid);
  if (!isMpinValid) {
    console.log("Invalid mpin for user:", user.id);
    return null; // Invalid credentials
  }
  // Determine reporter payment gating BEFORE issuing tokens
  let role = await prisma.role.findUnique({ where: { id: user.roleId } });
  console.log("User role:", role);
  try {
    // Fetch reporter record linked to this user (if any)
      const reporter = await prisma.reporter.findUnique({ where: { userId: user.id }, include: { payments: true } });

    // Manual login access gating (tenant-admin managed)
    // Only applies when reporter.subscriptionActive=false and manualLoginEnabled=true.
    if (reporter && role?.name === 'REPORTER') {
      if (reporter.manualLoginEnabled && !reporter.subscriptionActive) {
        const now = new Date();
        const expiresAt = (reporter as any).manualLoginExpiresAt ? new Date((reporter as any).manualLoginExpiresAt as any) : null;
        if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
          throw new HttpException(403, 'Reporter login access expired. Please contact tenant admin to reactivate.');
        }
      }
    }

    if (reporter && role?.name !== 'SUPER_ADMIN') {
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1; // 1-12
      const outstanding: any[] = [];

      // Onboarding fee requirement
      if (typeof reporter.idCardCharge === 'number' && reporter.idCardCharge > 0) {
        const onboardingPaid = reporter.payments.find(p => p.type === 'ONBOARDING' && p.status === 'PAID');
        if (!onboardingPaid) {
          const existingOnboarding = reporter.payments.find(p => p.type === 'ONBOARDING');
          outstanding.push({
            type: 'ONBOARDING',
            amount: reporter.idCardCharge,
            currency: 'INR',
            status: existingOnboarding ? existingOnboarding.status : 'MISSING',
            paymentId: existingOnboarding?.id || null,
            razorpayOrderId: (existingOnboarding as any)?.razorpayOrderId || null,
            razorpayPaymentId: (existingOnboarding as any)?.razorpayPaymentId || null
          });
        }
      }

      // Monthly subscription requirement
      if (reporter.subscriptionActive && typeof reporter.monthlySubscriptionAmount === 'number' && reporter.monthlySubscriptionAmount > 0) {
        const monthlyPaid = reporter.payments.find(p => p.type === 'MONTHLY_SUBSCRIPTION' && p.year === currentYear && p.month === currentMonth && p.status === 'PAID');
        if (!monthlyPaid) {
          const existingMonthly = reporter.payments.find(p => p.type === 'MONTHLY_SUBSCRIPTION' && p.year === currentYear && p.month === currentMonth);
          outstanding.push({
            type: 'MONTHLY_SUBSCRIPTION',
            amount: reporter.monthlySubscriptionAmount,
            currency: 'INR',
            year: currentYear,
            month: currentMonth,
            status: existingMonthly ? existingMonthly.status : 'MISSING',
            paymentId: existingMonthly?.id || null,
            razorpayOrderId: (existingMonthly as any)?.razorpayOrderId || null,
            razorpayPaymentId: (existingMonthly as any)?.razorpayPaymentId || null
          });
        }
      }

      if (outstanding.length > 0) {
        console.log('[Auth] Payment gating triggered for reporter', reporter.id, 'Outstanding:', outstanding);
        
        // Fetch tenant branding for payment screen trust
        const [tenantWithBranding, tenantTheme, tenantEntity] = await Promise.all([
          prisma.tenant.findUnique({
            where: { id: reporter.tenantId },
            select: { id: true, name: true, slug: true }
          }),
          (prisma as any).tenantTheme?.findUnique?.({
            where: { tenantId: reporter.tenantId },
            select: { logoUrl: true, faviconUrl: true, primaryColor: true }
          }).catch(() => null),
          (prisma as any).tenantEntity?.findUnique?.({
            where: { tenantId: reporter.tenantId },
            select: { nativeName: true, registrationTitle: true, publisherName: true }
          }).catch(() => null),
        ]);
        
        // Auto-create Razorpay order for pending payments
        let razorpayOrder: any = null;
        let razorpayKeyId: string | null = null;
        let reporterPaymentId: string | null = null;
        
        try {
          // Calculate total outstanding amount (stored in RUPEES in DB)
          const totalAmountRupees = outstanding.reduce((sum, o) => sum + (o.amount || 0), 0);
          const totalAmountPaise = totalAmountRupees * 100; // Convert to paise for Razorpay
          
          if (totalAmountRupees > 0) {
            // Get Razorpay config
            const razorpayConfig = await getRazorpayConfigForTenant(reporter.tenantId);
            
            if (razorpayConfig?.keyId) {
              razorpayKeyId = razorpayConfig.keyId;
              
              // Check if there's already a PENDING payment record
              const existingPendingPayment = await (prisma as any).reporterPayment.findFirst({
                where: {
                  reporterId: reporter.id,
                  tenantId: reporter.tenantId,
                  status: 'PENDING',
                  expiresAt: { gt: new Date() }
                },
                orderBy: { createdAt: 'desc' }
              });
              
              if (existingPendingPayment?.razorpayOrderId) {
                // Reuse existing pending order
                razorpayOrder = { id: existingPendingPayment.razorpayOrderId };
                reporterPaymentId = existingPendingPayment.id;
                console.log('[Auth] Reusing existing Razorpay order:', razorpayOrder.id);
              } else {
                // Create new Razorpay order
                const razorpay = await getRazorpayClientForTenant(reporter.tenantId);
                const now = new Date();
                const year = now.getUTCFullYear();
                const month = now.getUTCMonth() + 1;
                
                const shortReporterId = reporter.id.slice(0, 12);
                let receipt = `REP-${shortReporterId}-${Date.now()}`;
                if (receipt.length > 40) receipt = receipt.slice(0, 40);
                
                // Determine payment type
                const hasOnboarding = outstanding.some(o => o.type === 'ONBOARDING');
                const paymentType = hasOnboarding ? 'ONBOARDING' : 'MONTHLY_SUBSCRIPTION';
                
                razorpayOrder = await (razorpay as any).orders.create({
                  amount: totalAmountPaise, // Razorpay expects amount in PAISE
                  currency: 'INR',
                  receipt,
                  notes: { tenantId: reporter.tenantId, reporterId: reporter.id, type: paymentType },
                });
                
                const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                
                const paymentRecord = await (prisma as any).reporterPayment.create({
                  data: {
                    reporterId: reporter.id,
                    tenantId: reporter.tenantId,
                    type: paymentType,
                    year,
                    month,
                    amount: totalAmountRupees, // Store in rupees for consistency
                    currency: 'INR',
                    status: 'PENDING',
                    razorpayOrderId: razorpayOrder.id,
                    meta: razorpayOrder,
                    expiresAt,
                  },
                });
                
                reporterPaymentId = paymentRecord.id;
                console.log('[Auth] Created Razorpay order:', razorpayOrder.id, 'for reporter:', reporter.id);
              }
            }
          }
        } catch (rpErr) {
          console.error('[Auth] Failed to create Razorpay order for payment gating:', rpErr);
          // Continue without Razorpay order - but still return keyId so mobile app can call /payments/order manually
        }
        
        // Calculate totals for breakdown
        // NOTE: Amounts in DB are stored in RUPEES, Razorpay expects PAISE (1 rupee = 100 paise)
        const idCardAmountRupees = outstanding.find(o => o.type === 'ONBOARDING')?.amount || 0;
        const subscriptionAmountRupees = outstanding.find(o => o.type === 'MONTHLY_SUBSCRIPTION')?.amount || 0;
        const totalAmountRupees = outstanding.reduce((sum, o) => sum + (o.amount || 0), 0);
        const totalAmountPaise = totalAmountRupees * 100; // Convert to paise for Razorpay
        
        return {
          paymentRequired: true,
          code: 'PAYMENT_REQUIRED',
          message: 'Reporter payments required before login',
          reporter: { id: reporter.id, tenantId: reporter.tenantId },
          // Tenant branding for payment screen trust
          tenant: {
            id: tenantWithBranding?.id || reporter.tenantId,
            name: tenantWithBranding?.name || null,
            slug: tenantWithBranding?.slug || null,
            nativeName: tenantEntity?.nativeName || null,
            registrationTitle: tenantEntity?.registrationTitle || null,
            publisherName: tenantEntity?.publisherName || null,
            logoUrl: tenantTheme?.logoUrl || null,
            faviconUrl: tenantTheme?.faviconUrl || null,
            primaryColor: tenantTheme?.primaryColor || null,
          },
          outstanding,
          // Breakdown for UI display (amounts in Rupees as stored in DB)
          breakdown: {
            idCardCharge: {
              label: 'ID Card / Onboarding Fee',
              amount: idCardAmountRupees,
              amountPaise: idCardAmountRupees * 100,
              displayAmount: `₹${idCardAmountRupees.toFixed(2)}`
            },
            monthlySubscription: {
              label: 'Monthly Subscription',
              amount: subscriptionAmountRupees,
              amountPaise: subscriptionAmountRupees * 100,
              displayAmount: `₹${subscriptionAmountRupees.toFixed(2)}`,
              year: outstanding.find(o => o.type === 'MONTHLY_SUBSCRIPTION')?.year,
              month: outstanding.find(o => o.type === 'MONTHLY_SUBSCRIPTION')?.month
            },
            total: {
              label: 'Total Amount',
              amount: totalAmountRupees,
              amountPaise: totalAmountPaise,
              displayAmount: `₹${totalAmountRupees.toFixed(2)}`
            }
          },
          // Include Razorpay details for mobile app to directly open payment UI
          // Always include keyId so frontend can create order via API if needed
          razorpay: {
            keyId: razorpayKeyId, // Always provide keyId for frontend
            orderId: razorpayOrder?.id || null,
            amount: totalAmountPaise, // Razorpay amount in PAISE
            amountRupees: totalAmountRupees,
            currency: 'INR',
            reporterPaymentId: reporterPaymentId || null,
            // If order creation failed, frontend should call POST /reporter-payments/order
            orderCreated: !!razorpayOrder
          }
        };
      }
    }
  } catch (e) {
    // IMPORTANT: don't swallow intentional HTTP blocks (e.g. manual login expired)
    const err: any = e as any;
    if (typeof err?.status === 'number') {
      throw e;
    }
    console.error('[Auth] Failed reporter payment gating check', e);
  }

  // Track login time and increment login count
  let sessionId: string | null = null;
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });
    
    // Create login session for working hours tracking
    const session = await prisma.userLoginSession.create({
      data: {
        userId: user.id,
        loginAt: new Date(),
        lastActivityAt: new Date(),
        deviceInfo: loginDto.deviceInfo || null,
        ipAddress: loginDto.ipAddress || null,
      },
    });
    sessionId = session.id;
  } catch (e) {
    console.error('[Auth] Failed to update lastLoginAt for user', user.id, e);
  }

  const payload = {
    sub: user.id,
    role: role?.name,
    permissions: role?.permissions,
    sessionId: sessionId, // for session tracking
  };

  // Access token: 1 hour; Refresh token: 30 days
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'your-default-secret', { expiresIn: '1d' });
  const refreshToken = jwt.sign({ sub: user.id, sessionId }, process.env.JWT_REFRESH_SECRET || 'your-default-refresh-secret', { expiresIn: '30d' });

  const result =  {
    jwt: accessToken,
    refreshToken: refreshToken,
  expiresIn: 86400, // seconds (1 day)
    sessionId: sessionId, // expose session for logout
    user: {
      userId: user.id,
      role: role?.name,
      languageId: user.languageId,
    },
  };

  // Tenant Admin login response should include tenant + domain context.
  if (role?.name === 'TENANT_ADMIN') {
    try {
      const ctx = await getTenantAdminLoginContext(user.id);
      if (ctx) {
        (result as any).reporterId = ctx.reporterId;
        (result as any).tenantId = ctx.tenantId;
        (result as any).domainId = ctx.domainId;
        (result as any).tenant = ctx.tenant;
        (result as any).domain = ctx.domain;
        (result as any).domainSettings = ctx.domainSettings;
        (result as any).newspaperName = ctx.newspaperName;
        (result as any).language = ctx.language;
      }
    } catch (e) {
      console.warn('[Auth] Failed to attach tenant admin context for user', user.id, e);
    }
  }

  // Reporter login response should include tenant + domain + full reporter profile context.
  if (role?.name === 'REPORTER') {
    try {
      const ctx = await getReporterLoginContext(user.id);
      if (ctx) {
        (result as any).tenantId = ctx.tenantId;
        (result as any).domainId = ctx.domainId;
        (result as any).tenant = ctx.tenant;
        (result as any).tenantEntity = ctx.tenantEntity;
        (result as any).domain = ctx.domain;
        (result as any).domainSettings = ctx.domainSettings;
        (result as any).reporter = ctx.reporter;
        (result as any).reporterPayments = ctx.payments;
        (result as any).reporterPaymentSummary = ctx.paymentSummary;
        (result as any).autoPublish = ctx.autoPublish;
        (result as any).newspaperName = ctx.newspaperName;
        (result as any).language = ctx.language;
      }
    } catch (e) {
      console.warn('[Auth] Failed to attach reporter context for user', user.id, e);
    }
  }
  // Attach last known user location if available
  try {
    const loc = await prisma.userLocation.findUnique({ where: { userId: user.id } });
    if (loc) {
      (result as any).location = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracyMeters: (loc as any).accuracyMeters ?? undefined,
        provider: (loc as any).provider ?? undefined,
        timestampUtc: (loc as any).timestampUtc ? new Date((loc as any).timestampUtc as any).toISOString() : undefined,
        placeId: (loc as any).placeId ?? undefined,
        placeName: (loc as any).placeName ?? undefined,
        address: (loc as any).address ?? undefined,
        source: (loc as any).source ?? undefined,
      };
    }
  } catch {}
  console.log("result", result)
  return result
};

export const refresh = async (refreshDto: RefreshDto) => {
  try {
    const decoded = jwt.verify(refreshDto.refreshToken, process.env.JWT_REFRESH_SECRET || 'your-default-refresh-secret') as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });

    if (!user) {
      return null;
    }

    const role = await prisma.role.findUnique({
      where: {
        id: user.roleId,
      },
    });

    // Manual login access gating (tenant-admin managed)
    // Best-practice: refresh token must NOT bypass manual expiry.
    if (role?.name === 'REPORTER') {
      const reporter = await prisma.reporter
        .findUnique({
          where: { userId: user.id },
          select: { subscriptionActive: true, manualLoginEnabled: true, manualLoginExpiresAt: true },
        })
        .catch(() => null);

      if (reporter && reporter.manualLoginEnabled && !reporter.subscriptionActive) {
        const now = new Date();
        const expiresAt = reporter.manualLoginExpiresAt ? new Date(reporter.manualLoginExpiresAt as any) : null;
        if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
          throw new HttpException(403, 'Reporter login access expired. Please contact tenant admin to reactivate.');
        }
      }
    }

    const payload = {
      sub: user.id,
      role: role?.name,
      permissions: role?.permissions,
    };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'your-default-secret', { expiresIn: '1d' });

    return {
      jwt: accessToken,
  expiresIn: 86400, // seconds (1 day)
    };
  } catch (error) {
    const err: any = error as any;
    if (typeof err?.status === 'number') {
      throw error;
    }
    return null;
  }
};

export const registerGuestUser = async (guestDto: GuestRegistrationDto, existingAnonId?: string) => {
  try {
    // Accept either a language DB id OR a language code (e.g., 'en', 'te').
    // Backward-compat: some clients send languageCode in languageId field.
    const languageKey = (guestDto.languageId || guestDto.languageCode || '').trim();
    if (!languageKey) throw new HttpException(400, 'languageId or languageCode is required.');
    const language = await prisma.language.findFirst({
      where: {
        OR: [{ id: languageKey }, { code: languageKey }],
      },
    });
    if (!language) throw new HttpException(400, `Invalid languageId/languageCode: '${languageKey}'.`);
    const guestRole = await prisma.role.findUnique({ where: { name: 'GUEST' } });
    if (!guestRole) throw new Error('Critical server error: GUEST role not found.');

    // Find device precedence: explicit anonId header -> fallback to provided deviceId
    let device = null as any;
    if (existingAnonId) {
      device = await prisma.device.findUnique({ where: { id: existingAnonId } });
    }
    if (!device) {
      device = await prisma.device.findUnique({ where: { deviceId: guestDto.deviceDetails.deviceId } });
    }
    let linkedUser: any = null;
    if (device?.userId) {
      linkedUser = await prisma.user.findUnique({ where: { id: device.userId }, include: { role: true } });
    }

    // If device linked to a user already => return user token (upgraded flow)
    if (linkedUser) {
      const user = linkedUser;
      const role = user.role;
      const payload = { sub: user.id, subType: 'user', role: role?.name, permissions: role?.permissions };
      const jwtToken = jwt.sign(payload, process.env.JWT_SECRET || 'your-default-secret', { expiresIn: '1d' });
      const refreshToken = jwt.sign({ sub: user.id, subType: 'user' }, process.env.JWT_REFRESH_SECRET || 'your-default-refresh-secret', { expiresIn: '30d' });
  return { jwt: jwtToken, refreshToken, expiresIn: 86400, anonId: device.id, user: { userId: user.id, role: role?.name, languageId: user.languageId } };
    }

    // Create or update a pure guest device (no user row)
    if (!device) {
      device = await prisma.device.create({
        data: {
          deviceId: guestDto.deviceDetails.deviceId,
          deviceModel: guestDto.deviceDetails.deviceModel,
          pushToken: guestDto.deviceDetails.pushToken,
          latitude: guestDto.deviceDetails.location?.latitude,
          longitude: guestDto.deviceDetails.location?.longitude,
          accuracyMeters: guestDto.deviceDetails.location?.accuracyMeters as any,
          placeId: guestDto.deviceDetails.location?.placeId,
          placeName: guestDto.deviceDetails.location?.placeName,
          address: guestDto.deviceDetails.location?.address,
          source: guestDto.deviceDetails.location?.source,
        } as any,
      });
    } else {
      device = await prisma.device.update({
        where: { id: device.id },
        data: {
          pushToken: guestDto.deviceDetails.pushToken,
          latitude: guestDto.deviceDetails.location?.latitude,
          longitude: guestDto.deviceDetails.location?.longitude,
          accuracyMeters: guestDto.deviceDetails.location?.accuracyMeters as any,
          placeId: guestDto.deviceDetails.location?.placeId,
          placeName: guestDto.deviceDetails.location?.placeName,
          address: guestDto.deviceDetails.location?.address,
          source: guestDto.deviceDetails.location?.source,
        } as any,
      });
    }

    // Device principals don't have roleId in DB; role is implied as GUEST
    const payload = {
      sub: device.id,
      subType: 'device',
      role: guestRole.name,
      permissions: guestRole.permissions,
      languageId: language.id,
      languageCode: language.code,
    };
    const jwtToken = jwt.sign(payload, process.env.JWT_SECRET || 'your-default-secret', { expiresIn: '1d' });
    const refreshToken = jwt.sign({ sub: device.id, subType: 'device' }, process.env.JWT_REFRESH_SECRET || 'your-default-refresh-secret', { expiresIn: '30d' });

    return {
      jwt: jwtToken,
      refreshToken,
      expiresIn: 86400,
      anonId: device.id,
      device: {
        deviceId: device.deviceId,
        role: guestRole.name,
        languageId: language.id,
        languageCode: language.code,
      }
    };
  } catch (error) {
    console.error('[FATAL] Unhandled error in registerGuestUser:', error);
    throw error;
  }
};

/**
 * Verify MPIN without full login - returns user/reporter info + payment status.
 * Used for payment flow where we need to verify identity before payment.
 */
export const verifyMpinForPayment = async (mobileNumber: string, mpin: string) => {
  const user = await findUserByMobileNumber(mobileNumber);
  if (!user || !user.mpin) {
    return { verified: false, message: 'User not found or MPIN not set' };
  }

  // Check MPIN
  const isBcryptHash = typeof user.mpin === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.mpin);
  let isMpinValid = false;
  
  if (isBcryptHash) {
    try {
      isMpinValid = await bcrypt.compare(mpin, user.mpin);
    } catch (e) {
      isMpinValid = false;
    }
  } else {
    isMpinValid = mpin === user.mpin;
  }

  if (!isMpinValid) {
    return { verified: false, message: 'Invalid MPIN' };
  }

  // Get reporter info if exists
  const reporter = await prisma.reporter.findUnique({
    where: { userId: user.id },
    include: { payments: true },
  });

  if (!reporter) {
    return { verified: true, isReporter: false, userId: user.id };
  }

  // Cast to include all fields
  const reporterData = reporter as any;

  // Get tenant branding
  const [tenantWithBranding, tenantTheme, tenantEntity] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: reporter.tenantId },
      select: { id: true, name: true, slug: true }
    }),
    (prisma as any).tenantTheme?.findUnique?.({
      where: { tenantId: reporter.tenantId },
      select: { logoUrl: true, faviconUrl: true, primaryColor: true }
    }).catch(() => null),
    (prisma as any).tenantEntity?.findUnique?.({
      where: { tenantId: reporter.tenantId },
      select: { nativeName: true, registrationTitle: true, publisherName: true }
    }).catch(() => null),
  ]);

  // Check outstanding payments
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const outstanding: any[] = [];

  if (typeof reporter.idCardCharge === 'number' && reporter.idCardCharge > 0) {
    const onboardingPaid = reporter.payments.find(p => p.type === 'ONBOARDING' && p.status === 'PAID');
    if (!onboardingPaid) {
      const existingOnboarding = reporter.payments.find(p => p.type === 'ONBOARDING');
      outstanding.push({
        type: 'ONBOARDING',
        amount: reporter.idCardCharge,
        currency: 'INR',
        status: existingOnboarding ? existingOnboarding.status : 'MISSING',
        paymentId: existingOnboarding?.id || null,
      });
    }
  }

  if (reporter.subscriptionActive && typeof reporter.monthlySubscriptionAmount === 'number' && reporter.monthlySubscriptionAmount > 0) {
    const monthlyPaid = reporter.payments.find(p => p.type === 'MONTHLY_SUBSCRIPTION' && p.year === currentYear && p.month === currentMonth && p.status === 'PAID');
    if (!monthlyPaid) {
      const existingMonthly = reporter.payments.find(p => p.type === 'MONTHLY_SUBSCRIPTION' && p.year === currentYear && p.month === currentMonth);
      outstanding.push({
        type: 'MONTHLY_SUBSCRIPTION',
        amount: reporter.monthlySubscriptionAmount,
        currency: 'INR',
        year: currentYear,
        month: currentMonth,
        status: existingMonthly ? existingMonthly.status : 'MISSING',
        paymentId: existingMonthly?.id || null,
      });
    }
  }

  const hasOutstandingPayments = outstanding.length > 0;
  const totalAmountRupees = outstanding.reduce((sum, o) => sum + (o.amount || 0), 0);

  // Get Razorpay config
  let razorpayKeyId: string | null = null;
  try {
    const razorpayConfig = await getRazorpayConfigForTenant(reporter.tenantId);
    razorpayKeyId = razorpayConfig?.keyId || null;
  } catch (e) {
    console.error('[Auth] Failed to get Razorpay config:', e);
  }

  return {
    verified: true,
    isReporter: true,
    userId: user.id,
    reporter: {
      id: reporterData.id,
      tenantId: reporterData.tenantId,
      name: reporterData.name,
      mobileNumber: reporterData.mobileNumber,
    },
    tenant: {
      id: tenantWithBranding?.id || reporterData.tenantId,
      name: tenantWithBranding?.name || null,
      slug: tenantWithBranding?.slug || null,
      nativeName: tenantEntity?.nativeName || null,
      logoUrl: tenantTheme?.logoUrl || null,
      faviconUrl: tenantTheme?.faviconUrl || null,
      primaryColor: tenantTheme?.primaryColor || null,
    },
    paymentRequired: hasOutstandingPayments,
    outstanding,
    breakdown: hasOutstandingPayments ? {
      idCardCharge: {
        label: 'ID Card / Onboarding Fee',
        amount: outstanding.find(o => o.type === 'ONBOARDING')?.amount || 0,
        displayAmount: `₹${(outstanding.find(o => o.type === 'ONBOARDING')?.amount || 0).toFixed(2)}`
      },
      monthlySubscription: {
        label: 'Monthly Subscription',
        amount: outstanding.find(o => o.type === 'MONTHLY_SUBSCRIPTION')?.amount || 0,
        displayAmount: `₹${(outstanding.find(o => o.type === 'MONTHLY_SUBSCRIPTION')?.amount || 0).toFixed(2)}`,
        year: outstanding.find(o => o.type === 'MONTHLY_SUBSCRIPTION')?.year,
        month: outstanding.find(o => o.type === 'MONTHLY_SUBSCRIPTION')?.month
      },
      total: {
        label: 'Total Amount',
        amount: totalAmountRupees,
        amountPaise: totalAmountRupees * 100,
        displayAmount: `₹${totalAmountRupees.toFixed(2)}`
      }
    } : null,
    razorpay: hasOutstandingPayments ? {
      keyId: razorpayKeyId,
      amount: totalAmountRupees * 100,
      amountRupees: totalAmountRupees,
      currency: 'INR',
    } : null
  };
};

/**
 * Change MPIN using old MPIN for authentication.
 */
export const changeMpinWithOldMpin = async (mobileNumber: string, oldMpin: string, newMpin: string) => {
  const user = await findUserByMobileNumber(mobileNumber);
  if (!user || !user.mpin) {
    return { success: false, message: 'User not found or MPIN not set' };
  }

  // Verify old MPIN
  const isBcryptHash = typeof user.mpin === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.mpin);
  let isOldMpinValid = false;
  
  if (isBcryptHash) {
    try {
      isOldMpinValid = await bcrypt.compare(oldMpin, user.mpin);
    } catch (e) {
      isOldMpinValid = false;
    }
  } else {
    isOldMpinValid = oldMpin === user.mpin;
  }

  if (!isOldMpinValid) {
    return { success: false, message: 'Old MPIN is incorrect' };
  }

  // Validate new MPIN format (4-6 digits)
  if (!/^\d{4,6}$/.test(newMpin)) {
    return { success: false, message: 'New MPIN must be 4-6 digits' };
  }

  // Check if new MPIN is same as old
  if (oldMpin === newMpin) {
    return { success: false, message: 'New MPIN cannot be same as old MPIN' };
  }

  // Hash and save new MPIN
  const hashedNewMpin = await bcrypt.hash(newMpin, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { mpin: hashedNewMpin }
  });

  console.log('[Auth] MPIN changed successfully for user:', user.id);
  return { success: true, message: 'MPIN changed successfully' };
};
