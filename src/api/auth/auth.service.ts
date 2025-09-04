
import { findUserByMobileNumber } from '../users/users.service';
import { MpinLoginDto } from './mpin-login.dto';
import { RefreshDto } from './refresh.dto'; 
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';

// This is a placeholder. In a real app, you would have a robust OTP system.
const validateOtp = async (mobileNumber: string, otp: string): Promise<boolean> => {
  console.log(`Validating OTP ${otp} for ${mobileNumber}`);
  return true;
};

export const login = async (loginDto: MpinLoginDto) => {
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

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'your-default-secret', { expiresIn: '1h' });
  const refreshToken = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET || 'your-default-refresh-secret', { expiresIn: '7d' });

  return {
    jwt: accessToken,
    refreshToken: refreshToken,
    user: {
      userId: user.id,
      role: role?.name,
      languageId: user.languageId,
    },
  };
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

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'your-default-secret', { expiresIn: '1h' });

    return {
      jwt: accessToken,
    };
  } catch (error) {
    return null;
  }
};
