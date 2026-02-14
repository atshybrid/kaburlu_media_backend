import prisma from '../src/lib/prisma';

async function addMissingDistricts() {
  try {
    console.log('\n🚀 Adding missing 3 districts to Andhra Pradesh...\n');

    // Get Andhra Pradesh state
    const apState = await prisma.state.findFirst({
      where: { name: 'Andhra Pradesh' }
    });

    if (!apState) {
      console.error('❌ Andhra Pradesh state not found');
      return;
    }

    const missingDistricts = [
      {
        english: "Madanapalle",
        telugu: "మదనపల్లె",
        hindi: "मदनपल्ले"
      },
      {
        english: "Markapuram",
        telugu: "మార్కాపురం",
        hindi: "मार्कापुरम"
      },
      {
        english: "Polavaram",
        telugu: "పోలవరం",
        hindi: "पोलावरम"
      }
    ];

    let added = 0;

    for (const districtData of missingDistricts) {
      // Check if district exists
      let district = await prisma.district.findFirst({
        where: {
          name: { equals: districtData.english, mode: 'insensitive' },
          stateId: apState.id,
          isDeleted: false
        }
      });

      if (!district) {
        // Create district
        district = await prisma.district.create({
          data: {
            name: districtData.english,
            stateId: apState.id,
            isDeleted: false
          }
        });
        console.log(`✅ Created district: ${districtData.english}`);
        added++;

        // Add Telugu translation
        await prisma.districtTranslation.create({
          data: {
            districtId: district.id,
            language: 'te',
            name: districtData.telugu
          }
        });
        console.log(`   ✅ Added Telugu: ${districtData.telugu}`);

        // Add Hindi translation
        await prisma.districtTranslation.create({
          data: {
            districtId: district.id,
            language: 'hi',
            name: districtData.hindi
          }
        });
        console.log(`   ✅ Added Hindi: ${districtData.hindi}\n`);
      } else {
        console.log(`ℹ️  District already exists: ${districtData.english}\n`);
      }
    }

    console.log(`\n✅ Added ${added} new districts!\n`);

    // Verify final count
    const totalDistricts = await prisma.district.count({
      where: {
        stateId: apState.id,
        isDeleted: false
      }
    });

    console.log(`📊 Total Andhra Pradesh districts in database: ${totalDistricts}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingDistricts();
