/**
 * fix_ap_mandal_districts.ts
 *
 * Problem: New AP districts were added but the mandals inside those districts
 * still have districtId pointing to old/wrong districts in the DB.
 *
 * Fix: For every district JSON file under location/Andhrapradesh_mandals/:
 *   1. Ensure the district exists in DB (Andhra Pradesh state)
 *   2. For each mandal in that JSON:
 *      - If mandal exists under WRONG district → move (update districtId)
 *      - If mandal doesn't exist anywhere → create under correct district
 *      - If mandal already under correct district → skip
 *
 * Run:
 *   npx ts-node scripts/fix_ap_mandal_districts.ts
 */

import prisma from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

const MANDALS_DIR = path.join(process.cwd(), 'location', 'Andhrapradesh_mandals');
const STATE_NAME = 'Andhra Pradesh';

interface MandalEntry {
  name_en: string;
  name_te?: string;
  name_hi?: string;
}

interface DistrictFile {
  district: {
    name_en: string;
    name_te?: string;
    name_hi?: string;
  };
  mandals: MandalEntry[];
}

async function main() {
  console.log('='.repeat(70));
  console.log('AP Mandal District Fix Script');
  console.log('='.repeat(70));

  // Get Andhra Pradesh state
  const apState = await prisma.state.findFirst({
    where: { name: STATE_NAME },
  });

  if (!apState) {
    console.error(`❌ State "${STATE_NAME}" not found in DB. Run district seed first.`);
    process.exit(1);
  }

  console.log(`✅ Found state: ${STATE_NAME} (id: ${apState.id})\n`);

  const files = fs.readdirSync(MANDALS_DIR).filter(f => f.endsWith('.json'));
  console.log(`📁 Found ${files.length} district JSON files\n`);

  let totalMoved = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of files) {
    const filePath = path.join(MANDALS_DIR, file);
    let data: DistrictFile;

    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.warn(`⚠️  Skipping ${file}: cannot parse JSON`);
      continue;
    }

    const districtNameEn = data.district.name_en;
    console.log(`\n📍 District: ${districtNameEn}`);
    console.log('─'.repeat(60));

    // Ensure district exists in DB
    let district = await prisma.district.findFirst({
      where: { name: districtNameEn, stateId: apState.id },
    });

    if (!district) {
      district = await prisma.district.create({
        data: { name: districtNameEn, stateId: apState.id },
      });
      console.log(`   ✨ Created new district in DB: ${districtNameEn}`);
    }

    // Upsert district translations
    if (data.district.name_te) {
      await prisma.districtTranslation.upsert({
        where: { districtId_language: { districtId: district.id, language: 'te' } },
        update: { name: data.district.name_te },
        create: { districtId: district.id, language: 'te', name: data.district.name_te },
      }).catch(() => {});
    }
    if (data.district.name_hi) {
      await prisma.districtTranslation.upsert({
        where: { districtId_language: { districtId: district.id, language: 'hi' } },
        update: { name: data.district.name_hi },
        create: { districtId: district.id, language: 'hi', name: data.district.name_hi },
      }).catch(() => {});
    }

    let moved = 0, created = 0, skipped = 0, errors = 0;

    for (const mandalData of data.mandals) {
      const mandalName = mandalData.name_en;

      try {
        // Look for this mandal anywhere in AP (by name + stateId via join)
        const existingMandals = await prisma.mandal.findMany({
          where: {
            name: mandalName,
            district: { stateId: apState.id },
          },
          select: { id: true, districtId: true },
        });

        if (existingMandals.length === 0) {
          // Mandal doesn't exist at all → create under correct district
          const newMandal = await prisma.mandal.create({
            data: { name: mandalName, districtId: district.id },
          });
          // Add translations
          if (mandalData.name_te) {
            await prisma.mandalTranslation.upsert({
              where: { mandalId_language: { mandalId: newMandal.id, language: 'te' } },
              update: { name: mandalData.name_te },
              create: { mandalId: newMandal.id, language: 'te', name: mandalData.name_te },
            }).catch(() => {});
          }
          if (mandalData.name_hi) {
            await prisma.mandalTranslation.upsert({
              where: { mandalId_language: { mandalId: newMandal.id, language: 'hi' } },
              update: { name: mandalData.name_hi },
              create: { mandalId: newMandal.id, language: 'hi', name: mandalData.name_hi },
            }).catch(() => {});
          }
          created++;
        } else {
          for (const existing of existingMandals) {
            if (existing.districtId === district.id) {
              // Already in correct district
              skipped++;
            } else {
              // Wrong district → move it
              await prisma.mandal.update({
                where: { id: existing.id },
                data: { districtId: district.id },
              });
              // Upsert translations after moving
              if (mandalData.name_te) {
                await prisma.mandalTranslation.upsert({
                  where: { mandalId_language: { mandalId: existing.id, language: 'te' } },
                  update: { name: mandalData.name_te },
                  create: { mandalId: existing.id, language: 'te', name: mandalData.name_te },
                }).catch(() => {});
              }
              if (mandalData.name_hi) {
                await prisma.mandalTranslation.upsert({
                  where: { mandalId_language: { mandalId: existing.id, language: 'hi' } },
                  update: { name: mandalData.name_hi },
                  create: { mandalId: existing.id, language: 'hi', name: mandalData.name_hi },
                }).catch(() => {});
              }
              moved++;
              console.log(`   🔀 Moved: "${mandalName}" → ${districtNameEn}`);
            }
          }
        }
      } catch (err) {
        console.error(`   ❌ Error processing mandal "${mandalName}":`, err);
        errors++;
      }
    }

    console.log(`   ✅ moved=${moved}  created=${created}  skipped=${skipped}  errors=${errors}`);
    totalMoved += moved;
    totalCreated += created;
    totalSkipped += skipped;
    totalErrors += errors;
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`🔀 Mandals moved to correct district : ${totalMoved}`);
  console.log(`✨ Mandals newly created             : ${totalCreated}`);
  console.log(`✓  Mandals already correct           : ${totalSkipped}`);
  console.log(`❌ Errors                            : ${totalErrors}`);
  console.log('='.repeat(70));
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
