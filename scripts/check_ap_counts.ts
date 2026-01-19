import prisma from '../src/lib/prisma';

async function checkAPCounts() {
  try {
    const apState = await prisma.state.findFirst({
      where: { name: 'Andhra Pradesh' }
    });

    if (!apState) {
      console.log('❌ Andhra Pradesh state not found');
      return;
    }

    const districts = await prisma.district.findMany({
      where: { stateId: apState.id },
      select: { id: true, name: true }
    });

    const mandalIds = await prisma.mandal.findMany({
      where: { districtId: { in: districts.map(d => d.id) } },
      select: { id: true }
    });

    const districtTe = await prisma.districtTranslation.count({
      where: { 
        districtId: { in: districts.map(d => d.id) },
        language: 'te'
      }
    });

    const districtHi = await prisma.districtTranslation.count({
      where: { 
        districtId: { in: districts.map(d => d.id) },
        language: 'hi'
      }
    });

    const mandalTe = await prisma.mandalTranslation.count({
      where: { 
        mandalId: { in: mandalIds.map(m => m.id) },
        language: 'te'
      }
    });

    const mandalHi = await prisma.mandalTranslation.count({
      where: { 
        mandalId: { in: mandalIds.map(m => m.id) },
        language: 'hi'
      }
    });

    console.log('\n📊 Andhra Pradesh Location Data:\n');
    console.log('='.repeat(60));
    console.log(`Districts:                    ${districts.length}/26`);
    console.log(`Mandals:                      ${mandalIds.length}`);
    console.log(`District Telugu Translations: ${districtTe}/26`);
    console.log(`District Hindi Translations:  ${districtHi}/26`);
    console.log(`Mandal Telugu Translations:   ${mandalTe}`);
    console.log(`Mandal Hindi Translations:    ${mandalHi}`);
    console.log('='.repeat(60));
    console.log('\n✅ Andhra Pradesh data complete!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAPCounts();
