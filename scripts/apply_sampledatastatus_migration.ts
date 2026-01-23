/**
 * Apply sampleDataStatus migration directly to production database
 * Uses DIRECT connection (not pooler) to have ALTER TABLE permissions
 */

import { PrismaClient } from '@prisma/client';

// Use direct connection for migrations (has ALTER TABLE permissions)
const directUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl
    }
  }
});

async function applyMigration() {
  try {
    console.log('🔄 Applying sampleDataStatus migration to Domain table...');
    console.log(`📡 Using direct connection: ${directUrl?.substring(0, 50)}...\n`);
    
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- Add sampleDataStatus column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Domain' AND column_name = 'sampleDataStatus'
        ) THEN
          ALTER TABLE "Domain" ADD COLUMN "sampleDataStatus" TEXT;
          RAISE NOTICE '✅ Added sampleDataStatus column';
        ELSE
          RAISE NOTICE '⏭️  sampleDataStatus column already exists';
        END IF;

        -- Add sampleDataMessage column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Domain' AND column_name = 'sampleDataMessage'
        ) THEN
          ALTER TABLE "Domain" ADD COLUMN "sampleDataMessage" TEXT;
          RAISE NOTICE '✅ Added sampleDataMessage column';
        ELSE
          RAISE NOTICE '⏭️  sampleDataMessage column already exists';
        END IF;

        -- Add sampleDataGeneratedAt column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Domain' AND column_name = 'sampleDataGeneratedAt'
        ) THEN
          ALTER TABLE "Domain" ADD COLUMN "sampleDataGeneratedAt" TIMESTAMP(3);
          RAISE NOTICE '✅ Added sampleDataGeneratedAt column';
        ELSE
          RAISE NOTICE '⏭️  sampleDataGeneratedAt column already exists';
        END IF;
      END $$;
    `);
    
    console.log('\n📊 Creating index on sampleDataStatus...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Domain_sampleDataStatus_idx" ON "Domain"("sampleDataStatus");
    `);
    
    console.log('\n✅ Migration applied successfully!\n');
    console.log('📝 Summary:');
    console.log('   - Added sampleDataStatus (TEXT)');
    console.log('   - Added sampleDataMessage (TEXT)');
    console.log('   - Added sampleDataGeneratedAt (TIMESTAMP)');
    console.log('   - Created index on sampleDataStatus');
    console.log('\n🎉 Ready to run backfill script!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
