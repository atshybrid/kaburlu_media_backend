import prisma from '../src/lib/prisma';

async function checkAllCounts() {
  try {
    // Get Telangana state
    const telanganaState = await prisma.state.findFirst({
      where: { name: 'Telangana' }
    });

    if (!telanganaState) {
      console.log('❌ Telangana state not found in database');
      return;
    }

    // Count districts
    const districtCount = await prisma.district.count({
      where: { stateId: telanganaState.id }
    });

    // Count total mandals for Telangana
    const districts = await prisma.district.findMany({
      where: { stateId: telanganaState.id },
      select: { id: true }
    });

    const mandalCount = await prisma.mandal.count({
      where: { districtId: { in: districts.map(d => d.id) } }
    });

    // Count translations
    const districtTranslations = await prisma.districtTranslation.count({
      where: { 
        districtId: { in: districts.map(d => d.id) },
        language: 'te'
      }
    });

    const mandalIds = await prisma.mandal.findMany({
      where: { districtId: { in: districts.map(d => d.id) } },
      select: { id: true }
    });

    const mandalTranslations = await prisma.mandalTranslation.count({
      where: { 
        mandalId: { in: mandalIds.map(m => m.id) },
        language: 'te'
      }
    });

    console.log('\n📊 Telangana Location Data in Database:\n');
    console.log('='.repeat(60));
    console.log(`Districts:                    ${districtCount}/33`);
    console.log(`Mandals:                      ${mandalCount}/557`);
    console.log(`District Telugu Translations: ${districtTranslations}/33`);
    console.log(`Mandal Telugu Translations:   ${mandalTranslations}/557`);
    console.log('='.repeat(60));
    
    if (districtCount === 33 && mandalCount === 557) {
      console.log('\n✅ All location data is populated!\n');
    } else {
      console.log(`\n⚠️  Missing: ${33 - districtCount} districts, ${557 - mandalCount} mandals\n`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllCounts();
