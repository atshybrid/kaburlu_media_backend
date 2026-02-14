import prisma from '../src/lib/prisma';

async function verifyApDistricts() {
  try {
    console.log('\n🔍 Verifying Andhra Pradesh districts in database...\n');

    // Get Andhra Pradesh state
    const apState = await prisma.state.findFirst({
      where: { name: 'Andhra Pradesh' }
    });

    if (!apState) {
      console.log('❌ Andhra Pradesh state not found');
      return;
    }

    // Get all districts
    const districts = await prisma.district.findMany({
      where: {
        stateId: apState.id,
        isDeleted: false
      },
      include: {
        translations: {
          orderBy: { language: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`✅ Found ${districts.length} districts for Andhra Pradesh\n`);
    console.log('='.repeat(100));
    console.log('District Name (English)'.padEnd(35) + ' | Telugu'.padEnd(30) + ' | Hindi');
    console.log('='.repeat(100));

    for (const district of districts) {
      const teTranslation = district.translations.find(t => t.language === 'te');
      const hiTranslation = district.translations.find(t => t.language === 'hi');

      console.log(
        district.name.padEnd(35) + 
        ' | ' + (teTranslation?.name || '-').padEnd(28) + 
        ' | ' + (hiTranslation?.name || '-')
      );
    }

    console.log('='.repeat(100));
    console.log(`\n📊 Total: ${districts.length} districts with translations\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyApDistricts();
