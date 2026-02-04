import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding new ReporterLevel values...');
  
  // Add DIVISION and CONSTITUENCY to enum
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'DIVISION' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReporterLevel')
      ) THEN
        ALTER TYPE "ReporterLevel" ADD VALUE 'DIVISION';
      END IF;
    END $$;
  `);
  
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'CONSTITUENCY' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReporterLevel')
      ) THEN
        ALTER TYPE "ReporterLevel" ADD VALUE 'CONSTITUENCY';
      END IF;
    END $$;
  `);
  
  console.log('✓ Added DIVISION and CONSTITUENCY to ReporterLevel enum');
  
  // Add new columns
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Reporter" ADD COLUMN IF NOT EXISTS "divisionId" TEXT;
  `);
  
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Reporter" ADD COLUMN IF NOT EXISTS "constituencyId" TEXT;
  `);
  
  console.log('✓ Added divisionId and constituencyId columns to Reporter table');
  
  // Verify the changes
  const levels = await prisma.$queryRaw`
    SELECT enumlabel 
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReporterLevel')
    ORDER BY enumlabel;
  `;
  
  console.log('\n📋 Reporter Levels:', levels);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
