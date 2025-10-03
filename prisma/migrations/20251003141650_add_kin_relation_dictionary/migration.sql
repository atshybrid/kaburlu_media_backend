-- CreateTable
CREATE TABLE "public"."KinRelation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "gender" TEXT,
    "side" TEXT,
    "generationUp" INTEGER NOT NULL DEFAULT 0,
    "generationDown" INTEGER NOT NULL DEFAULT 0,
    "en" TEXT NOT NULL,
    "te" TEXT NOT NULL,
    "isCommon" BOOLEAN NOT NULL DEFAULT true,
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KinRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KinRelation_code_key" ON "public"."KinRelation"("code");
