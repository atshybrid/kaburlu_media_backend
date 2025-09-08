
import { Request, Response } from 'express';
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
