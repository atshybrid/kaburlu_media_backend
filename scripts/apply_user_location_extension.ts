import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Idempotent ALTERs to extend UserLocation without dropping data
  const sql = `
  ALTER TABLE "public"."UserLocation"
  ADD COLUMN IF NOT EXISTS "accuracyMeters" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "timestampUtc" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "placeId" TEXT,
  ADD COLUMN IF NOT EXISTS "placeName" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT;
  `;

  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('UserLocation extended successfully.');
  } catch (e) {
    console.error('Failed to extend UserLocation:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
