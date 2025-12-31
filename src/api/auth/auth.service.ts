export const logout = async (refreshToken: string, deviceId: string) => {
  // TODO: Implement token invalidation and device/session tracking if needed
  // For now, just scaffold (no-op)
  return true;
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

// A simple exception class for HTTP errors
class HttpException extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
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
        return {
          paymentRequired: true,
          code: 'PAYMENT_REQUIRED',
            message: 'Reporter payments required before login',
          reporter: { id: reporter.id, tenantId: reporter.tenantId },
          outstanding
        };
      }
    }
  } catch (e) {
    console.error('[Auth] Failed reporter payment gating check', e);
  }

  const payload = {
    sub: user.id,
    role: role?.name,
    permissions: role?.permissions,
  };

  // Access token: 1 hour; Refresh token: 30 days
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'your-default-secret', { expiresIn: '1d' });
  const refreshToken = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET || 'your-default-refresh-secret', { expiresIn: '30d' });

  const result =  {
    jwt: accessToken,
    refreshToken: refreshToken,
  expiresIn: 86400, // seconds (1 day)
    user: {
      userId: user.id,
      role: role?.name,
      languageId: user.languageId,
    },
  };
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
