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

// Clean seed set (global). Keep aligned with src/lib/bootstrap.ts.
const CLEAN_DESIGNATIONS = [
  {
    code: 'PUBLISHER',
    name: 'Publisher',
    nativeName: 'ప్రచురణకర్త',
    level: 'STATE',
    levelOrder: 0,
    description: 'Publisher role (editorial head)'
  },
  {
    code: 'CHIEF_EDITOR',
    name: 'Chief Editor',
    nativeName: 'ప్రధాన సంపాదకుడు',
    level: 'STATE',
    levelOrder: 0,
    description: 'Chief Editor (state-level editorial)'
  },
  {
    code: 'EDITOR',
    name: 'Editor',
    nativeName: 'సంపాదకుడు',
    level: 'STATE',
    levelOrder: 0,
    description: 'Editor (state-level editorial)'
  },
  {
    code: 'TENANT_ADMIN',
    name: 'Tenant Admin',
    nativeName: 'టెనెంట్ అడ్మిన్',
    level: 'STATE',
    levelOrder: 0,
    description: 'Tenant Admin (product admin role)'
  },
  {
    code: 'CONSTITUENCY_REPORTER',
    name: 'Constituency Reporter',
    nativeName: 'నియోజకవర్గ రిపోర్టర్',
    level: 'CONSTITUENCY',
    levelOrder: 3,
    description: 'Constituency-level reporter'
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
