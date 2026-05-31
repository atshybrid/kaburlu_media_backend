/**
 * Seed EpaperHeaderStyle from headerStyleCatalog.ts
 * Run: npx ts-node scripts/seed_epaper_header_styles.ts
 */
import prisma from '../src/lib/prisma';
import { ALL_HEADER_STYLES } from '../src/lib/epaper/headerStyleCatalog';

async function main() {
  for (const s of ALL_HEADER_STYLES) {
    await prisma.epaperHeaderStyle.upsert({
      where: { key: s.key },
      create: {
        number: s.number,
        type: s.type,
        key: s.key,
        slug: s.slug,
        name: s.name,
        nameTe: s.nameTe ?? null,
        supportsCenterLogo: s.supportsCenterLogo,
        supportsLeftImage: s.supportsLeftImage,
        supportsRightImage: s.supportsRightImage,
        supportsPaperNameImage: s.supportsPaperNameImage,
        supportsSubHeaderCenterImage: s.supportsSubHeaderCenterImage,
      },
      update: {
        number: s.number,
        type: s.type,
        slug: s.slug,
        name: s.name,
        nameTe: s.nameTe ?? null,
        supportsCenterLogo: s.supportsCenterLogo,
        supportsLeftImage: s.supportsLeftImage,
        supportsRightImage: s.supportsRightImage,
        supportsPaperNameImage: s.supportsPaperNameImage,
        supportsSubHeaderCenterImage: s.supportsSubHeaderCenterImage,
      },
    });
  }
  console.log(`Seeded ${ALL_HEADER_STYLES.length} header styles`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
