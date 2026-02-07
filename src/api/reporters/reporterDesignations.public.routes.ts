import { Router } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Reporters
 *     description: Reporter hierarchy & roles
 */

/**
 * @swagger
 * /reporter-designations:
 *   get:
 *     summary: List reporter designations (global + tenant overrides)
 *     description: |
 *       Used by public reporter join flow to show designation options.
 *
 *       If `tenantId` is provided, the response merges:
 *       - global designations (`tenantId=null`)
 *       - tenant-specific overrides (same `code` replaces global)
 *
 *       Note: This is a public endpoint (no auth required).
 *     tags: [Reporters]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: false
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         required: false
 *         schema: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL, VILLAGE] }
 *     responses:
 *       200:
 *         description: List
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   - id: "desg_1"
 *                     tenantId: "cmit6rqnk0003ug1wgxsbj6mi"
 *                     level: "MANDAL"
 *                     code: "MANDAL_REPORTER"
 *                     name: "Mandal Reporter"
 */
router.get('/', async (req, res) => {
  const { tenantId, level } = req.query as Record<string, string>;

  const isTenantAdmin = (row: any) => String(row?.code || '').trim().toUpperCase() === 'TENANT_ADMIN';

  const whereGlobal: any = { tenantId: null };
  const whereTenant: any = tenantId ? { tenantId } : null;

  if (level) {
    whereGlobal.level = level;
    if (whereTenant) whereTenant.level = level;
  }

  const [globalRowsRaw, tenantRowsRaw] = await Promise.all([
    (prisma as any).reporterDesignation.findMany({ where: whereGlobal }),
    whereTenant ? (prisma as any).reporterDesignation.findMany({ where: whereTenant }) : [],
  ]);

  const globalRows = (globalRowsRaw as any[]).filter(r => !isTenantAdmin(r));
  const tenantRows = (tenantRowsRaw as any[]).filter(r => !isTenantAdmin(r));

  if (!tenantId) {
    const list = (globalRows as any[]).sort((a: any, b: any) => String(a.level).localeCompare(String(b.level)));
    return res.json(list);
  }

  const byCode: Record<string, any> = {};
  for (const g of globalRows as any[]) byCode[g.code] = g;
  for (const t of tenantRows as any[]) byCode[t.code] = t;

  const merged = Object.values(byCode).sort((a: any, b: any) => {
    const lv = String(a.level).localeCompare(String(b.level));
    if (lv !== 0) return lv;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return res.json(merged);
});

export default router;
