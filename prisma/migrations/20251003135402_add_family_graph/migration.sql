-- CreateEnum
CREATE TYPE "public"."FamilyRelationType" AS ENUM ('PARENT', 'CHILD', 'SPOUSE', 'SIBLING');

-- CreateTable
CREATE TABLE "public"."FamilyRelation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relatedUserId" TEXT NOT NULL,
    "relationType" "public"."FamilyRelationType" NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Family" (
    "id" TEXT NOT NULL,
    "familyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyRelation_userId_idx" ON "public"."FamilyRelation"("userId");

-- CreateIndex
CREATE INDEX "FamilyRelation_relatedUserId_idx" ON "public"."FamilyRelation"("relatedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyRelation_userId_relatedUserId_relationType_key" ON "public"."FamilyRelation"("userId", "relatedUserId", "relationType");

-- CreateIndex
CREATE INDEX "FamilyMember_userId_idx" ON "public"."FamilyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "public"."FamilyMember"("familyId", "userId");

-- AddForeignKey
ALTER TABLE "public"."FamilyRelation" ADD CONSTRAINT "FamilyRelation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyRelation" ADD CONSTRAINT "FamilyRelation_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "public"."Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
