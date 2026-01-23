#!/usr/bin/env node
/**
 * Resolve failed migration on production database
 * This marks the failed migration as rolled back so it can be re-applied
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function resolveMigration() {
  try {
    console.log('🔧 Resolving failed migration: 202601210001_add_epaper_clips_system\n');

    // Delete the failed migration record
    const result = await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations" 
      WHERE migration_name = '202601210001_add_epaper_clips_system'
    `;

    console.log(`✅ Deleted ${result} migration record(s)`);
    console.log('\n📋 Next steps:');
    console.log('1. Run: npx prisma migrate deploy');
    console.log('2. This will re-apply the migration (now idempotent)');
    console.log('3. Redeploy on Render');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resolveMigration();
