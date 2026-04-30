-- CreateTable
CREATE TABLE "public"."EpaperMlTrainingSample" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "layoutStyle" TEXT NOT NULL,
    "columns" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_processing',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperMlTrainingSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EpaperMlTrainingSample_pdfUrl_key" ON "public"."EpaperMlTrainingSample"("pdfUrl");

-- CreateIndex
CREATE INDEX "EpaperMlTrainingSample_tenantId_idx" ON "public"."EpaperMlTrainingSample"("tenantId");

-- CreateIndex
CREATE INDEX "EpaperMlTrainingSample_issueDate_idx" ON "public"."EpaperMlTrainingSample"("issueDate");

-- CreateIndex
CREATE INDEX "EpaperMlTrainingSample_layoutStyle_idx" ON "public"."EpaperMlTrainingSample"("layoutStyle");

-- CreateIndex
CREATE INDEX "EpaperMlTrainingSample_status_idx" ON "public"."EpaperMlTrainingSample"("status");

-- AddForeignKey
ALTER TABLE "public"."EpaperMlTrainingSample" ADD CONSTRAINT "EpaperMlTrainingSample_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperMlTrainingSample" ADD CONSTRAINT "EpaperMlTrainingSample_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
