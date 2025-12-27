-- CreateTable
CREATE TABLE "public"."TenantWebArticle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domainId" TEXT,
    "languageId" TEXT,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "coverImageUrl" TEXT,
    "contentJson" JSONB NOT NULL,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "jsonLd" JSONB,
    "tags" TEXT[],
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantWebArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RawArticle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "categoryIds" JSONB NOT NULL,
    "coverImageUrl" TEXT,
    "media" JSONB,
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "errorCode" TEXT,
    "usage" JSONB,
    "webArticleId" TEXT,
    "shortNewsId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantWebArticle_tenantId_createdAt_idx" ON "public"."TenantWebArticle"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantWebArticle_tenantId_domainId_languageId_slug_key" ON "public"."TenantWebArticle"("tenantId", "domainId", "languageId", "slug");

-- AddForeignKey
ALTER TABLE "public"."TenantWebArticle" ADD CONSTRAINT "TenantWebArticle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantWebArticle" ADD CONSTRAINT "TenantWebArticle_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "public"."Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantWebArticle" ADD CONSTRAINT "TenantWebArticle_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantWebArticle" ADD CONSTRAINT "TenantWebArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
