/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Language` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Language` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Language" ADD COLUMN     "code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "password" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "public"."Language"("code");
