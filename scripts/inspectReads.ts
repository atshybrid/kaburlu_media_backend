/**
 * Utility script: inspect (and optionally clear) ArticleRead & ShortNewsRead tables.
 *
 * Usage (ts-node):
 *   npx ts-node scripts/inspectReads.ts            # show counts + sample rows
 *   CLEAR=1 npx ts-node scripts/inspectReads.ts    # clear both tables then show counts
 *   CLEAR=article npx ts-node scripts/inspectReads.ts    # clear only ArticleRead
 *   CLEAR=short npx ts-node scripts/inspectReads.ts      # clear only ShortNewsRead
 */
import prisma from '../src/lib/prisma';

async function main() {
  const clearMode = (process.env.CLEAR || '').toLowerCase();
  if (clearMode) {
    if (clearMode === '1' || clearMode === 'both') {
      console.log('Clearing ArticleRead & ShortNewsRead...');
      await prisma.articleRead.deleteMany({});
      await prisma.shortNewsRead.deleteMany({});
    } else if (clearMode === 'article') {
      console.log('Clearing ArticleRead...');
      await prisma.articleRead.deleteMany({});
    } else if (clearMode === 'short') {
      console.log('Clearing ShortNewsRead...');
      await prisma.shortNewsRead.deleteMany({});
    } else {
      console.log('Unknown CLEAR value. Supported: 1|both|article|short');
    }
  }

  const [articleReadCount, shortNewsReadCount] = await Promise.all([
    prisma.articleRead.count(),
    prisma.shortNewsRead.count(),
  ]);

  console.log('\nCounts:');
  console.log('  ArticleRead    :', articleReadCount);
  console.log('  ShortNewsRead  :', shortNewsReadCount);

  // Fetch a few sample rows for quick inspection
  const [articleSamples, shortSamples] = await Promise.all([
    prisma.articleRead.findMany({ take: 5, orderBy: { readAt: 'desc' } }),
    prisma.shortNewsRead.findMany({ take: 5, orderBy: { readAt: 'desc' } }),
  ]);

  console.log('\nSample ArticleRead rows (max 5):');
  if (!articleSamples.length) console.log('  <none>');
  for (const r of articleSamples) {
    console.log(`  user=${r.userId} article=${r.articleId} totalTimeMs=${(r as any).totalTimeMs} scroll=${(r as any).maxScrollPercent} completed=${(r as any).completed} readAt=${r.readAt.toISOString()}`);
  }

  console.log('\nSample ShortNewsRead rows (max 5):');
  if (!shortSamples.length) console.log('  <none>');
  for (const r of shortSamples) {
    const row: any = r as any;
    console.log(
      `  user=${row.userId} shortNews=${row.shortNewsId} totalTimeMs=${row.totalTimeMs} scroll=${row.maxScrollPercent}` +
      ` completed=${row.completed} sessions=${row.sessionsCount} readAt=${row.readAt.toISOString()}`
    );
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
