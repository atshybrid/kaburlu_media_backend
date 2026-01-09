-- Style2 Homepage Layout Enhancements
-- Add sectionType and queryKind columns for more flexible homepage configuration

-- Add sectionType column to HomepageSectionConfig for style2 section types
-- Section types: hero_sidebar, category_boxes_3col, small_cards_3col, magazine_grid, 
-- horizontal_scroll, spotlight, newspaper_columns, horizontal_cards, photo_gallery, 
-- timeline, featured_banner, compact_lists_2col
ALTER TABLE "HomepageSectionConfig" ADD COLUMN IF NOT EXISTS "sectionType" TEXT DEFAULT 'category_cards';

-- Add queryKind column for special queries (latest, trending, most_viewed) vs category-based
-- Query kinds: category, latest, trending, most_viewed
ALTER TABLE "HomepageSectionConfig" ADD COLUMN IF NOT EXISTS "queryKind" TEXT DEFAULT 'category';

-- Add secondary categories for sections that need multiple categories (like hero_sidebar)
ALTER TABLE "HomepageSectionConfig" ADD COLUMN IF NOT EXISTS "secondaryCategoryId" TEXT;
ALTER TABLE "HomepageSectionConfig" ADD COLUMN IF NOT EXISTS "secondaryCategorySlug" TEXT;
ALTER TABLE "HomepageSectionConfig" ADD COLUMN IF NOT EXISTS "tertiaryCategoryId" TEXT;
ALTER TABLE "HomepageSectionConfig" ADD COLUMN IF NOT EXISTS "tertiaryCategorySlug" TEXT;

-- Add categories array for multi-category sections (stored as JSON array of slugs)
ALTER TABLE "HomepageSectionConfig" ADD COLUMN IF NOT EXISTS "categorySlugs" JSONB;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "HomepageSectionConfig_sectionType_idx" ON "HomepageSectionConfig"("sectionType");
CREATE INDEX IF NOT EXISTS "HomepageSectionConfig_queryKind_idx" ON "HomepageSectionConfig"("queryKind");

-- Add foreign key constraints for secondary and tertiary categories (ignore if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomepageSectionConfig_secondaryCategoryId_fkey'
  ) THEN
    ALTER TABLE "HomepageSectionConfig" 
      ADD CONSTRAINT "HomepageSectionConfig_secondaryCategoryId_fkey" 
      FOREIGN KEY ("secondaryCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomepageSectionConfig_tertiaryCategoryId_fkey'
  ) THEN
    ALTER TABLE "HomepageSectionConfig" 
      ADD CONSTRAINT "HomepageSectionConfig_tertiaryCategoryId_fkey" 
      FOREIGN KEY ("tertiaryCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
