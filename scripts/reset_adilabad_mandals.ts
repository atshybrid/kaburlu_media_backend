import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Full reset for Adilabad mandals:
// 1. Hard delete all mandals for Adilabad (will fail if FKs exist referencing mandals). If fails, falls back to soft-delete.
// 2. Reinsert canonical 18 from JSON file.
// 3. Report final count.

const prisma = new PrismaClient();

interface MandalEntry { name: string; assemblyConstituency?: boolean }

async function main() {
  const filePath = path.join(__dirname, '../location/adilabad_mandals.json');
  if (!fs.existsSync(filePath)) throw new Error('Missing location/adilabad_mandals.json');
  const entries: MandalEntry[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const district = await prisma.district.findFirst({ where: { name: 'Adilabad' } });
  if (!district) throw new Error('Adilabad district not found; seed districts first.');

  console.log('[ResetAdilabad] Attempting hard delete of existing mandals...');
  try {
    await prisma.mandal.deleteMany({ where: { districtId: district.id } });
    console.log('[ResetAdilabad] Hard delete succeeded.');
  } catch (e) {
    console.warn('[ResetAdilabad] Hard delete failed (FK constraints). Falling back to soft-delete.', (e as any)?.message);
    await prisma.mandal.updateMany({ where: { districtId: district.id }, data: { isDeleted: true } });
  }

  let created = 0;
  for (const m of entries) {
    // Ensure unique per name+district after purge/soft-delete
    const existing = await prisma.mandal.findFirst({ where: { name: m.name, districtId: district.id } });
    if (existing) {
      // resurrect if soft-deleted
      await prisma.mandal.update({ where: { id: existing.id }, data: { isDeleted: false, isAssemblyConstituency: Boolean(m.assemblyConstituency) } });
    } else {
      await prisma.mandal.create({ data: { name: m.name, districtId: district.id, isAssemblyConstituency: Boolean(m.assemblyConstituency) } });
      created++;
    }
  }

  const totalActive = await prisma.mandal.count({ where: { districtId: district.id, isDeleted: false } });
  console.log(`[ResetAdilabad] Created ${created}, total active mandals now ${totalActive}`);
  if (totalActive !== entries.length) {
    console.warn(`[ResetAdilabad] WARNING: Expected ${entries.length} active mandals, found ${totalActive}. Check for duplicates or FK restore issues.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
