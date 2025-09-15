import { PrismaClient } from '@prisma/client';

// Idempotently add iconUrl column to Category table without dropping data
async function main() {
  const prisma = new PrismaClient();
  try {
    // Check if column exists, then add if missing
    const sql = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Category'
          AND column_name = 'iconUrl'
      ) THEN
        ALTER TABLE "Category" ADD COLUMN "iconUrl" TEXT;
      END IF;
    END $$;`;
    await prisma.$executeRawUnsafe(sql);
    console.log('Category.iconUrl ensured successfully');
  } catch (err) {
    console.error('Failed to ensure Category.iconUrl:', err);
    process.exitCode = 1;
  } finally {
    await (prisma as any)?.$disconnect?.();
  }
}

main();
