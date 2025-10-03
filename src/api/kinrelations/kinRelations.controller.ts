import { Request, Response } from 'express';
import { validate } from 'class-validator';
import { CreateKinRelationDto, UpdateKinRelationDto, BulkUpsertKinRelation } from './kinRelations.dto';
import { listKinRelations, getKinRelationByCode, createKinRelation, updateKinRelation, deleteKinRelation, bulkUpsertKinRelations } from './kinRelations.service';

export async function listKinRelationsController(req: Request, res: Response) {
  try {
    const { category, side, gender, search } = req.query as any;
    const items = await listKinRelations({ category, side, gender, search });
    res.json(items);
  } catch (e) {
    console.error('Failed to list kin relations:', e);
    res.status(500).json({ error: 'Failed to list kin relations' });
  }
}

export async function getKinRelationController(req: Request, res: Response) {
  try {
    const { code } = req.params;
    const item = await getKinRelationByCode(code);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) {
    console.error('Failed to get kin relation:', e);
    res.status(500).json({ error: 'Failed to get kin relation' });
  }
}

export async function createKinRelationController(req: Request, res: Response) {
  const dto = new CreateKinRelationDto();
  Object.assign(dto, req.body);
  const errors = await validate(dto);
  if (errors.length) return res.status(400).json({ errors });
  try {
    const created = await createKinRelation(dto);
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'Code already exists' });
    }
    console.error('Failed to create kin relation:', e);
    res.status(500).json({ error: 'Failed to create kin relation' });
  }
}

export async function updateKinRelationController(req: Request, res: Response) {
  const dto = new UpdateKinRelationDto();
  Object.assign(dto, req.body);
  const errors = await validate(dto);
  if (errors.length) return res.status(400).json({ errors });
  try {
    const { code } = req.params;
    const updated = await updateKinRelation(code, dto);
    res.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    console.error('Failed to update kin relation:', e);
    res.status(500).json({ error: 'Failed to update kin relation' });
  }
}

export async function deleteKinRelationController(req: Request, res: Response) {
  try {
    const { code } = req.params;
    await deleteKinRelation(code);
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    console.error('Failed to delete kin relation:', e);
    res.status(500).json({ error: 'Failed to delete kin relation' });
  }
}

export async function bulkUpsertKinRelationsController(req: Request, res: Response) {
  const body = req.body;
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'Expected an array of kin relations' });
  }
  // Validate each item
  const items: BulkUpsertKinRelation[] = [];
  for (const raw of body) {
    const dto = new CreateKinRelationDto();
    Object.assign(dto, raw);
    const errors = await validate(dto);
    if (errors.length) {
      return res.status(400).json({ error: 'Validation failed for one or more items', details: errors });
    }
    items.push(dto);
  }
  try {
    const result = await bulkUpsertKinRelations(items);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('Failed bulk upsert kin relations:', e);
    res.status(500).json({ error: 'Failed to bulk upsert kin relations' });
  }
}
