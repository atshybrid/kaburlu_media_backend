-- CreateTable
CREATE TABLE "public"."EpaperDesignerDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "publicationEditionId" TEXT,
    "issueDate" DATE NOT NULL,
    "pages" JSONB NOT NULL DEFAULT '[]',
    "savedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperDesignerDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpaperDesignerDraft_tenantId_idx" ON "public"."EpaperDesignerDraft"("tenantId");

-- CreateIndex
CREATE INDEX "EpaperDesignerDraft_issueDate_idx" ON "public"."EpaperDesignerDraft"("issueDate");

-- CreateIndex
CREATE INDEX "EpaperDesignerDraft_publicationEditionId_idx" ON "public"."EpaperDesignerDraft"("publicationEditionId");

-- CreateIndex
CREATE UNIQUE INDEX "EpaperDesignerDraft_tenantId_publicationEditionId_issueDate_key" ON "public"."EpaperDesignerDraft"("tenantId", "publicationEditionId", "issueDate");

-- AddForeignKey
ALTER TABLE "public"."EpaperDesignerDraft" ADD CONSTRAINT "EpaperDesignerDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperDesignerDraft" ADD CONSTRAINT "EpaperDesignerDraft_publicationEditionId_fkey" FOREIGN KEY ("publicationEditionId") REFERENCES "public"."EpaperPublicationEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperDesignerDraft" ADD CONSTRAINT "EpaperDesignerDraft_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
