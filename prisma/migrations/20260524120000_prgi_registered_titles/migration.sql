-- PRGI registered newspaper titles (state / district wise reference data)

CREATE TABLE "PrgiRegisteredTitle" (
    "id" TEXT NOT NULL,
    "serialNumber" INTEGER,
    "title" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "registrationDate" DATE,
    "language" TEXT,
    "periodicity" TEXT,
    "publisher" TEXT,
    "owner" TEXT,
    "publicationState" TEXT NOT NULL,
    "publicationDistrict" TEXT,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrgiRegisteredTitle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrgiRegisteredTitle_registrationNumber_key" ON "PrgiRegisteredTitle"("registrationNumber");

CREATE INDEX "PrgiRegisteredTitle_publicationState_idx" ON "PrgiRegisteredTitle"("publicationState");

CREATE INDEX "PrgiRegisteredTitle_publicationDistrict_idx" ON "PrgiRegisteredTitle"("publicationDistrict");

CREATE INDEX "PrgiRegisteredTitle_publicationState_publicationDistrict_idx" ON "PrgiRegisteredTitle"("publicationState", "publicationDistrict");

CREATE INDEX "PrgiRegisteredTitle_title_idx" ON "PrgiRegisteredTitle"("title");

CREATE INDEX "PrgiRegisteredTitle_registrationDate_idx" ON "PrgiRegisteredTitle"("registrationDate");
