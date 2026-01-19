import prisma from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Populate database from verified district JSON files
 * NO AI - uses your provided Telugu translations directly
 */

// Add delay to prevent connection overload
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Resume from specific district (set to null to start from beginning)
const RESUME_FROM_INDEX = 17; // Start from district 18 (Medchal-Malkajgiri)

async function main() {
  console.log('🚀 Populating from verified district JSON files\n');

  const locationDir = path.join(__dirname, '../location');
  
  // Get all JSON files except templates
  const allFiles = fs.readdirSync(locationDir)
    .filter(f => f.endsWith('.json') && !f.includes('template') && !f.includes('andhra_pradesh'));

  // Resume from specific index if set
  const files = RESUME_FROM_INDEX !== null 
    ? allFiles.slice(RESUME_FROM_INDEX) 
    : allFiles;

  console.log(`📁 Found ${allFiles.length} total district files`);
  if (RESUME_FROM_INDEX !== null) {
    console.log(`▶️  Resuming from index ${RESUME_FROM_INDEX}: ${files[0]}\n`);
  } else {
    console.log(`▶️  Processing all ${files.length} files\n`);
  }

  // Get or create India
  const india = await prisma.country.findFirst({ where: { name: 'India' } });
  if (!india) throw new Error('India country not found');

  let stats = {
    statesCreated: 0,
    districtsCreated: 0,
    mandalsCreated: 0,
    translationsCreated: 0
  };

  // Track state to avoid duplicates
  const stateCache = new Map<string, any>();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(locationDir, file);
    
    console.log(`[${i + 1}/${files.length}] Processing: ${file}`);

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    const { district: districtInfo, mandals } = data;
    const stateName = districtInfo.state_en;
    const stateTelugu = districtInfo.state_te;
    const districtName = districtInfo.name_en;
    const districtTelugu = districtInfo.name_te;

    // Get or create state
    let state = stateCache.get(stateName);
    if (!state) {
      state = await prisma.state.findFirst({
        where: { name: { equals: stateName, mode: 'insensitive' } }
      });

      if (!state) {
        state = await prisma.state.create({
          data: { name: stateName, countryId: india.id, isDeleted: false }
        });
        stats.statesCreated++;
        console.log(`  ✅ Created state: ${stateName}`);
      }

      // Create state translation
      const existingStateTrans = await prisma.stateTranslation.findFirst({
        where: { stateId: state.id, language: 'te' }
      });

      if (!existingStateTrans && stateTelugu) {
        await prisma.stateTranslation.create({
          data: { stateId: state.id, language: 'te', name: stateTelugu }
        });
        stats.translationsCreated++;
        console.log(`  📝 State Telugu: ${stateTelugu}`);
      }

      stateCache.set(stateName, state);
    }

    // Create district
    let district = await prisma.district.findFirst({
      where: {
        name: { equals: districtName, mode: 'insensitive' },
        stateId: state.id
      }
    });

    if (!district) {
      district = await prisma.district.create({
        data: { name: districtName, stateId: state.id, isDeleted: false }
      });
      stats.districtsCreated++;
      console.log(`  ✅ Created district: ${districtName}`);
    } else {
      console.log(`  ✅ District exists: ${districtName}`);
    }

    // Create district translation
    const existingDistTrans = await prisma.districtTranslation.findFirst({
      where: { districtId: district.id, language: 'te' }
    });

    if (!existingDistTrans && districtTelugu) {
      await prisma.districtTranslation.create({
        data: { districtId: district.id, language: 'te', name: districtTelugu }
      });
      stats.translationsCreated++;
      console.log(`  📝 District Telugu: ${districtTelugu}`);
    }

    // Create mandals
    if (mandals && mandals.length > 0) {
      console.log(`  📊 Creating ${mandals.length} mandals...`);

      for (const mandalInfo of mandals) {
        const mandalName = mandalInfo.name_en;
        const mandalTelugu = mandalInfo.name_te;

        // Add delay to prevent connection overload (increase to 100ms)
        await delay(100);

        let mandal = await prisma.mandal.findFirst({
          where: {
            name: { equals: mandalName, mode: 'insensitive' },
            districtId: district.id
          }
        });

        if (!mandal) {
          mandal = await prisma.mandal.create({
            data: { name: mandalName, districtId: district.id, isDeleted: false }
          });
          stats.mandalsCreated++;
        }

        // Create mandal translation
        const existingMandalTrans = await prisma.mandalTranslation.findFirst({
          where: { mandalId: mandal.id, language: 'te' }
        });

        if (!existingMandalTrans && mandalTelugu) {
          await prisma.mandalTranslation.create({
            data: { mandalId: mandal.id, language: 'te', name: mandalTelugu }
          });
          stats.translationsCreated++;
        }
      }

      console.log(`  ✅ Created ${mandals.length} mandals with Telugu translations`);
    }

    console.log('');
    
    // Add longer delay between districts (increase to 500ms)
    await delay(500);
  }

  console.log('═'.repeat(80));
  console.log('✅ Population Complete!\n');
  console.log('📊 Summary:');
  console.log(`   States: ${stats.statesCreated} created`);
  console.log(`   Districts: ${stats.districtsCreated} created`);
  console.log(`   Mandals: ${stats.mandalsCreated} created`);
  console.log(`   Translations: ${stats.translationsCreated} created`);
  console.log('═'.repeat(80));

  // Final counts
  const finalCounts = {
    states: await prisma.state.count(),
    districts: await prisma.district.count(),
    mandals: await prisma.mandal.count(),
    stateTranslations: await prisma.stateTranslation.count(),
    districtTranslations: await prisma.districtTranslation.count(),
    mandalTranslations: await prisma.mandalTranslation.count()
  };

  console.log('\n📈 Database Totals:');
  console.log(JSON.stringify(finalCounts, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
