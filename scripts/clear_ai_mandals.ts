/**
 * Clear all wrong mandals created by AI script
 */

import prisma from '../src/lib/prisma';

async function main() {
  console.log('🧹 Clearing AI-generated mandals...\n');

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    throw new Error('Telangana not found');
  }

  // Count current mandals
  const mandalCount = await prisma.mandal.count({
    where: {
      district: { stateId: telangana.id },
      isDeleted: false
    }
  });

  console.log(`Found ${mandalCount} mandals to delete\n`);

  // Delete all mandal translations first
  const deletedTranslations = await prisma.mandalTranslation.deleteMany({
    where: {
      mandal: {
        district: { stateId: telangana.id }
      }
    }
  });

  console.log(`✓ Deleted ${deletedTranslations.count} mandal translations`);

  // Delete all mandals
  const deletedMandals = await prisma.mandal.updateMany({
    where: {
      district: { stateId: telangana.id }
    },
    data: { isDeleted: true }
  });

  console.log(`✓ Soft-deleted ${deletedMandals.count} mandals`);

  console.log('\n✅ Cleanup complete! Ready for proper seed data.\n');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
