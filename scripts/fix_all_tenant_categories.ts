/**
 * Fix category allocations for all tenants
 * - Adds core categories to all tenant domains
 * - Adds ONLY the tenant's own state category
 * - Removes wrong state categories (from other states)
 */

import prisma from '../src/lib/prisma';

// Core categories that ALL tenants should have
const CORE_CATEGORY_SLUGS = [
  'politics',
  'sports',
  'entertainment',
  'business',
  'technology',
  'health',
  'education',
  'crime',
  'international',
  'state-news' // Parent category
];

async function main() {
  console.log('🔄 Starting category fix for all tenants...\n');

  const tenants = await prisma.tenant.findMany({
    include: { 
      state: true, 
      domains: true 
    }
  });

  console.log(`Found ${tenants.length} tenants\n`);

  for (const tenant of tenants) {
    console.log(`\n📋 Tenant: ${tenant.name} (ID: ${tenant.id})`);
    console.log(`   State: ${tenant.state?.name || 'None'}`);
    console.log(`   Domains: ${tenant.domains.length}`);

    if (!tenant.domains.length) {
      console.log('   ⚠️  No domains - skipping');
      continue;
    }

    // Determine tenant's state category
    let tenantStateCategorySlug: string | null = null;
    if (tenant.state?.name) {
      const stateName = tenant.state.name.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      tenantStateCategorySlug = `state-news-${stateName}`;
    }

    // Build list of allowed category slugs for this tenant
    const allowedSlugs = [...CORE_CATEGORY_SLUGS];
    if (tenantStateCategorySlug) {
      allowedSlugs.push(tenantStateCategorySlug);
    }

    console.log(`   Categories to link: ${allowedSlugs.length}`);
    if (tenantStateCategorySlug) {
      console.log(`   State category: ${tenantStateCategorySlug}`);
    }

    // Get category records
    const categories = await prisma.category.findMany({
      where: {
        slug: { in: allowedSlugs },
        isDeleted: false
      }
    });

    const foundSlugs = categories.map(c => c.slug);
    const missingSlugs = allowedSlugs.filter(s => !foundSlugs.includes(s));
    if (missingSlugs.length > 0) {
      console.log(`   ⚠️  Missing categories: ${missingSlugs.join(', ')}`);
    }

    // Process each domain
    for (const domain of tenant.domains) {
      console.log(`\n   🌐 Domain: ${domain.domain || domain.id}`);

      // Step 1: Remove ALL state-news-* categories (we'll re-add the correct one)
      const removedResult = await prisma.domainCategory.deleteMany({
        where: {
          domainId: domain.id,
          category: {
            slug: {
              startsWith: 'state-news-',
            }
          }
        }
      });

      if (removedResult.count > 0) {
        console.log(`      🗑️  Removed ${removedResult.count} state category allocations`);
      }

      // Step 2: Add all correct categories
      let added = 0;
      let skipped = 0;

      for (const category of categories) {
        try {
          await prisma.domainCategory.create({
            data: {
              domainId: domain.id,
              categoryId: category.id
            }
          });
          added++;
        } catch (error: any) {
          // Already exists (unique constraint) - that's ok
          if (error.code === 'P2002') {
            skipped++;
          } else {
            console.error(`      ❌ Error linking ${category.slug}:`, error.message);
          }
        }
      }

      console.log(`      ✅ Added: ${added}, Already existed: ${skipped}`);
    }

    // Summary for this tenant
    const finalCount = await prisma.domainCategory.count({
      where: {
        domainId: { in: tenant.domains.map(d => d.id) }
      }
    });

    console.log(`   ✅ Total allocations for tenant: ${finalCount}`);
  }

  console.log('\n\n✅ All tenants processed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
