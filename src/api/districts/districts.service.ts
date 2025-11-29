import prisma from '../../lib/prisma';
import { CreateDistrictDto, UpdateDistrictDto } from './districts.dto';
import fs from 'fs';
import csv from 'csv-parser';

export async function listDistricts(includeDeleted = false) {
  return prisma.district.findMany({
    where: includeDeleted ? {} : { isDeleted: false },
    orderBy: { name: 'asc' }
  });
}

export async function getDistrict(id: string) {
  return prisma.district.findUnique({ where: { id } });
}

export async function createDistrict(data: CreateDistrictDto) {
  const name = data.name.trim();
  // Check for existing by name+stateId (case-insensitive)
  const existing = await prisma.district.findFirst({
    where: { stateId: data.stateId, name: { equals: name, mode: 'insensitive' } }
  });
  if (existing) {
    if (existing.isDeleted) {
      return prisma.district.update({ where: { id: existing.id }, data: { isDeleted: false } });
    }
    throw new Error('District already exists');
  }
  return prisma.district.create({ data: { name, stateId: data.stateId } });
}

export async function updateDistrict(id: string, data: UpdateDistrictDto) {
  const payload: any = {};
  if (typeof data.name === 'string') {
    const name = data.name.trim();
    payload.name = name;
    // If renaming, ensure uniqueness within same stateId (when provided)
    const record = await prisma.district.findUnique({ where: { id } });
    const stateId = data.stateId ?? record?.stateId ?? undefined;
    if (stateId) {
      const clash = await prisma.district.findFirst({
        where: { id: { not: id }, stateId, name: { equals: name, mode: 'insensitive' }, isDeleted: false }
      });
      if (clash) throw new Error('Duplicate district name in state');
    }
  }
  if (typeof data.stateId === 'string') payload.stateId = data.stateId;
  if (typeof data.isDeleted === 'boolean') payload.isDeleted = data.isDeleted;
  return prisma.district.update({ where: { id }, data: payload });
}

export async function softDeleteDistrict(id: string) {
  return prisma.district.update({ where: { id }, data: { isDeleted: true } });
}

interface BulkDistrictRow { name: string; stateId: string; }

export function bulkUploadDistricts(filePath: string): Promise<{ created: number; skipped: number; errors: string[]; }> {
  return new Promise((resolve, reject) => {
    const rows: BulkDistrictRow[] = [];
    const errors: string[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const name = (row.name || '').trim();
        const stateId = (row.stateId || '').trim();
        if (!name || !stateId) {
          errors.push(`Missing name/stateId in row: ${JSON.stringify(row)}`);
          return;
        }
        rows.push({ name, stateId });
      })
      .on('end', async () => {
        try {
          let created = 0; let skipped = 0;
          for (const r of rows) {
            try {
              const existing = await prisma.district.findFirst({ where: { name: r.name, stateId: r.stateId } });
              if (existing) { skipped++; continue; }
              await prisma.district.create({ data: { name: r.name, stateId: r.stateId } });
              created++;
            } catch (e: any) {
              errors.push(`Row error (${r.name}): ${e.message}`);
            }
          }
          fs.unlinkSync(filePath);
          resolve({ created, skipped, errors });
        } catch (e: any) {
          fs.unlinkSync(filePath);
          reject(e);
        }
      })
      .on('error', (err) => {
        fs.unlinkSync(filePath);
        reject(err);
      });
  });
}
