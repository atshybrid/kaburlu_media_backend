import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Generic Adilabad mandal seeder using JSON config file.
// File: location/adilabad_mandals.json
// Each entry: { name: string, assemblyConstituency: boolean }

const prisma = new PrismaClient();

interface MandalEntry { name: string; assemblyConstituency?: boolean }

async function main() {
  const filePath = path.join(__dirname, '../location/adilabad_mandals.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing adilabad_mandals.json');
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const entries: MandalEntry[] = JSON.parse(raw);
  const district = await prisma.district.findFirst({ where: { name: 'Adilabad' } });
  if (!district) throw new Error('Adilabad district not found; seed districts first.');

  let created = 0; let updatedFlag = 0;
  const keepNames = new Set(entries.map(e => e.name));
  // Canonical rename mapping to fix prior spelling variants
  const renameMap: Record<string,string> = {
    'Indervelly': 'Inderavelly',
    'Gudihatnoor': 'Gudihathnoor',
    'Kadam': 'Kadam (Peddur)',
    'Adilabad (Urban)': 'Adilabad',
    'Adilabad (Rural)': 'Adilabad'
  };
  // Apply renames before processing extras
  for (const [oldName, newName] of Object.entries(renameMap)) {
    if (!keepNames.has(newName)) keepNames.add(newName); // ensure canonical retained
    const old = await prisma.mandal.findFirst({ where: { name: oldName, districtId: district.id } });
    if (old) {
      // If target already exists, mark old as deleted; else rename
      const target = await prisma.mandal.findFirst({ where: { name: newName, districtId: district.id } });
      if (target) {
        if (!old.isDeleted) {
          await prisma.mandal.update({ where: { id: old.id }, data: { isDeleted: true } });
        }
      } else {
        await prisma.mandal.update({ where: { id: old.id }, data: { name: newName } });
      }
    }
  }
  for (const m of entries) {
    const existing = await prisma.mandal.findFirst({ where: { name: m.name, districtId: district.id } });
    if (!existing) {
      await prisma.mandal.create({ data: { name: m.name, districtId: district.id, isAssemblyConstituency: Boolean(m.assemblyConstituency) } });
      created++;
      if (m.assemblyConstituency) updatedFlag++;
    } else if (m.assemblyConstituency && !existing.isAssemblyConstituency) {
      await prisma.mandal.update({ where: { id: existing.id }, data: { isAssemblyConstituency: true } });
      updatedFlag++;
    }
  }
  // Soft-delete any mandals previously inserted but not in the new list
  const existingAll = await prisma.mandal.findMany({ where: { districtId: district.id } });
  for (const ex of existingAll) {
    if (!keepNames.has(ex.name) && !ex.isDeleted) {
      await prisma.mandal.update({ where: { id: ex.id }, data: { isDeleted: true } });
    }
  }
  // Optional physical purge of deleted records if env set
  if (process.env.FULL_PURGE_ADILABAD === 'true') {
    const deleted = await prisma.mandal.deleteMany({ where: { districtId: district.id, isDeleted: true } });
    console.log(`[AdilabadFullMandals] Physically removed ${deleted.count} previously soft-deleted mandals.`);
  }
  const total = await prisma.mandal.count({ where: { districtId: district.id } });
  console.log(`[AdilabadFullMandals] Created ${created}, assembly flags updated ${updatedFlag}, total now ${total}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
