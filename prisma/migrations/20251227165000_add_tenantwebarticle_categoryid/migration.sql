-- Add optional categoryId to TenantWebArticle for a primary category

ALTER TABLE "TenantWebArticle"
ADD COLUMN "categoryId" TEXT;

ALTER TABLE "TenantWebArticle"
ADD CONSTRAINT "TenantWebArticle_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "TenantWebArticle_categoryId_idx" ON "TenantWebArticle"("categoryId");
