import prisma from '../../lib/prisma';
import { CreateMandalDto, UpdateMandalDto } from './mandals.dto';
import fs from 'fs';
import csv from 'csv-parser';

export async function listMandals(districtId?: string) {
  return prisma.mandal.findMany({
    where: { isDeleted: false, ...(districtId ? { districtId } : {}) },
    orderBy: { name: 'asc' }
  });
}

export async function getMandal(id: string) {
  return prisma.mandal.findUnique({ where: { id } });
}

export async function createMandal(data: CreateMandalDto) {
  return prisma.mandal.create({ data: { name: data.name.trim(), districtId: data.districtId, isAssemblyConstituency: !!data.isAssemblyConstituency } });
}

export async function updateMandal(id: string, data: UpdateMandalDto) {
  return prisma.mandal.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      districtId: data.districtId,
      isAssemblyConstituency: data.isAssemblyConstituency,
      isDeleted: data.isDeleted ?? undefined
    }
  });
}

export async function softDeleteMandal(id: string) {
  return prisma.mandal.update({ where: { id }, data: { isDeleted: true } });
}

interface BulkMandalRow { name: string; districtId?: string; districtName?: string; isAssemblyConstituency?: boolean; }

export function bulkUploadMandals(filePath: string): Promise<{ created: number; skipped: number; errors: string[]; }> {
  return new Promise((resolve, reject) => {
    const rows: BulkMandalRow[] = [];
    const errors: string[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const name = (row.name || '').trim();
        const districtIdRaw = (row.districtId || '').trim();
        const districtNameRaw = (row.districtName || row.district || '').trim();
        const isAssemblyRaw = (row.isAssemblyConstituency || row.isAssembly || '').toString().trim().toLowerCase();
        const isAssemblyConstituency = ['true', '1', 'yes', 'y'].includes(isAssemblyRaw);
        if (!name || (!districtIdRaw && !districtNameRaw)) {
          errors.push(`Missing name or districtId/districtName in row: ${JSON.stringify(row)}`);
          return;
        }
        rows.push({ name, districtId: districtIdRaw || undefined, districtName: districtNameRaw || undefined, isAssemblyConstituency });
      })
      .on('end', async () => {
        try {
          let created = 0; let skipped = 0;
          // Build district name -> id map in one query (case-insensitive)
          const uniqueNames = Array.from(new Set(rows.filter(r => !r.districtId && r.districtName).map(r => r.districtName!.toLowerCase())));
          let nameToId: Record<string, string> = {};
          if (uniqueNames.length) {
            const districts = await prisma.district.findMany({ where: { name: { in: uniqueNames, mode: 'insensitive' } } });
            for (const d of districts) {
              nameToId[d.name.toLowerCase()] = d.id;
            }
          }
          for (const r of rows) {
            try {
              const resolvedDistrictId = r.districtId || (r.districtName ? nameToId[r.districtName.toLowerCase()] : undefined);
              if (!resolvedDistrictId) {
                errors.push(`District not found for row mandal='${r.name}' (districtName='${r.districtName}')`);
                continue;
              }
              const existing = await prisma.mandal.findFirst({ where: { name: r.name, districtId: resolvedDistrictId } });
              if (existing) { skipped++; continue; }
              await prisma.mandal.create({ data: { name: r.name, districtId: resolvedDistrictId, isAssemblyConstituency: r.isAssemblyConstituency } });
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
