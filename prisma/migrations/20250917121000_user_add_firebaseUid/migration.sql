ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firebaseUid" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_firebaseUid_key" ON "User"("firebaseUid") WHERE "firebaseUid" IS NOT NULL;