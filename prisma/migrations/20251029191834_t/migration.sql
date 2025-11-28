/*
  Warnings:

  - You are about to drop the column `email` on the `Reporter` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Reporter` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `Reporter` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Reporter` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Reporter` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Reporter_email_key";

-- AlterTable
ALTER TABLE "public"."Reporter" DROP COLUMN "email",
DROP COLUMN "name",
DROP COLUMN "passwordHash",
DROP COLUMN "role",
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reporter_userId_key" ON "public"."Reporter"("userId");

-- AddForeignKey
ALTER TABLE "public"."Reporter" ADD CONSTRAINT "Reporter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
