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

async function retryParvathipuram() {
  try {
    const filePath = path.join(process.cwd(), 'location', 'Andhrapradesh_mandals', 'Parvathipuram Manyam.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const data: DistrictData = JSON.parse(content);

    // Get Andhra Pradesh state
    const apState = await prisma.state.findFirst({
      where: { name: 'Andhra Pradesh' }
    });

    if (!apState) {
      console.error('❌ Andhra Pradesh state not found');
      return;
    }

    // Get district
    const district = await prisma.district.findFirst({
      where: { 
        name: data.district.name_en,
        stateId: apState.id
      }
    });

    if (!district) {
      console.error('❌ District not found');
      return;
    }

    console.log(`\n🚀 Retrying Parvathipuram Manyam (${data.mandals.length} mandals)...\n`);

    let added = 0;
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
          added++;
        }

        // Add Telugu translation
        const existingTe = await prisma.mandalTranslation.findFirst({
          where: {
            mandalId: mandal.id,
            language: 'te'
          }
        });

        if (!existingTe) {
          await prisma.mandalTranslation.create({
            data: {
              mandalId: mandal.id,
              language: 'te',
              name: mandalData.name_te
            }
          });
        }

        // Add Hindi translation
        const existingHi = await prisma.mandalTranslation.findFirst({
          where: {
            mandalId: mandal.id,
            language: 'hi'
          }
        });

        if (!existingHi) {
          await prisma.mandalTranslation.create({
            data: {
              mandalId: mandal.id,
              language: 'hi',
              name: mandalData.name_hi
            }
          });
        }

        console.log(`  ${(i + 1).toString().padStart(2)}/9 ✅ ${mandalData.name_en}`);
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`  ${(i + 1).toString().padStart(2)}/9 ❌ ${mandalData.name_en}: ${error.message}`);
      }
    }

    console.log(`\n✅ Added ${added} new mandals\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

retryParvathipuram();
