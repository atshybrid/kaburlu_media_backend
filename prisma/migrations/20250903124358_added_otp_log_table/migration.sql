/*
  Warnings:

  - The primary key for the `Category` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `categoryId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `iconUrl` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `Category` table. All the data in the column will be lost.
  - The primary key for the `Language` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `isRTL` on the `Language` table. All the data in the column will be lost.
  - You are about to drop the column `languageId` on the `Language` table. All the data in the column will be lost.
  - The primary key for the `Role` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `permissions` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `roleId` on the `Role` table. All the data in the column will be lost.
  - The primary key for the `State` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `languageId` on the `State` table. All the data in the column will be lost.
  - You are about to drop the column `stateId` on the `State` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deviceId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `fcmToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `CategoryTranslation` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `Category` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `name` to the `Category` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `Language` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `id` was added to the `Role` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `name` on the `Role` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - The required column `id` was added to the `State` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `id` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "public"."CategoryTranslation" DROP CONSTRAINT "CategoryTranslation_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CategoryTranslation" DROP CONSTRAINT "CategoryTranslation_languageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."State" DROP CONSTRAINT "State_languageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_languageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_roleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_stateId_fkey";

-- DropIndex
DROP INDEX "public"."Category_key_key";

-- AlterTable
ALTER TABLE "public"."Category" DROP CONSTRAINT "Category_pkey",
DROP COLUMN "categoryId",
DROP COLUMN "iconUrl",
DROP COLUMN "isActive",
DROP COLUMN "key",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."Language" DROP CONSTRAINT "Language_pkey",
DROP COLUMN "isRTL",
DROP COLUMN "languageId",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "Language_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."Role" DROP CONSTRAINT "Role_pkey",
DROP COLUMN "permissions",
DROP COLUMN "roleId",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "name",
ADD COLUMN     "name" TEXT NOT NULL,
ADD CONSTRAINT "Role_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."State" DROP CONSTRAINT "State_pkey",
DROP COLUMN "languageId",
DROP COLUMN "stateId",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "State_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "deviceId",
DROP COLUMN "fcmToken",
DROP COLUMN "isVerified",
DROP COLUMN "status",
DROP COLUMN "userId",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "name" TEXT,
ALTER COLUMN "mpin" DROP NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "public"."CategoryTranslation";

-- DropEnum
DROP TYPE "public"."RoleName";

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OtpLog" (
    "id" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PermissionToRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "public"."Permission"("name");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "public"."_PermissionToRole"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
