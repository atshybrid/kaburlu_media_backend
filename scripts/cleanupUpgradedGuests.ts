import prisma from '../src/lib/prisma';

async function cleanupUpgradedGuests() {
  const deleted = await prisma.user.deleteMany({
    where: {
      role: { name: 'GUEST' },
      NOT: {
        upgradedAt: null
      }
    }
  });
  console.log(`Deleted ${deleted.count} upgraded guest users.`);
  await prisma.$disconnect();
}

cleanupUpgradedGuests().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
