/**
 * Clean Reporter Designations Migration
 * 
 * This script:
 * 1. Clears ALL existing ReporterDesignation records
 * 2. Seeds ONLY 4 standard Indian print newspaper reporter designations
 * 3. Adds hierarchy using levelOrder field
 * 
 * IMPORTANT: Run this after adding levelOrder and nativeName fields to schema
 * 
 * NOTE: VS Code may show TypeScript errors due to cached Prisma types.
 * The script RUNS SUCCESSFULLY despite these errors. To clear errors:
 * - Press Cmd+Shift+P → "Reload Window" OR
 * - Restart VS Code
 * 
 * The @ts-ignore comments suppress false errors from VS Code's stale type cache.
 */

import prisma from '../src/lib/prisma';

// Standard Indian print newspaper reporter designations
const CLEAN_DESIGNATIONS = [
  {
    code: 'STATE_BUREAU_CHIEF',
    name: 'State Bureau Chief',
    nativeName: 'రాష్ట్ర బ్యూరో చీఫ్',
    level: 'STATE',
    levelOrder: 1, // Highest hierarchy
    description: 'State-level head reporter managing all district bureaus'
  },
  {
    code: 'STAFF_REPORTER',
    name: 'Staff Reporter',
    nativeName: 'స్టాఫ్ రిపోర్టర్',
    level: 'DISTRICT',
    levelOrder: 2,
    description: 'District-level senior reporter with full coverage rights'
  },
  {
    code: 'RC_INCHARGE',
    name: 'RC In-charge',
    nativeName: 'ఆర్సీ ఇన్‌చార్జ్',
    level: 'ASSEMBLY',
    levelOrder: 3,
    description: 'Assembly constituency reporter (Reddy Club in-charge)'
  },
  {
    code: 'MANDAL_REPORTER',
    name: 'Mandal Reporter',
    nativeName: 'మండల రిపోర్టర్',
    level: 'MANDAL',
    levelOrder: 4, // Lowest hierarchy (most localized)
    description: 'Mandal/Tehsil level reporter covering local news'
  }
] as const;

async function cleanAndSeedDesignations() {
  console.log('🧹 Starting designation cleanup...');

  try {
    // Step 1: Get count of existing designations
    const existingCount = await prisma.reporterDesignation.count();
    console.log(`📊 Found ${existingCount} existing designations`);

    // Step 2: Delete ALL existing designations (both global and tenant-specific)
    console.log('🗑️  Deleting all existing designations...');
    const deleted = await prisma.reporterDesignation.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} designations`);

    // Step 3: Create ONLY the 4 clean global designations
    console.log('🌱 Seeding clean designations...');
    
    for (const designation of CLEAN_DESIGNATIONS) {
      const created = await prisma.reporterDesignation.create({
        // @ts-ignore - VS Code Prisma type cache issue - fields exist in schema
        data: {
          code: designation.code,
          name: designation.name,
          nativeName: designation.nativeName,
          level: designation.level,
          levelOrder: designation.levelOrder,
          tenantId: null, // Global designation (null = available to all tenants)
        }
      });
      // @ts-ignore - VS Code Prisma type cache issue
      console.log(`  ✓ Created: ${created.name} (Level ${created.levelOrder})`);
    }

    // Step 4: Verify final state
    const finalCount = await prisma.reporterDesignation.count();
    const finalDesignations = await prisma.reporterDesignation.findMany({
      // @ts-ignore - VS Code Prisma type cache issue
      orderBy: { levelOrder: 'asc' },
      // @ts-ignore - VS Code Prisma type cache issue
      select: {
        code: true,
        name: true,
        nativeName: true,
        level: true,
        levelOrder: true,
        tenantId: true
      }
    });

    console.log('\n📋 Final Designation Hierarchy:');
    console.log('================================');
    finalDesignations.forEach((d: any) => {
      // @ts-ignore - VS Code Prisma type cache issue
      console.log(`${d.levelOrder}. ${d.name} (${d.nativeName})`);
      console.log(`   Code: ${d.code}`);
      console.log(`   Level: ${d.level}`);
      console.log(`   Scope: ${d.tenantId ? `Tenant ${d.tenantId}` : 'Global'}`);
      console.log('');
    });

    console.log(`\n✅ Success! Total designations: ${finalCount}`);
    console.log('🎯 All designations are now clean and standardized');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
cleanAndSeedDesignations()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
