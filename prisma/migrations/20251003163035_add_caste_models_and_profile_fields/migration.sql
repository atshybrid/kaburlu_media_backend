-- AlterTable
ALTER TABLE "public"."UserProfile" ADD COLUMN     "caste" TEXT,
ADD COLUMN     "casteId" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "subCaste" TEXT,
ADD COLUMN     "subCasteId" TEXT,
ADD COLUMN     "surname" TEXT;

-- CreateTable
CREATE TABLE "public"."Caste" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubCaste" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "casteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubCaste_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Caste_name_key" ON "public"."Caste"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubCaste_casteId_name_key" ON "public"."SubCaste"("casteId", "name");

-- AddForeignKey
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_casteId_fkey" FOREIGN KEY ("casteId") REFERENCES "public"."Caste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_subCasteId_fkey" FOREIGN KEY ("subCasteId") REFERENCES "public"."SubCaste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubCaste" ADD CONSTRAINT "SubCaste_casteId_fkey" FOREIGN KEY ("casteId") REFERENCES "public"."Caste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
