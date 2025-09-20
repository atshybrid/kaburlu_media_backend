-- Create ReactionValue enum
CREATE TYPE "ReactionValue" AS ENUM ('LIKE','DISLIKE');

-- Create ContentReaction table
CREATE TABLE "ContentReaction" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "contentType" "ContentType" NOT NULL,
  "reaction" "ReactionValue" NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes & constraints
CREATE UNIQUE INDEX "ContentReaction_user_content_unique" ON "ContentReaction" ("userId","contentType","contentId");
CREATE INDEX "ContentReaction_content_idx" ON "ContentReaction" ("contentType","contentId");
CREATE INDEX "ContentReaction_user_idx" ON "ContentReaction" ("userId");

-- Foreign key on user (restrict delete to preserve audit)
ALTER TABLE "ContentReaction" ADD CONSTRAINT "ContentReaction_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger to auto-update updatedAt
CREATE OR REPLACE FUNCTION set_updated_at_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contentreaction_set_updated_at
BEFORE UPDATE ON "ContentReaction"
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
