import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const roleName = (req.user as any)?.role?.name;
  if (roleName !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: SUPER_ADMIN only' });
  }
  return next();
}

/**
 * @swagger
 * tags:
 *   - name: AssemblyConstituencies
 *     description: Manage assembly constituencies (SUPER_ADMIN only)
 */

/**
 * @swagger
 * /assembly-constituencies:
 *   get:
 *     summary: List assembly constituencies (SUPER_ADMIN)
 *     tags: [AssemblyConstituencies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: stateId
 *         schema: { type: string }
 *       - in: query
 *         name: districtId
 *         schema: { type: string }
 *       - in: query
 *         name: includeDeleted
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: List }
 */
router.get('/assembly-constituencies', passport.authenticate('jwt', { session: false }), requireSuperAdmin, async (req, res) => {
  try {
    const { stateId, districtId } = req.query as Record<string, string>;
    const includeDeleted = String(req.query.includeDeleted).toLowerCase() === 'true';
    const where: any = {};
    if (!includeDeleted) where.isDeleted = false;
    if (districtId) where.districtId = districtId;
    // Allow filtering by state via district join
    if (stateId) {
      const districts = await prisma.district.findMany({ where: { stateId } });
      where.districtId = { in: districts.map(d => d.id) };
    }
    const items = await (prisma as any).assemblyConstituency.findMany({ where, orderBy: { name: 'asc' }, include: { district: true } });
    res.json(items);
  } catch (e: any) {
    console.error('list assembly constituencies error', e);
    res.status(500).json({ error: 'Failed to list assembly constituencies' });
  }
});

/**
 * @swagger
 * /assembly-constituencies:
 *   post:
 *     summary: Create assembly constituency (SUPER_ADMIN)
 *     tags: [AssemblyConstituencies]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, districtId]
 *             properties:
 *               name: { type: string }
 *               districtId: { type: string }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 */
router.post('/assembly-constituencies', passport.authenticate('jwt', { session: false }), requireSuperAdmin, async (req, res) => {
  try {
    const { name, districtId } = req.body || {};
    if (!name || !districtId) return res.status(400).json({ error: 'name and districtId required' });
    const district = await prisma.district.findUnique({ where: { id: districtId } });
    if (!district) return res.status(400).json({ error: 'Invalid districtId' });
    const existing = await (prisma as any).assemblyConstituency.findFirst({ where: { name, districtId } });
    if (existing) return res.status(409).json({ error: 'Assembly constituency already exists for district' });
    const created = await (prisma as any).assemblyConstituency.create({ data: { name, districtId } });
    res.status(201).json(created);
  } catch (e: any) {
    console.error('create assembly constituency error', e);
    res.status(500).json({ error: 'Failed to create assembly constituency' });
  }
});

/**
 * @swagger
 * /assembly-constituencies/{id}:
 *   get:
 *     summary: Get assembly constituency (SUPER_ADMIN)
 *     tags: [AssemblyConstituencies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Item }
 *       404: { description: Not found }
 */
router.get('/assembly-constituencies/:id', passport.authenticate('jwt', { session: false }), requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await (prisma as any).assemblyConstituency.findUnique({ where: { id }, include: { district: true } });
    if (!item || item.isDeleted) return res.status(404).json({ error: 'Assembly constituency not found' });
    res.json(item);
  } catch (e: any) {
    console.error('get assembly constituency error', e);
    res.status(500).json({ error: 'Failed to get assembly constituency' });
  }
});

/**
 * @swagger
 * /assembly-constituencies/{id}:
 *   patch:
 *     summary: Update assembly constituency (rename or soft delete) (SUPER_ADMIN)
 *     tags: [AssemblyConstituencies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               isDeleted: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.patch('/assembly-constituencies/:id', passport.authenticate('jwt', { session: false }), requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).assemblyConstituency.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Assembly constituency not found' });
    const { name, isDeleted } = req.body || {};
    if (typeof name === 'string' && name.trim() && name !== existing.name) {
      const dup = await (prisma as any).assemblyConstituency.findFirst({ where: { name, districtId: existing.districtId } });
      if (dup) return res.status(409).json({ error: 'Another constituency with this name exists in district' });
    }
    const updated = await (prisma as any).assemblyConstituency.update({ where: { id }, data: {
      name: typeof name === 'string' && name.trim() ? name : existing.name,
      isDeleted: typeof isDeleted === 'boolean' ? isDeleted : existing.isDeleted
    }});
    res.json(updated);
  } catch (e: any) {
    console.error('update assembly constituency error', e);
    res.status(500).json({ error: 'Failed to update assembly constituency' });
  }
});

/**
 * @swagger
 * /assembly-constituencies/{id}:
 *   delete:
 *     summary: Soft delete assembly constituency (SUPER_ADMIN)
 *     tags: [AssemblyConstituencies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 *       409: { description: In use }
 */
router.delete('/assembly-constituencies/:id', passport.authenticate('jwt', { session: false }), requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).assemblyConstituency.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Assembly constituency not found' });
    const usage = await (prisma as any).reporter.count({ where: { assemblyConstituencyId: id } });
    if (usage > 0) return res.status(409).json({ error: 'Constituency in use by reporters' });
    const updated = await (prisma as any).assemblyConstituency.update({ where: { id }, data: { isDeleted: true } });
    res.json({ success: true, item: updated });
  } catch (e: any) {
    console.error('delete assembly constituency error', e);
    res.status(500).json({ error: 'Failed to delete assembly constituency' });
  }
});

export default router;
