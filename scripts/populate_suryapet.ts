import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';

interface DistrictData {
  district: {
    name_en: string;
    name_te: string;
    state_en: string;
    state_te: string;
    total_mandals: number;
  };
  mandals: Array<{
    name_en: string;
    name_te: string;
  }>;
}

async function populateSuryapet() {
  try {
    const filePath = path.join(process.cwd(), 'location', 'Suryapet.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const data: DistrictData = JSON.parse(content);

    console.log('\n🚀 Populating Suryapet district...\n');

    // Get Telangana state
    const state = await prisma.state.findFirst({
      where: { name: 'Telangana' }
    });

    if (!state) {
      console.error('❌ Telangana state not found');
      return;
    }

    // Upsert district
    let district = await prisma.district.findFirst({
      where: { name: data.district.name_en }
    });

    if (!district) {
      district = await prisma.district.create({
        data: {
          name: data.district.name_en,
          stateId: state.id
        }
      });
    }

    console.log(`✅ District: ${district.name}`);

    // Upsert district translation
    await prisma.districtTranslation.upsert({
      where: {
        districtId_language: {
          districtId: district.id,
          language: 'te'
        }
      },
      create: {
        districtId: district.id,
        language: 'te',
        name: data.district.name_te
      },
      update: {
        name: data.district.name_te
      }
    });

    console.log(`📝 Creating ${data.mandals.length} mandals...\n`);

    // Process mandals one by one with delay
    for (let i = 0; i < data.mandals.length; i++) {
      const mandalData = data.mandals[i];
      
      try {
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
        }

        // Upsert mandal translation
        await prisma.mandalTranslation.upsert({
          where: {
            mandalId_language: {
              mandalId: mandal.id,
              language: 'te'
            }
          },
          create: {
            mandalId: mandal.id,
            language: 'te',
            name: mandalData.name_te
          },
          update: {
            name: mandalData.name_te
          }
        });

        console.log(`  ${(i + 1).toString().padStart(2)}/${data.mandals.length} ✅ ${mandalData.name_en}`);

        // Small delay to avoid connection issues
        if (i < data.mandals.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error: any) {
        console.error(`  ${(i + 1).toString().padStart(2)}/${data.mandals.length} ❌ ${mandalData.name_en}: ${error.message}`);
      }
    }

    console.log('\n✅ Suryapet population complete!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateSuryapet();
