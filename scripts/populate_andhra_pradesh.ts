import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';

interface DistrictData {
  district: {
    name_en: string;
    name_te: string;
    name_hi: string;
    state_en: string;
    state_te: string;
    state_hi: string;
    total_mandals: number;
  };
  mandals: Array<{
    name_en: string;
    name_te: string;
    name_hi: string;
  }>;
}

async function populateAndhraPradesh() {
  try {
    console.log('\n🚀 Populating Andhra Pradesh districts and mandals...\n');

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
          countryId: india.id
        }
      });
      console.log('✅ Created Andhra Pradesh state\n');

      // Add Telugu translation for state
      await prisma.stateTranslation.create({
        data: {
          stateId: apState.id,
          language: 'te',
          name: 'आంధ్రప్రదేశ్'
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
      console.log('✅ Andhra Pradesh state exists\n');
    }

    // Read all district files from Andhrapradesh_mandals folder
    const mandalsDir = path.join(process.cwd(), 'location', 'Andhrapradesh_mandals');
    const files = fs.readdirSync(mandalsDir)
      .filter(f => f.endsWith('.json') && f !== 'Adilabad.json') // Exclude Telangana district
      .sort();

    console.log(`📁 Found ${files.length} Andhra Pradesh district files\n`);

    let totalDistricts = 0;
    let totalMandals = 0;
    let totalTranslations = 0;

    for (const file of files) {
      const filePath = path.join(mandalsDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Skip empty files
        if (!content.trim()) {
          console.log(`⚠️  Skipping empty file: ${file}\n`);
          continue;
        }
        
        const data: DistrictData = JSON.parse(content);

        // Find or create district
        let district = await prisma.district.findFirst({
          where: { 
            name: data.district.name_en,
            stateId: apState.id
          }
        });

        if (!district) {
          district = await prisma.district.create({
            data: {
              name: data.district.name_en,
              stateId: apState.id
            }
          });
          totalDistricts++;
        }

        // Add Telugu translation for district
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
              name: data.district.name_te
            }
          });
          totalTranslations++;
        }

        // Add Hindi translation for district
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
              name: data.district.name_hi
            }
          });
          totalTranslations++;
        }

        console.log(`[${files.indexOf(file) + 1}/${files.length}] ${data.district.name_en}: ${data.mandals.length} mandals`);

        // Add mandals with translations
        let mandalCount = 0;
        for (const mandalData of data.mandals) {
          // Find or create mandal
          let mandal = await prisma.mandal.findFirst({
            where: {
              name: mandalData.name_en,
              districtId: district.id
            }
          });

          if (!mandal) {
            mandal = await prisma.mandal.create({
              data: {
                name: mandalData.name_en,
                districtId: district.id
              }
            });
            totalMandals++;
            mandalCount++;
          }

          // Add Telugu translation
          const existingMandalTe = await prisma.mandalTranslation.findFirst({
            where: {
              mandalId: mandal.id,
              language: 'te'
            }
          });

          if (!existingMandalTe) {
            await prisma.mandalTranslation.create({
              data: {
                mandalId: mandal.id,
                language: 'te',
                name: mandalData.name_te
              }
            });
            totalTranslations++;
          }

          // Add Hindi translation
          const existingMandalHi = await prisma.mandalTranslation.findFirst({
            where: {
              mandalId: mandal.id,
              language: 'hi'
            }
          });

          if (!existingMandalHi) {
            await prisma.mandalTranslation.create({
              data: {
                mandalId: mandal.id,
                language: 'hi',
                name: mandalData.name_hi
              }
            });
            totalTranslations++;
          }

          // Small delay to avoid connection issues
          await new Promise(resolve => setTimeout(resolve, 20));
        }

        console.log(`  ✅ Added ${mandalCount} new mandals\n`);

      } catch (error: any) {
        console.error(`  ❌ Error processing ${file}: ${error.message}\n`);
      }
    }

    console.log('='.repeat(70));
    console.log('\n✅ Andhra Pradesh population complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   New Districts: ${totalDistricts}`);
    console.log(`   New Mandals: ${totalMandals}`);
    console.log(`   New Translations: ${totalTranslations}\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateAndhraPradesh();
