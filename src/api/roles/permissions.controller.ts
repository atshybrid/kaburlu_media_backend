
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const assignPermissionToRole = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { module, actions } = req.body;

    if (!module || !actions) {
        return res.status(400).json({ error: 'Module and actions are required' });
    }

    try {
        const role = await prisma.role.findUnique({
            where: { roleId: id },
        });

        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        const currentPermissions = (role.permissions as Record<string, string[]>) || {};
        
        currentPermissions[module] = actions;

        const updatedRole = await prisma.role.update({
            where: { roleId: id },
            data: { permissions: currentPermissions },
        });

        return res.status(201).json(updatedRole.permissions);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPermissionsForRole = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const role = await prisma.role.findUnique({
            where: { roleId: id },
        });

        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        return res.status(200).json(role.permissions);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
