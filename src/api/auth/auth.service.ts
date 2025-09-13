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
  const user = await findUserByMobileNumber(loginDto.mobileNumber);
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
  const isMpinValid = await bcrypt.compare(loginDto.mpin, user.mpin);
  console.log("isMpinValid:", isMpinValid);
  if (!isMpinValid) {
    console.log("Invalid mpin for user:", user.id);
    return null; // Invalid credentials
  }

  const role = await prisma.role.findUnique({
    where: {
      id: user.roleId,
    },
  });
  console.log("User role:", role);

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

export const registerGuestUser = async (guestDto: GuestRegistrationDto) => {
    try {
    const language = await prisma.language.findUnique({
      where: { id: guestDto.languageId },
    });

    if (!language) {
      throw new HttpException(400, `Invalid languageId: '${guestDto.languageId}'.`);
        }

        const guestRole = await prisma.role.findUnique({ where: { name: 'GUEST' } });
        if (!guestRole) {
            throw new Error('Critical server error: GUEST role not found.');
        }

        let user;
        let effectiveRole;

        const device = await prisma.device.findFirst({
            where: { deviceId: guestDto.deviceDetails.deviceId },
            include: { user: { include: { role: true } } },
        });

        if (device) {
            if (device.user) {
                user = device.user;
                effectiveRole = device.user.role;

                if (!effectiveRole) {
                    console.error(`Data integrity issue: User ${user.id} has a missing role. Treating as GUEST.`);
                    effectiveRole = guestRole;
                }

                if (effectiveRole.name === 'GUEST') {
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { languageId: language.id },
                    });
                    await prisma.device.update({
                        where: { id: device.id },
                        data: { pushToken: guestDto.deviceDetails.pushToken },
                    });

                    // CRITICAL FIX: Replace `upsert` with a manual find/update/create logic
                    if (guestDto.deviceDetails.location) {
                        const existingLocation = await prisma.userLocation.findFirst({
                            where: { userId: user.id },
                        });

                        if (existingLocation) {
                            await prisma.userLocation.update({
                                where: { id: existingLocation.id },
                                data: { ...guestDto.deviceDetails.location },
                            });
                        } else {
                            await prisma.userLocation.create({
                                data: {
                                    userId: user.id,
                                    ...guestDto.deviceDetails.location,
                                },
                            });
                        }
                    }
                }
            } else {
                await prisma.device.delete({ where: { id: device.id } });
            }
        }

        if (!user) {
            user = await prisma.user.create({
                data: {
                    languageId: language.id,
                    roleId: guestRole.id,
                    status: 'ACTIVE',
                },
            });

            await prisma.device.create({
                data: {
                    userId: user.id,
                    deviceId: guestDto.deviceDetails.deviceId,
                    deviceModel: guestDto.deviceDetails.deviceModel,
                    pushToken: guestDto.deviceDetails.pushToken,
                },
            });

            if (guestDto.deviceDetails.location) {
                await prisma.userLocation.create({
                    data: {
                        userId: user.id,
                        ...guestDto.deviceDetails.location,
                    },
                });
            }
            effectiveRole = guestRole;
        }

        if (!user || !effectiveRole) {
            throw new Error('Internal logic error: User or role became undefined before token generation.');
        }

        const payload = {
            sub: user.id,
            role: effectiveRole.name,
            permissions: effectiveRole.permissions,
        };

    // Access token: 1 hour; Refresh token: 30 days
  const jwtToken = jwt.sign(payload, process.env.JWT_SECRET || 'your-default-secret', { expiresIn: '1d' });
    const refreshToken = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET || 'your-default-refresh-secret', { expiresIn: '30d' });

        return {
            jwt: jwtToken,
            refreshToken: refreshToken,
  expiresIn: 86400, // seconds (1 day)
            user: {
                userId: user.id,
                role: effectiveRole.name,
                languageId: user.languageId,
            },
        };
    } catch (error) {
        console.error("[FATAL] Unhandled error in registerGuestUser:", error);
        throw error;
    }
};
