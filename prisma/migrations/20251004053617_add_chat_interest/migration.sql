-- CreateTable
CREATE TABLE "public"."ChatInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "followed" BOOLEAN NOT NULL DEFAULT true,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatInterest_targetUserId_idx" ON "public"."ChatInterest"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatInterest_userId_targetUserId_key" ON "public"."ChatInterest"("userId", "targetUserId");

-- AddForeignKey
ALTER TABLE "public"."ChatInterest" ADD CONSTRAINT "ChatInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatInterest" ADD CONSTRAINT "ChatInterest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
