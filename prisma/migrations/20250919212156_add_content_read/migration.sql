-- CreateEnum
CREATE TYPE "public"."ContentType" AS ENUM ('ARTICLE', 'SHORTNEWS');

-- CreateTable
CREATE TABLE "public"."ContentRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentType" "public"."ContentType" NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalTimeMs" INTEGER NOT NULL DEFAULT 0,
    "maxScrollPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastEventAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sessionsCount" INTEGER NOT NULL DEFAULT 0,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "placeId" TEXT,
    "placeName" TEXT,
    "address" TEXT,
    "stateId" TEXT,
    "districtId" TEXT,
    "mandalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentRead_contentType_contentId_idx" ON "public"."ContentRead"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "ContentRead_stateId_idx" ON "public"."ContentRead"("stateId");

-- CreateIndex
CREATE INDEX "ContentRead_districtId_idx" ON "public"."ContentRead"("districtId");

-- CreateIndex
CREATE INDEX "ContentRead_mandalId_idx" ON "public"."ContentRead"("mandalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRead_userId_contentType_contentId_key" ON "public"."ContentRead"("userId", "contentType", "contentId");

-- AddForeignKey
ALTER TABLE "public"."ContentRead" ADD CONSTRAINT "ContentRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentRead" ADD CONSTRAINT "ContentRead_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentRead" ADD CONSTRAINT "ContentRead_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "public"."District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentRead" ADD CONSTRAINT "ContentRead_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "public"."Mandal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
