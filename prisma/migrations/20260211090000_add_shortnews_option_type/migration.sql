-- CreateEnum
CREATE TYPE "public"."ShortNewsOptionType" AS ENUM ('POSITIVE', 'NEGATIVE');

-- AlterTable
ALTER TABLE "public"."ShortNewsOption"
ADD COLUMN "type" "public"."ShortNewsOptionType" NOT NULL DEFAULT 'POSITIVE';
