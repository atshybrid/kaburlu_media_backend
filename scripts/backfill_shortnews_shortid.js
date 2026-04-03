/**
 * Backfill shortId for existing ShortNews records that don't have one.
 * Run once: node scripts/backfill_shortnews_shortid.js
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function generateShortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function main() {
  const records = await prisma.shortNews.findMany({
    where: { shortId: null },
    select: { id: true },
  });

  console.log(`Found ${records.length} records without shortId`);

  let success = 0;
  let failed = 0;

  for (const record of records) {
    let shortId;
    let attempts = 0;
    while (attempts < 5) {
      shortId = generateShortId();
      const exists = await prisma.shortNews.findUnique({ where: { shortId } });
      if (!exists) break;
      attempts++;
    }

    try {
      await prisma.shortNews.update({
        where: { id: record.id },
        data: { shortId },
      });
      success++;
    } catch (e) {
      console.error(`Failed to update ${record.id}:`, e.message);
      failed++;
    }
  }

  console.log(`Done. Updated: ${success}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
