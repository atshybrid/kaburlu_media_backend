
import { Request, Response } from 'express';
import * as userService from './users.service';

export const createUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    // Handle duplicate mobile number with detailed response
    if (error.code === 'MOBILE_NUMBER_EXISTS' && error.details) {
      return res.status(409).json({
        success: false,
        ...error.details,
      });
    }
    // Handle Prisma unique constraint error (fallback)
    if (error.code === 'P2002' && error.meta?.target?.includes('mobileNumber')) {
      return res.status(409).json({
        success: false,
        error: 'MOBILE_NUMBER_EXISTS',
        message: 'Mobile number already exists',
      });
    }
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await userService.findAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const user = await userService.findUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: (error as Error).message });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const user = await userService.updateUser(String(req.params.id), req.body);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error?.message || 'Failed to update user' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        await userService.deleteUser(String(req.params.id));
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ success: false, message: (error as Error).message });
    }
};

export const upgradeGuest = async (req: Request, res: Response) => {
    try {
        const user = await userService.upgradeGuest(req.body);
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: (error as Error).message });
    }
};
