/**
 * Seed BLOCK-04A template (4 inch compact news block).
 * Run: npx ts-node scripts/seed_block_04a.ts
 */

import { PrismaClient, EpaperBlockCategory, EpaperBlockSubCategory, EpaperBlockStatus } from '@prisma/client';

const prisma = new PrismaClient();

const BLOCK_04A = {
  code: 'BLOCK-04A',
  name: '4-inch Compact News (BLOCK-04A)',
  description: '4 inch × max 7 inch — centered title, optional subtitle, image, 2 highlights, single-column body. 50–150 words.',
  category: EpaperBlockCategory.CONTENT,
  subCategory: EpaperBlockSubCategory.COL_4,
  columns: 2,
  widthInches: 4,
  minHeightInches: 2,
  maxHeightInches: 7,
  components: {
    physical: {
      widthMm: 101.6,
      maxHeightMm: 177.8,
      background: '#ffffff',
      overflow: 'hidden',
    },
    validation: {
      minWords: 50,
      maxWords: 150,
      rejectAboveMax: true,
    },
    title: {
      enabled: true,
      position: 'top',
      style: {
        font: 'NotoSerifTelugu-Bold',
        fontSizeMin: 38,
        fontSizeMax: 58,
        color: '#000000',
        lineHeight: 1.2,
        textAlign: 'center',
        fontWeight: 'bold',
      },
      rules: { maxLines: 2, overflow: 'truncate_ellipsis' },
    },
    subTitle: {
      enabled: true,
      position: 'below_title',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSizeRatio: 0.5,
        color: '#333333',
        lineHeight: 1.2,
        textAlign: 'center',
      },
      rules: { maxLines: 2, optional: true },
    },
    image: {
      enabled: true,
      position: 'below_subtitle',
      style: { width: 'full', fit: 'cover', aspectRatio: '16:10' },
      rules: { required: false, maxCount: 1 },
    },
    highlightList: {
      enabled: true,
      position: 'below_image',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSize: 11,
        textAlign: 'center',
        separator: 'dashed',
      },
      rules: { maxItems: 2 },
    },
    dateline: {
      enabled: true,
      position: 'body_start',
      style: { font: 'NotoSerifTelugu-Bold', fontSize: 10, format: '{place} ({publisher}), {date}' },
    },
    body: {
      enabled: true,
      position: 'below_highlights',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSize: 11,
        lineHeight: 14,
        textAlign: 'justify',
        hyphens: true,
      },
      rules: { columnCount: 1, minWords: 50, maxWords: 150 },
    },
    spacing: { componentGapPx: 5, paddingMm: 2 },
  },
};

async function main() {
  const existing = await prisma.epaperBlockTemplate.findUnique({ where: { code: BLOCK_04A.code } });
  if (existing) {
    await prisma.epaperBlockTemplate.update({
      where: { code: BLOCK_04A.code },
      data: {
        name: BLOCK_04A.name,
        description: BLOCK_04A.description,
        category: BLOCK_04A.category,
        subCategory: BLOCK_04A.subCategory,
        columns: BLOCK_04A.columns,
        widthInches: BLOCK_04A.widthInches,
        minHeightInches: BLOCK_04A.minHeightInches,
        maxHeightInches: BLOCK_04A.maxHeightInches,
        components: BLOCK_04A.components as any,
        status: EpaperBlockStatus.ACTIVE,
        isGlobal: true,
        isLocked: true,
      },
    });
    console.log('✅ Updated BLOCK-04A');
  } else {
    await prisma.epaperBlockTemplate.create({
      data: {
        ...BLOCK_04A,
        components: BLOCK_04A.components as any,
        status: EpaperBlockStatus.ACTIVE,
        isGlobal: true,
        isLocked: true,
        tenantId: null,
      },
    });
    console.log('✅ Created BLOCK-04A');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
