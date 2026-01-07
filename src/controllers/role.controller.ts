                                        
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const assignPermissionToRole = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { module, actions, permissions: incomingPermissions } = req.body as any;

    if (!incomingPermissions && (!module || !actions)) {
        return res.status(400).json({ error: 'Provide `permissions` map or legacy `module` + `actions`.' });
    }

    try {
        const role = await prisma.role.findUnique({
            where: { id },
        });

        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // Normalize existing permissions into a module->actions map
        let currentPermissions: Record<string, string[]> = {};
        const raw = (role as any).permissions;
        if (Array.isArray(raw)) {
            // Convert array of strings like "module:action" into map
            for (const p of raw) {
                if (typeof p === 'string' && p.includes(':')) {
                    const [mod, act] = p.split(':');
                    const list = currentPermissions[mod] || (currentPermissions[mod] = []);
                    if (act && !list.includes(act)) list.push(act);
                }
            }
        } else if (raw && typeof raw === 'object') {
            currentPermissions = { ...(raw as Record<string, string[]>) };
        }

        // If new payload `permissions` map is provided, merge/overwrite per module
        if (incomingPermissions && typeof incomingPermissions === 'object') {
            for (const [mod, acts] of Object.entries(incomingPermissions as Record<string, string[]>)) {
                const unique = Array.from(new Set(Array.isArray(acts) ? acts : []));
                currentPermissions[mod] = unique;
            }
        } else if (module && actions) {
            // Legacy payload: overwrite or set actions for the provided module
            currentPermissions[module] = Array.from(new Set(actions));
        }

        const updatedRole = await prisma.role.update({
            where: { id },
            data: { permissions: currentPermissions },
        });

        return res.status(200).json({
            roleId: updatedRole.id,
            updatedModules: Object.keys(currentPermissions),
            permissions: currentPermissions
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPermissionsForRole = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const role = await prisma.role.findUnique({
            where: { id },
        });

        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        const raw = (role as any).permissions;
        if (Array.isArray(raw)) {
            const mapped: Record<string, string[]> = {};
            for (const p of raw) {
                if (typeof p === 'string' && p.includes(':')) {
                    const [mod, act] = p.split(':');
                    const list = mapped[mod] || (mapped[mod] = []);
                    if (act && !list.includes(act)) list.push(act);
                }
            }
            return res.status(200).json(mapped);
        }
        return res.status(200).json(raw || {});
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
