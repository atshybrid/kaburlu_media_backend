/**
 * Update category names to proper Title Case
 * Current: POLITICS, SPORTS (all caps)
 * After: Politics, Sports (title case)
 */

import prisma from '../src/lib/prisma';

const CATEGORY_NAME_UPDATES = [
  { slug: 'politics', name: 'Politics' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'entertainment', name: 'Entertainment' },
  { slug: 'business', name: 'Business' },
  { slug: 'technology', name: 'Technology' },
  { slug: 'health', name: 'Health' },
  { slug: 'education', name: 'Education' },
  { slug: 'crime', name: 'Crime' },
  { slug: 'national', name: 'National' },
  { slug: 'international', name: 'International' },
  { slug: 'state-news', name: 'State News' },
  { slug: 'agriculture', name: 'Agriculture' },
  { slug: 'environment', name: 'Environment' },
  { slug: 'weather', name: 'Weather' },
  { slug: 'lifestyle', name: 'Lifestyle' },
  { slug: 'accident', name: 'Accident' },
  { slug: 'devotional', name: 'Devotional' },
  { slug: 'community', name: 'Community' },
  { slug: 'traffic', name: 'Traffic' },
  { slug: 'state-news-telangana', name: 'Telangana' },
  { slug: 'state-news-andhra-pradesh', name: 'Andhra Pradesh' },
  { slug: 'state-news-karnataka', name: 'Karnataka' },
  { slug: 'state-news-tamil-nadu', name: 'Tamil Nadu' },
  { slug: 'state-news-maharashtra', name: 'Maharashtra' },
];

async function main() {
  console.log('📝 Updating category names to Title Case...\n');

  let updated = 0;
  let skipped = 0;

  for (const { slug, name } of CATEGORY_NAME_UPDATES) {
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { id: true, name: true }
    });

    if (!category) {
      console.log(`  ⚠️  Skipped: ${slug} (not found)`);
      skipped++;
      continue;
    }

    if (category.name === name) {
      console.log(`  ✓ Already correct: ${slug} → "${name}"`);
      skipped++;
      continue;
    }

    await prisma.category.update({
      where: { slug },
      data: { name }
    });

    console.log(`  ✅ Updated: ${slug} → "${category.name}" → "${name}"`);
    updated++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`\n✅ Done!`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
