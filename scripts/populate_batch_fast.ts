import prisma from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Fast batch population - creates all data at once
 */

async function main() {
  console.log('🚀 Fast batch population from JSON files\n');

  const locationDir = path.join(__dirname, '../location');
  const files = fs.readdirSync(locationDir)
    .filter(f => f.endsWith('.json') && !f.includes('template') && !f.includes('andhra_pradesh'));

  console.log(`📁 Found ${files.length} district files\n`);

  // Collect all data first
  const allData: any[] = [];
  for (const file of files) {
    const filePath = path.join(locationDir, file);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    allData.push(JSON.parse(rawData));
  }

  // Get India
  const india = await prisma.country.findFirst({ where: { name: 'India' } });
  if (!india) throw new Error('India not found');

  // Get or create Telangana state
  let state = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!state) {
    state = await prisma.state.create({
      data: { name: 'Telangana', countryId: india.id, isDeleted: false }
    });
    console.log('✅ Created Telangana state');
  }

  // Create state translation
  const stateTransExists = await prisma.stateTranslation.findFirst({
    where: { stateId: state.id, language: 'te' }
  });

  if (!stateTransExists) {
    await prisma.stateTranslation.create({
      data: { stateId: state.id, language: 'te', name: 'తెలంగాణ' }
    });
    console.log('✅ Created Telangana Telugu translation\n');
  }

  console.log('Creating all districts and mandals...\n');

  let stats = {
    districtsCreated: 0,
    mandalsCreated: 0,
    translationsCreated: 0
  };

  // Process in single transaction per district
  for (let i = 0; i < allData.length; i++) {
    const data = allData[i];
    const { district: districtInfo, mandals } = data;

    console.log(`[${i + 1}/${allData.length}] ${districtInfo.name_en}...`);

    try {
      await prisma.$transaction(async (tx) => {
        // Find or create district
        let district = await tx.district.findFirst({
          where: {
            name: { equals: districtInfo.name_en, mode: 'insensitive' },
            stateId: state.id
          }
        });

        if (!district) {
          district = await tx.district.create({
            data: {
              name: districtInfo.name_en,
              stateId: state.id,
              isDeleted: false
            }
          });
          stats.districtsCreated++;
        }

        // Create district translation if not exists
        const distTransExists = await tx.districtTranslation.findFirst({
          where: { districtId: district.id, language: 'te' }
        });

        if (!distTransExists) {
          await tx.districtTranslation.create({
            data: {
              districtId: district.id,
              language: 'te',
              name: districtInfo.name_te
            }
          });
          stats.translationsCreated++;
        }

        // Create all mandals for this district
        for (const mandalInfo of mandals) {
          let mandal = await tx.mandal.findFirst({
            where: {
              name: { equals: mandalInfo.name_en, mode: 'insensitive' },
              districtId: district.id
            }
          });

          if (!mandal) {
            mandal = await tx.mandal.create({
              data: {
                name: mandalInfo.name_en,
                districtId: district.id,
                isDeleted: false
              }
            });
            stats.mandalsCreated++;
          }

          // Create mandal translation if not exists
          const mandalTransExists = await tx.mandalTranslation.findFirst({
            where: { mandalId: mandal.id, language: 'te' }
          });

          if (!mandalTransExists) {
            await tx.mandalTranslation.create({
              data: {
                mandalId: mandal.id,
                language: 'te',
                name: mandalInfo.name_te
              }
            });
            stats.translationsCreated++;
          }
        }
      }, {
        timeout: 60000 // 60 second timeout per transaction
      });

      console.log(`  ✅ ${mandals.length} mandals`);
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n═'.repeat(80));
  console.log('✅ Batch population complete!\n');
  console.log(`📊 Created:`);
  console.log(`   Districts: ${stats.districtsCreated}`);
  console.log(`   Mandals: ${stats.mandalsCreated}`);
  console.log(`   Translations: ${stats.translationsCreated}`);

  await prisma.$disconnect();
}

main().catch(console.error);
