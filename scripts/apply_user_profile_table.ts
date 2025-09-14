import { PrismaClient } from '@prisma/client';

// Idempotent SQL to create UserProfile table and constraints without data loss
async function main() {
  const prisma = new PrismaClient();
  try {
    const stmts = [
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'UserProfile'
        ) THEN
          CREATE TABLE "public"."UserProfile" (
            id TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL UNIQUE,
            "fullName" TEXT,
            gender TEXT,
            dob TIMESTAMP(3),
            "maritalStatus" TEXT,
            bio TEXT,
            "profilePhotoUrl" TEXT,
            "profilePhotoMediaId" TEXT,
            "emergencyContactNumber" TEXT,
            address JSONB,
            "stateId" TEXT,
            "districtId" TEXT,
            "mandalId" TEXT,
            "assemblyId" TEXT,
            "villageId" TEXT,
            occupation TEXT,
            education TEXT,
            "socialLinks" JSONB,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
      END$$;`,
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema='public' AND table_name='UserProfile' AND column_name='fullName'
        ) THEN
          ALTER TABLE "public"."UserProfile" ADD COLUMN "fullName" TEXT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema='public' AND table_name='UserProfile' AND column_name='gender'
        ) THEN
          ALTER TABLE "public"."UserProfile" ADD COLUMN "gender" TEXT;
        END IF;
      END$$;`,
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UserProfile_userId_fkey'
        ) THEN
          ALTER TABLE "public"."UserProfile"
          ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UserProfile_profilePhotoMediaId_fkey'
        ) THEN
          ALTER TABLE "public"."UserProfile"
          ADD CONSTRAINT "UserProfile_profilePhotoMediaId_fkey" FOREIGN KEY ("profilePhotoMediaId") REFERENCES "public"."Media"(id) ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UserProfile_stateId_fkey'
        ) THEN
          ALTER TABLE "public"."UserProfile"
          ADD CONSTRAINT "UserProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"(id) ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UserProfile_districtId_fkey'
        ) THEN
          ALTER TABLE "public"."UserProfile"
          ADD CONSTRAINT "UserProfile_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "public"."District"(id) ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UserProfile_mandalId_fkey'
        ) THEN
          ALTER TABLE "public"."UserProfile"
          ADD CONSTRAINT "UserProfile_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "public"."Mandal"(id) ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END$$;`,
    ];

    for (const sql of stmts) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('UserProfile table ensured successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
