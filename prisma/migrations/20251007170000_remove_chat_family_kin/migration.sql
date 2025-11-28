-- Drop obsolete ChatInterest, Family / Kin tables & enum
-- Guard existence to be idempotent (for safety in manual application)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ChatInterest') THEN
    DROP TABLE "public"."ChatInterest";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FamilyMember') THEN
    DROP TABLE "public"."FamilyMember";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FamilyRelation') THEN
    DROP TABLE "public"."FamilyRelation";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Family') THEN
    DROP TABLE "public"."Family";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'KinRelation') THEN
    DROP TABLE "public"."KinRelation";
  END IF;
  -- Drop enum if exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FamilyRelationType') THEN
    DROP TYPE "public"."FamilyRelationType";
  END IF;
END $$;
