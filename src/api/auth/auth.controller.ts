export const logoutController = async (req: Request, res: Response) => {
  try {
    const { refreshToken, deviceId } = req.body;
    // Call service to invalidate token (scaffold)
    await logout(refreshToken, deviceId);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
import { logout } from './auth.service';
import { checkUserExists } from './auth.service';



export const checkUserExistsController = async (req: Request, res: Response) => {
  const mobile = typeof req.query.mobile === 'string' ? req.query.mobile : Array.isArray(req.query.mobile) ? req.query.mobile[0] : '';
  if (!mobile) {
    return res.status(400).json({ error: 'Mobile number is required' });
  }
  const exists = await checkUserExists(mobile as string);
  res.json({ exists });
};

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { login, refresh, registerGuestUser } from './auth.service';
import { MpinLoginDto } from './mpin-login.dto';
import { RefreshDto } from './refresh.dto';
import { validate } from 'class-validator';
import { GuestRegistrationDto } from './guest-registration.dto';

export const loginController = async (req: Request, res: Response) => {
  try {
    const loginDto = new MpinLoginDto(req.body.mobileNumber, req.body.mpin);
    console.log("loginDto", loginDto);
    const errors = await validate(loginDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const result = await login(loginDto);
    console.log("result", result);
    if (!result) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    res.status(200).json({ success: true, message: 'Operation successful', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const refreshController = async (req: Request, res: Response) => {
  try {
    const refreshDto = new RefreshDto(req.body.refreshToken);

    const errors = await validate(refreshDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const result = await refresh(refreshDto);
    if (!result) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    res.status(200).json({ success: true, message: 'Operation successful', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const registerGuestController = async (req: Request, res: Response) => {
    try {
      const guestDto = req.body as GuestRegistrationDto;
      const result = await registerGuestUser(guestDto);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
import * as bcrypt from 'bcrypt';

export const upgradeGuestController = async (req: Request, res: Response) => {
  try {
    const { deviceId, mobileNumber, mpin, email } = req.body;
    // Find guest user by deviceId
    const guestUser = await prisma.user.findFirst({
      where: { devices: { some: { deviceId } }, role: { name: 'GUEST' } }
    });
    if (!guestUser) {
      return res.status(404).json({ error: 'Guest user not found' });
    }
    // Hash the MPIN before storing
    const hashedMpin = await bcrypt.hash(mpin, 10);
    // Upgrade user: set role to CITIZEN_REPORTER, update details, keep languageId
    const citizenRole = await prisma.role.findUnique({ where: { name: 'CITIZEN_REPORTER' } });
    if (!citizenRole) {
      return res.status(500).json({ error: 'Citizen reporter role not found' });
    }
    const updatedUser = await prisma.user.update({
      where: { id: guestUser.id },
      data: {
        mobileNumber,
        mpin: hashedMpin,
        email,
        roleId: citizenRole.id,
        languageId: guestUser.languageId,
        status: 'ACTIVE'
      }
    });
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
