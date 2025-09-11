-- CreateTable
CREATE TABLE "public"."ShortNewsRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shortNewsId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortNewsRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortNewsRead_userId_shortNewsId_key" ON "public"."ShortNewsRead"("userId", "shortNewsId");

-- AddForeignKey
ALTER TABLE "public"."ShortNewsRead" ADD CONSTRAINT "ShortNewsRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShortNewsRead" ADD CONSTRAINT "ShortNewsRead_shortNewsId_fkey" FOREIGN KEY ("shortNewsId") REFERENCES "public"."ShortNews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
