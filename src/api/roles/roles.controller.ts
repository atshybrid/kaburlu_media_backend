
import { Request, Response } from 'express';
import { getRoles, createRole } from './roles.service';
import { CreateRoleDto } from './roles.dto';
import { validate } from 'class-validator';

export const getRolesController = async (req: Request, res: Response) => {
  try {
    const roles = await getRoles();
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createRoleController = async (req: Request, res: Response) => {
  try {
    const createRoleDto = new CreateRoleDto(req.body.name, req.body.permissions);

    const errors = await validate(createRoleDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const role = await createRole(createRoleDto);
    res.status(201).json({ success: true, message: 'Role created successfully', data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
