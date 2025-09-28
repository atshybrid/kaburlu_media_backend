-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_articleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_shortNews_fkey";

-- AlterTable
ALTER TABLE "public"."ContentReaction" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."ShortNewsOption" (
    "id" TEXT NOT NULL,
    "shortNewsId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortNewsOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShortNewsOption_shortNewsId_idx" ON "public"."ShortNewsOption"("shortNewsId");

-- CreateIndex
CREATE INDEX "ShortNewsOption_userId_idx" ON "public"."ShortNewsOption"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortNewsOption_userId_shortNewsId_key" ON "public"."ShortNewsOption"("userId", "shortNewsId");

-- RenameForeignKey
ALTER TABLE "public"."ContentReaction" RENAME CONSTRAINT "ContentReaction_user_fkey" TO "ContentReaction_userId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_shortNewsId_fkey" FOREIGN KEY ("shortNewsId") REFERENCES "public"."ShortNews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShortNewsOption" ADD CONSTRAINT "ShortNewsOption_shortNewsId_fkey" FOREIGN KEY ("shortNewsId") REFERENCES "public"."ShortNews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShortNewsOption" ADD CONSTRAINT "ShortNewsOption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."ContentReaction_content_idx" RENAME TO "ContentReaction_contentType_contentId_idx";

-- RenameIndex
ALTER INDEX "public"."ContentReaction_user_content_unique" RENAME TO "ContentReaction_userId_contentType_contentId_key";

-- RenameIndex
ALTER INDEX "public"."ContentReaction_user_idx" RENAME TO "ContentReaction_userId_idx";
