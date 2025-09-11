
// Removed RoleName import
import prisma from '../../lib/prisma';
import { CreateRoleDto } from './roles.dto';

export const getRoles = async () => {
  return await prisma.role.findMany();
};

export const createRole = async (role: CreateRoleDto) => {
  return await prisma.role.create({
    data: {
      ...role,
  name: role.name
    },
  });
};
