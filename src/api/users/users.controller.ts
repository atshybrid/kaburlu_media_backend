
import { Request, Response } from 'express';
import { createUser, getUsers, findUserById, updateUser, deleteUser } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

export const createUserController = async (req: Request, res: Response) => {
  try {
    // Transform the plain request body to a class instance.
    const createUserDto = plainToClass(CreateUserDto, req.body);

    const errors = await validate(createUserDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Pass the entire DTO to the service.
    const user = await createUser(createUserDto);
    res.status(201).json({ success: true, message: 'User created successfully', data: user });
  } catch (error) {
    if (error instanceof Error) {
        // More specific error for duplicate mobile number
        if (error.message.includes('Unique constraint failed')) {
            return res.status(409).json({ success: false, message: 'A user with this mobile number already exists.' });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getUsersController = async (req: Request, res: Response) => {
  try {
    const { role, languageId, page, limit } = req.query;
    const users = await getUsers({ 
      role: role as string, 
      languageId: languageId as string, 
      page: page ? parseInt(page as string) : 1, 
      limit: limit ? parseInt(limit as string) : 10 
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateUserController = async (req: Request, res: Response) => {
  try {
    // Transform the plain request body to a class instance.
    const updateUserDto = plainToClass(UpdateUserDto, req.body);

    const errors = await validate(updateUserDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const user = await updateUser(req.params.id, updateUserDto);
    res.status(200).json({ success: true, message: 'User updated successfully', data: user });
  } catch (error) {
    if (error instanceof Error) {
        return res.status(500).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteUserController = async (req: Request, res: Response) => {
  try {
    await deleteUser(req.params.id);
    // Changed to send a standard success response instead of 204
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
