/*
  Warnings:

  - The `permissions` column on the `Role` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - Added the required column `mpin` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Role" DROP COLUMN "permissions",
ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "password",
ADD COLUMN     "mpin" TEXT NOT NULL;
