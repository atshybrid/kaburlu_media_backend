-- CreateTable
CREATE TABLE "public"."StateTranslation" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StateTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DistrictTranslation" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistrictTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MandalTranslation" (
    "id" TEXT NOT NULL,
    "mandalId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MandalTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VillageTranslation" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StateTranslation_stateId_language_key" ON "public"."StateTranslation"("stateId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "DistrictTranslation_districtId_language_key" ON "public"."DistrictTranslation"("districtId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "MandalTranslation_mandalId_language_key" ON "public"."MandalTranslation"("mandalId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "VillageTranslation_villageId_language_key" ON "public"."VillageTranslation"("villageId", "language");

-- AddForeignKey
ALTER TABLE "public"."StateTranslation" ADD CONSTRAINT "StateTranslation_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DistrictTranslation" ADD CONSTRAINT "DistrictTranslation_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "public"."District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MandalTranslation" ADD CONSTRAINT "MandalTranslation_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "public"."Mandal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VillageTranslation" ADD CONSTRAINT "VillageTranslation_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

