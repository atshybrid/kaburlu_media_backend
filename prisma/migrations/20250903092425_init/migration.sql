-- CreateEnum
CREATE TYPE "public"."RoleName" AS ENUM ('SUPER_ADMIN', 'LANGUAGE_ADMIN', 'NEWS_DESK', 'CITIZEN_REPORTER', 'GUEST');

-- CreateTable
CREATE TABLE "public"."Language" (
    "languageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRTL" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("languageId")
);

-- CreateTable
CREATE TABLE "public"."State" (
    "stateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("stateId")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "roleId" TEXT NOT NULL,
    "name" "public"."RoleName" NOT NULL,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("roleId")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "userId" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "deviceId" TEXT,
    "fcmToken" TEXT,
    "roleId" TEXT NOT NULL,
    "languageId" TEXT,
    "stateId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "iconUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("categoryId")
);

-- CreateTable
CREATE TABLE "public"."CategoryTranslation" (
    "translationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("translationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mobileNumber_key" ON "public"."User"("mobileNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Category_key_key" ON "public"."Category"("key");

-- AddForeignKey
ALTER TABLE "public"."State" ADD CONSTRAINT "State_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("languageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("roleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("languageId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("stateId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("categoryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("languageId") ON DELETE RESTRICT ON UPDATE CASCADE;
