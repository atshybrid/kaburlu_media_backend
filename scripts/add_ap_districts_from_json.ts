import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';

interface DistrictJson {
  english: string;
  telugu: string;
  hindi: string;
}

async function addAndhraPradeshDistricts() {
  try {
    console.log('\n🚀 Adding Andhra Pradesh districts from JSON file...\n');

    // Read the JSON file
    const jsonPath = path.join(__dirname, '../location/andhrapradesh_districts.json');
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const districts: DistrictJson[] = JSON.parse(rawData);

    console.log(`📋 Found ${districts.length} districts in JSON file\n`);

    // Get India country
    const india = await prisma.country.findFirst({
      where: { name: 'India' }
    });

    if (!india) {
      console.error('❌ India country not found in database');
      return;
    }

    // Get or create Andhra Pradesh state
    let apState = await prisma.state.findFirst({
      where: { name: 'Andhra Pradesh' }
    });

    if (!apState) {
      apState = await prisma.state.create({
        data: { 
          name: 'Andhra Pradesh',
          countryId: india.id,
          isDeleted: false
        }
      });
      console.log('✅ Created Andhra Pradesh state');

      // Add Telugu translation for state
      await prisma.stateTranslation.create({
        data: {
          stateId: apState.id,
          language: 'te',
          name: 'ఆంధ్ర ప్రదేశ్'
        }
      });

      // Add Hindi translation for state
      await prisma.stateTranslation.create({
        data: {
          stateId: apState.id,
          language: 'hi',
          name: 'आंध्र प्रदेश'
        }
      });

      console.log('✅ Added state translations (Telugu & Hindi)\n');
    } else {
      console.log(`✅ Andhra Pradesh state already exists (ID: ${apState.id})\n`);
    }

    let stats = {
      districtsCreated: 0,
      districtsExisted: 0,
      translationsCreated: 0,
      translationsExisted: 0
    };

    // Process each district
    for (const districtData of districts) {
      const districtName = districtData.english.trim();

      // Check if district already exists
      let district = await prisma.district.findFirst({
        where: {
          name: { equals: districtName, mode: 'insensitive' },
          stateId: apState.id,
          isDeleted: false
        }
      });

      if (!district) {
        // Create new district
        district = await prisma.district.create({
          data: {
            name: districtName,
            stateId: apState.id,
            isDeleted: false
          }
        });
        stats.districtsCreated++;
        console.log(`✅ Created district: ${districtName}`);
      } else {
        stats.districtsExisted++;
        console.log(`ℹ️  District already exists: ${districtName}`);
      }

      // Add Telugu translation
      if (districtData.telugu) {
        const existingTe = await prisma.districtTranslation.findFirst({
          where: { 
            districtId: district.id, 
            language: 'te' 
          }
        });

        if (!existingTe) {
          await prisma.districtTranslation.create({
            data: {
              districtId: district.id,
              language: 'te',
              name: districtData.telugu.trim()
            }
          });
          stats.translationsCreated++;
          console.log(`   ✅ Added Telugu translation: ${districtData.telugu}`);
        } else {
          stats.translationsExisted++;
          console.log(`   ℹ️  Telugu translation already exists`);
        }
      }

      // Add Hindi translation
      if (districtData.hindi) {
        const existingHi = await prisma.districtTranslation.findFirst({
          where: { 
            districtId: district.id, 
            language: 'hi' 
          }
        });

        if (!existingHi) {
          await prisma.districtTranslation.create({
            data: {
              districtId: district.id,
              language: 'hi',
              name: districtData.hindi.trim()
            }
          });
          stats.translationsCreated++;
          console.log(`   ✅ Added Hindi translation: ${districtData.hindi}`);
        } else {
          stats.translationsExisted++;
          console.log(`   ℹ️  Hindi translation already exists`);
        }
      }

      console.log(''); // Empty line for readability
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Districts created: ${stats.districtsCreated}`);
    console.log(`Districts already existed: ${stats.districtsExisted}`);
    console.log(`Translations created: ${stats.translationsCreated}`);
    console.log(`Translations already existed: ${stats.translationsExisted}`);
    console.log(`Total districts processed: ${districts.length}`);
    console.log('='.repeat(80) + '\n');

    console.log('✅ Done!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addAndhraPradeshDistricts()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
