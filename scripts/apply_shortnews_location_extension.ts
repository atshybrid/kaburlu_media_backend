import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const sql = `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ShortNews' AND column_name='accuracyMeters') THEN
        ALTER TABLE "public"."ShortNews" ADD COLUMN "accuracyMeters" DOUBLE PRECISION;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ShortNews' AND column_name='provider') THEN
        ALTER TABLE "public"."ShortNews" ADD COLUMN "provider" TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ShortNews' AND column_name='timestampUtc') THEN
        ALTER TABLE "public"."ShortNews" ADD COLUMN "timestampUtc" TIMESTAMP(3);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ShortNews' AND column_name='placeId') THEN
        ALTER TABLE "public"."ShortNews" ADD COLUMN "placeId" TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ShortNews' AND column_name='placeName') THEN
        ALTER TABLE "public"."ShortNews" ADD COLUMN "placeName" TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ShortNews' AND column_name='source') THEN
        ALTER TABLE "public"."ShortNews" ADD COLUMN "source" TEXT;
      END IF;
    END$$;`;

    await prisma.$executeRawUnsafe(sql);
    console.log('ShortNews location columns ensured successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
