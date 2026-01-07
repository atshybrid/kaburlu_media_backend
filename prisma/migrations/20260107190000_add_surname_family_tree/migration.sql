-- Add Surname + new FamilyTree tables (non-conflicting with existing Family/FamilyMember)

-- Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FamilyTreeSide') THEN
    CREATE TYPE "FamilyTreeSide" AS ENUM ('FATHER', 'MOTHER', 'SPOUSE');
  END IF;
END$$;

-- Surname
CREATE TABLE IF NOT EXISTS "Surname" (
  "id" TEXT NOT NULL,
  "surnameEn" TEXT NOT NULL,
  "surnameNative" TEXT,
  "stateId" TEXT,
  "createdByUserId" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Surname_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Surname_stateId_fkey') THEN
    ALTER TABLE "Surname" ADD CONSTRAINT "Surname_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Surname_createdByUserId_fkey') THEN
    ALTER TABLE "Surname" ADD CONSTRAINT "Surname_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "Surname_stateId_surnameEn_key" ON "Surname"("stateId", "surnameEn");
CREATE INDEX IF NOT EXISTS "Surname_surnameEn_idx" ON "Surname"("surnameEn");
CREATE INDEX IF NOT EXISTS "Surname_stateId_idx" ON "Surname"("stateId");

-- FamilyTree
CREATE TABLE IF NOT EXISTS "FamilyTree" (
  "id" TEXT NOT NULL,
  "side" "FamilyTreeSide" NOT NULL,
  "groupName" TEXT,
  "rootMemberId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "surnameId" TEXT,
  "villageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyTree_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FamilyTree_createdByUserId_fkey') THEN
    ALTER TABLE "FamilyTree" ADD CONSTRAINT "FamilyTree_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FamilyTree_surnameId_fkey') THEN
    ALTER TABLE "FamilyTree" ADD CONSTRAINT "FamilyTree_surnameId_fkey" FOREIGN KEY ("surnameId") REFERENCES "Surname"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "FamilyTree_createdByUserId_side_key" ON "FamilyTree"("createdByUserId", "side");
CREATE INDEX IF NOT EXISTS "FamilyTree_createdByUserId_idx" ON "FamilyTree"("createdByUserId");
CREATE INDEX IF NOT EXISTS "FamilyTree_side_idx" ON "FamilyTree"("side");
CREATE INDEX IF NOT EXISTS "FamilyTree_surnameId_idx" ON "FamilyTree"("surnameId");
CREATE INDEX IF NOT EXISTS "FamilyTree_villageId_idx" ON "FamilyTree"("villageId");

-- FamilyTreeMember
CREATE TABLE IF NOT EXISTS "FamilyTreeMember" (
  "id" TEXT NOT NULL,
  "familyTreeId" TEXT NOT NULL,
  "userId" TEXT,
  "fullName" TEXT NOT NULL,
  "kinRelationId" TEXT,
  "parentMemberId" TEXT,
  "isPlaceholder" BOOLEAN NOT NULL DEFAULT FALSE,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyTreeMember_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FamilyTreeMember_familyTreeId_fkey') THEN
    ALTER TABLE "FamilyTreeMember" ADD CONSTRAINT "FamilyTreeMember_familyTreeId_fkey" FOREIGN KEY ("familyTreeId") REFERENCES "FamilyTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FamilyTreeMember_userId_fkey') THEN
    ALTER TABLE "FamilyTreeMember" ADD CONSTRAINT "FamilyTreeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FamilyTreeMember_kinRelationId_fkey') THEN
    ALTER TABLE "FamilyTreeMember" ADD CONSTRAINT "FamilyTreeMember_kinRelationId_fkey" FOREIGN KEY ("kinRelationId") REFERENCES "KinRelation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FamilyTreeMember_parentMemberId_fkey') THEN
    ALTER TABLE "FamilyTreeMember" ADD CONSTRAINT "FamilyTreeMember_parentMemberId_fkey" FOREIGN KEY ("parentMemberId") REFERENCES "FamilyTreeMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "FamilyTreeMember_familyTreeId_userId_key" ON "FamilyTreeMember"("familyTreeId", "userId");
CREATE INDEX IF NOT EXISTS "FamilyTreeMember_familyTreeId_idx" ON "FamilyTreeMember"("familyTreeId");
CREATE INDEX IF NOT EXISTS "FamilyTreeMember_userId_idx" ON "FamilyTreeMember"("userId");
CREATE INDEX IF NOT EXISTS "FamilyTreeMember_parentMemberId_idx" ON "FamilyTreeMember"("parentMemberId");
CREATE INDEX IF NOT EXISTS "FamilyTreeMember_kinRelationId_idx" ON "FamilyTreeMember"("kinRelationId");
