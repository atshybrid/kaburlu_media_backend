/**
 * Clean up unused/unwanted categories
 * - Keeps only essential news categories
 * - Removes categories not linked to any domains
 * - Option to force delete specific categories
 */

import prisma from '../src/lib/prisma';

// Essential categories to KEEP
const ESSENTIAL_CATEGORIES = [
  'politics',
  'sports',
  'entertainment',
  'business',
  'technology',
  'health',
  'education',
  'crime',
  'international',
  'national',
  'state-news',
  // State-specific categories (will be auto-detected and kept)
  'state-news-telangana',
  'state-news-andhra-pradesh',
  'state-news-karnataka',
  'state-news-tamil-nadu',
  'state-news-maharashtra',
  // Optional but useful
  'local-news',
  'breaking-news',
  'trending'
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🔍 Analyzing categories...\n');
  
  if (dryRun) {
    console.log('🚨 DRY RUN MODE - No changes will be made\n');
  }

  // Get all categories
  const allCategories = await prisma.category.findMany({
    where: { isDeleted: false },
    include: {
      domainCategories: true,
      webArticles: { take: 1 }, // Just check if any exist
      _count: {
        select: {
          domainCategories: true,
          webArticles: true
        }
      }
    }
  });

  console.log(`📊 Total categories: ${allCategories.length}\n`);

  // Categorize
  const toKeep: any[] = [];
  const toRemove: any[] = [];

  for (const cat of allCategories) {
    const isEssential = ESSENTIAL_CATEGORIES.includes(cat.slug);
    const hasLinks = cat._count.domainCategories > 0;
    const hasArticles = cat._count.webArticles > 0;

    if (isEssential || hasLinks || hasArticles) {
      toKeep.push({
        slug: cat.slug,
        name: cat.name,
        domainLinks: cat._count.domainCategories,
        articles: cat._count.webArticles,
        reason: isEssential ? 'essential' : (hasLinks ? 'domain-linked' : 'has-articles')
      });
    } else {
      toRemove.push({
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        domainLinks: cat._count.domainCategories,
        articles: cat._count.webArticles
      });
    }
  }

  console.log('✅ Categories to KEEP:', toKeep.length);
  console.log('---');
  toKeep.forEach(c => {
    console.log(`  ${c.slug.padEnd(30)} | Links: ${c.domainLinks}, Articles: ${c.articles} | ${c.reason}`);
  });

  console.log('\n❌ Categories to REMOVE:', toRemove.length);
  console.log('---');
  toRemove.forEach(c => {
    console.log(`  ${c.slug.padEnd(30)} | "${c.name}"`);
  });

  if (toRemove.length === 0) {
    console.log('\n✅ No categories to remove!');
    return;
  }

  if (dryRun) {
    console.log('\n✅ Dry run complete. Use without --dry-run to actually delete.');
    return;
  }

  // Confirm deletion
  console.log('\n⚠️  About to delete', toRemove.length, 'categories');
  console.log('These categories have:');
  console.log('  - No domain links');
  console.log('  - No articles');
  console.log('  - Not in essential list');
  
  // Soft delete (set isDeleted = true)
  const idsToDelete = toRemove.map(c => c.id);
  
  const result = await prisma.category.updateMany({
    where: {
      id: { in: idsToDelete }
    },
    data: {
      isDeleted: true
    }
  });

  console.log(`\n✅ Soft-deleted ${result.count} categories`);
  console.log('(They are marked isDeleted=true, not permanently removed)');
  
  // Show summary
  const remaining = await prisma.category.count({
    where: { isDeleted: false }
  });
  
  console.log(`\n📊 Final count: ${remaining} active categories`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
