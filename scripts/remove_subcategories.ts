/**
 * Remove subcategories and keep only main categories
 * Keeps: politics, sports, entertainment, etc.
 * Removes: politics-national-politics, sports-cricket, etc.
 */

import prisma from '../src/lib/prisma';

// Main categories to KEEP (simple, no subcategories)
const MAIN_CATEGORIES = [
  'politics',
  'sports',
  'entertainment',
  'business',
  'technology',
  'health',
  'education',
  'crime',
  'national',
  'international',
  'state-news',
  'state-news-telangana',
  'state-news-andhra-pradesh',
  'state-news-karnataka',
  'state-news-tamil-nadu',
  'state-news-maharashtra',
  'agriculture',
  'environment',
  'weather',
  'lifestyle',
  'accident',
  'devotional',
  'community',
  'traffic'
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🔍 Removing subcategories, keeping only main categories...\n');
  
  if (dryRun) {
    console.log('🚨 DRY RUN MODE - No changes will be made\n');
  }

  // Get all categories
  const allCategories = await prisma.category.findMany({
    where: { isDeleted: false },
    include: {
      _count: {
        select: {
          domainCategories: true,
          webArticles: true
        }
      }
    }
  });

  console.log(`📊 Total active categories: ${allCategories.length}\n`);

  const toKeep: any[] = [];
  const toRemove: any[] = [];

  for (const cat of allCategories) {
    if (MAIN_CATEGORIES.includes(cat.slug)) {
      toKeep.push({
        slug: cat.slug,
        name: cat.name,
        domainLinks: cat._count.domainCategories,
        articles: cat._count.webArticles
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

  console.log('✅ Main categories to KEEP:', toKeep.length);
  console.log('---');
  toKeep.forEach(c => {
    console.log(`  ${c.slug.padEnd(30)} | "${c.name}" | Links: ${c.domainLinks}, Articles: ${c.articles}`);
  });

  console.log('\n❌ Subcategories to REMOVE:', toRemove.length);
  console.log('---');
  toRemove.forEach(c => {
    console.log(`  ${c.slug.padEnd(40)} | "${c.name}" | Links: ${c.domainLinks}, Articles: ${c.articles}`);
  });

  if (toRemove.length === 0) {
    console.log('\n✅ No subcategories to remove!');
    return;
  }

  if (dryRun) {
    console.log('\n✅ Dry run complete. Run without --dry-run to actually remove.');
    return;
  }

  console.log(`\n⚠️  Proceeding to remove ${toRemove.length} subcategories...`);

  const idsToDelete = toRemove.map(c => c.id);

  // Step 1: Remove DomainCategory links
  console.log('\n1️⃣ Removing domain category links...');
  const deletedLinks = await prisma.domainCategory.deleteMany({
    where: {
      categoryId: { in: idsToDelete }
    }
  });
  console.log(`   ✅ Removed ${deletedLinks.count} domain category links`);

  // Step 2: Update articles to null category (if any)
  console.log('\n2️⃣ Updating articles with these categories...');
  const updatedArticles = await prisma.tenantWebArticle.updateMany({
    where: {
      categoryId: { in: idsToDelete }
    },
    data: {
      categoryId: null
    }
  });
  console.log(`   ✅ Updated ${updatedArticles.count} articles (set categoryId to null)`);

  // Step 3: Soft delete categories
  console.log('\n3️⃣ Soft deleting categories...');
  const deletedCategories = await prisma.category.updateMany({
    where: {
      id: { in: idsToDelete }
    },
    data: {
      isDeleted: true
    }
  });
  console.log(`   ✅ Soft-deleted ${deletedCategories.count} categories`);

  // Summary
  const finalCount = await prisma.category.count({
    where: { isDeleted: false }
  });
  
  console.log(`\n📊 Final result:`);
  console.log(`   Active categories: ${finalCount}`);
  console.log(`   Removed: ${toRemove.length}`);
  console.log(`\n✅ Done! Your categories are now simpler and cleaner.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
