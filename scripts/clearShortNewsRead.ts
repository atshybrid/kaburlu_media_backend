import prisma from '../src/lib/prisma';

/**
 * Clears ALL rows from ShortNewsRead table safely.
 * Usage:
 *   npx ts-node scripts/clearShortNewsRead.ts
 */
async function run() {
  const countBefore = await prisma.shortNewsRead.count();
  const result = await prisma.shortNewsRead.deleteMany({});
  const countAfter = await prisma.shortNewsRead.count();
  console.log(`ShortNewsRead cleared. Before=${countBefore} deleted=${result.count} after=${countAfter}`);
  await prisma.$disconnect();
}

run().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
