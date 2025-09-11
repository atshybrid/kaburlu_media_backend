/*
  Warnings:

  - Added the required column `type` to the `Article` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "headlines" TEXT,
ADD COLUMN     "longNews" TEXT,
ADD COLUMN     "shortNews" TEXT,
ADD COLUMN     "type" TEXT NOT NULL;
