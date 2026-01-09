/**
 * Seed script for ePaper Block Templates
 * Creates default global block templates for newspaper design
 *
 * Run: npx ts-node scripts/seed_epaper_block_templates.ts
 */

import { PrismaClient, EpaperBlockCategory, EpaperBlockSubCategory, EpaperBlockStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// BLOCK TEMPLATE DEFINITIONS
// ============================================================================

interface ComponentStyle {
  font?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  lineHeight?: number;
  textAlign?: string;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
}

interface ComponentRules {
  maxLines?: number;
  maxWordsPerLine?: number;
  minItems?: number;
  maxItems?: number;
  maxCharsPerItem?: number;
  maxLinesPerItem?: number;
  minWords?: number;
  maxWords?: number;
  columnCount?: number;
  overflow?: 'truncate_ellipsis' | 'shrink_font' | 'continue_next_block' | 'continue_next_page';
  required?: boolean;
  aspectRatio?: string;
  wrapAroundImage?: boolean;
}

interface BlockComponent {
  enabled: boolean;
  position?: string;
  style: ComponentStyle;
  rules?: ComponentRules;
}

interface BlockComponents {
  title?: BlockComponent;
  subTitle?: BlockComponent;
  highlight?: BlockComponent;
  highlightList?: BlockComponent;
  image?: BlockComponent & { style: ComponentStyle & { width?: number | 'full'; maxHeight?: number; fit?: string } };
  dateline?: BlockComponent & { style: ComponentStyle & { format?: string } };
  body?: BlockComponent;
  continuationTag?: BlockComponent;
  subHeadlineBox?: BlockComponent;
  borders?: {
    top?: { enabled: boolean; style: string; width: number; color: string };
    right?: { enabled: boolean; style: string; width: number; color: string };
    bottom?: { enabled: boolean; style: string; width: number; color: string };
    left?: { enabled: boolean; style: string; width: number; color: string };
  };
  spacing?: {
    componentGap?: number;
    padding?: { top: number; right: number; bottom: number; left: number };
  };
}

interface BlockTemplateData {
  code: string;
  name: string;
  description: string;
  category: EpaperBlockCategory;
  subCategory: EpaperBlockSubCategory;
  columns: number;
  widthInches: number;
  minHeightInches?: number;
  maxHeightInches: number;
  components: BlockComponents;
}

// ============================================================================
// 2-COLUMN COMPACT BLOCK (Based on Image 1)
// ============================================================================
const BT_2COL_COMPACT: BlockTemplateData = {
  code: 'BT_2COL_COMPACT',
  name: '2-Column Compact News',
  description: 'Small news block with title, single highlight, optional right-aligned image, and body text that wraps around image',
  category: EpaperBlockCategory.CONTENT,
  subCategory: EpaperBlockSubCategory.COL_2,
  columns: 2,
  widthInches: 2,
  minHeightInches: 2,
  maxHeightInches: 4,
  components: {
    title: {
      enabled: true,
      position: 'top',
      style: {
        font: 'NotoSerifTelugu-Bold',
        fontSize: 24,
        color: '#C41E3A',
        lineHeight: 1.2,
        textAlign: 'left',
      },
      rules: {
        maxLines: 2,
        maxWordsPerLine: 3,
        overflow: 'truncate_ellipsis',
      },
    },
    highlight: {
      enabled: true,
      position: 'below_title',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSize: 12,
        color: '#C41E3A',
        lineHeight: 1.3,
      },
      rules: {
        maxItems: 1,
        maxLinesPerItem: 2,
      },
    },
    image: {
      enabled: true,
      position: 'right',
      style: {
        width: 1.5,
        maxHeight: 2,
        fit: 'cover',
      },
      rules: {
        required: false,
        aspectRatio: '3:4',
      },
    },
    dateline: {
      enabled: true,
      position: 'body_start',
      style: {
        font: 'NotoSerifTelugu-Bold',
        fontSize: 11,
        color: '#000000',
        format: '{city}, {source}:',
      },
    },
    body: {
      enabled: true,
      position: 'below_highlight',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSize: 11,
        color: '#000000',
        lineHeight: 1.5,
        textAlign: 'justify',
      },
      rules: {
        minWords: 80,
        maxWords: 200,
        columnCount: 1,
        wrapAroundImage: true,
        overflow: 'truncate_ellipsis',
      },
    },
    borders: {
      bottom: {
        enabled: true,
        style: 'solid',
        width: 0.5,
        color: '#CCCCCC',
      },
    },
    spacing: {
      componentGap: 0.1,
      padding: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
    },
  },
};

// ============================================================================
// 4-COLUMN HIGHLIGHT BLOCK (Based on Image 2)
// ============================================================================
const BT_4COL_HIGHLIGHT: BlockTemplateData = {
  code: 'BT_4COL_HIGHLIGHT',
  name: '4-Column with Highlight List',
  description: 'Medium news block with large title, multiple bullet highlights, image below highlights, and 2-column body text',
  category: EpaperBlockCategory.CONTENT,
  subCategory: EpaperBlockSubCategory.COL_4,
  columns: 4,
  widthInches: 4,
  minHeightInches: 4,
  maxHeightInches: 6,
  components: {
    title: {
      enabled: true,
      position: 'top',
      style: {
        font: 'NotoSerifTelugu-ExtraBold',
        fontSize: 32,
        color: '#C41E3A',
        lineHeight: 1.1,
        textAlign: 'left',
      },
      rules: {
        maxLines: 1,
        maxWordsPerLine: 5,
        overflow: 'shrink_font',
      },
    },
    highlightList: {
      enabled: true,
      position: 'below_title',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSize: 12,
        color: '#000000',
        lineHeight: 1.3,
      },
      rules: {
        minItems: 2,
        maxItems: 5,
        maxLinesPerItem: 2,
        maxCharsPerItem: 60,
      },
    },
    image: {
      enabled: true,
      position: 'below_highlights',
      style: {
        width: 'full',
        maxHeight: 2.5,
        fit: 'cover',
      },
      rules: {
        required: true,
        aspectRatio: '16:9',
      },
    },
    dateline: {
      enabled: true,
      position: 'body_start',
      style: {
        font: 'NotoSerifTelugu-Bold',
        fontSize: 11,
        color: '#000000',
        format: '{city}, {source}:',
      },
    },
    body: {
      enabled: true,
      position: 'below_image',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSize: 11,
        color: '#000000',
        lineHeight: 1.5,
        textAlign: 'justify',
      },
      rules: {
        minWords: 200,
        maxWords: 500,
        columnCount: 2,
        overflow: 'continue_next_block',
      },
    },
    borders: {
      left: {
        enabled: true,
        style: 'solid',
        width: 2,
        color: '#C41E3A',
      },
    },
    spacing: {
      componentGap: 0.12,
      padding: { top: 0.1, right: 0.1, bottom: 0.15, left: 0.15 },
    },
  },
};

// ============================================================================
// 6-COLUMN FEATURE BLOCK (Based on Image 3)
// ============================================================================
const BT_6COL_FEATURE: BlockTemplateData = {
  code: 'BT_6COL_FEATURE',
  name: '6-Column Feature Story',
  description: 'Large feature story with hero title, optional continuation tag, large image, sub-headline box, and 3-column body',
  category: EpaperBlockCategory.CONTENT,
  subCategory: EpaperBlockSubCategory.COL_6,
  columns: 6,
  widthInches: 6,
  minHeightInches: 6,
  maxHeightInches: 10,
  components: {
    title: {
      enabled: true,
      position: 'top',
      style: {
        font: 'NotoSerifTelugu-Black',
        fontSize: 36,
        color: '#C41E3A',
        lineHeight: 1.1,
        textAlign: 'left',
      },
      rules: {
        maxLines: 1,
        maxWordsPerLine: 6,
        overflow: 'shrink_font',
      },
    },
    continuationTag: {
      enabled: true,
      position: 'below_title',
      style: {
        font: 'NotoSerifTelugu-Italic',
        fontSize: 10,
        color: '#666666',
      },
      rules: {
        // Only shown when article is continuation from another page
      },
    },
    image: {
      enabled: true,
      position: 'center',
      style: {
        width: 'full',
        maxHeight: 3,
        fit: 'cover',
      },
      rules: {
        required: true,
        aspectRatio: '16:9',
      },
    },
    subHeadlineBox: {
      enabled: true,
      position: 'below_image',
      style: {
        backgroundColor: '#1E4DB7',
        font: 'NotoSerifTelugu-Bold',
        fontSize: 14,
        color: '#FFFFFF',
        padding: { top: 0.08, right: 0.15, bottom: 0.08, left: 0.15 },
        textAlign: 'left',
      },
      rules: {
        maxLines: 1,
        maxWordsPerLine: 12,
      },
    },
    body: {
      enabled: true,
      position: 'below_subheadline',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSize: 11,
        color: '#000000',
        lineHeight: 1.5,
        textAlign: 'justify',
      },
      rules: {
        minWords: 400,
        maxWords: 1000,
        columnCount: 3,
        overflow: 'continue_next_page',
      },
    },
    borders: {
      bottom: {
        enabled: true,
        style: 'double',
        width: 2,
        color: '#000000',
      },
    },
    spacing: {
      componentGap: 0.12,
      padding: { top: 0.1, right: 0.1, bottom: 0.15, left: 0.1 },
    },
  },
};

// ============================================================================
// 10-COLUMN HERO BLOCK
// ============================================================================
const BT_10COL_HERO: BlockTemplateData = {
  code: 'BT_10COL_HERO',
  name: '10-Column Hero News',
  description: 'Large hero block for main page, full-width headline with large image and prominent body text',
  category: EpaperBlockCategory.CONTENT,
  subCategory: EpaperBlockSubCategory.COL_10,
  columns: 10,
  widthInches: 10,
  minHeightInches: 8,
  maxHeightInches: 12,
  components: {
    title: {
      enabled: true,
      position: 'top',
      style: {
        font: 'NotoSerifTelugu-Black',
        fontSize: 48,
        color: '#C41E3A',
        lineHeight: 1.0,
        textAlign: 'center',
      },
      rules: {
        maxLines: 2,
        maxWordsPerLine: 6,
        overflow: 'shrink_font',
      },
    },
    subTitle: {
      enabled: true,
      position: 'below_title',
      style: {
        font: 'NotoSerifTelugu-SemiBold',
        fontSize: 20,
        color: '#333333',
        lineHeight: 1.2,
        textAlign: 'center',
      },
      rules: {
        maxLines: 2,
      },
    },
    image: {
      enabled: true,
      position: 'below_subtitle',
      style: {
        width: 'full',
        maxHeight: 5,
        fit: 'cover',
      },
      rules: {
        required: true,
        aspectRatio: '16:9',
      },
    },
    highlightList: {
      enabled: true,
      position: 'below_image',
      style: {
        font: 'NotoSerifTelugu-Medium',
        fontSize: 14,
        color: '#000000',
        lineHeight: 1.4,
      },
      rules: {
        maxItems: 5,
        maxLinesPerItem: 1,
      },
    },
    dateline: {
      enabled: true,
      position: 'body_start',
      style: {
        font: 'NotoSerifTelugu-Bold',
        fontSize: 12,
        color: '#000000',
        format: '{city}, {source}:',
      },
    },
    body: {
      enabled: true,
      position: 'below_highlights',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSize: 12,
        color: '#000000',
        lineHeight: 1.6,
        textAlign: 'justify',
      },
      rules: {
        minWords: 500,
        maxWords: 1500,
        columnCount: 4,
        overflow: 'continue_next_page',
      },
    },
    borders: {
      bottom: {
        enabled: true,
        style: 'solid',
        width: 3,
        color: '#C41E3A',
      },
    },
    spacing: {
      componentGap: 0.15,
      padding: { top: 0.15, right: 0.15, bottom: 0.2, left: 0.15 },
    },
  },
};

// ============================================================================
// 12-COLUMN FULL-WIDTH BLOCK
// ============================================================================
const BT_12COL_BANNER: BlockTemplateData = {
  code: 'BT_12COL_BANNER',
  name: '12-Column Full Width Banner',
  description: 'Full-width banner block for top stories with maximum visual impact',
  category: EpaperBlockCategory.CONTENT,
  subCategory: EpaperBlockSubCategory.COL_12,
  columns: 12,
  widthInches: 12,
  minHeightInches: 10,
  maxHeightInches: 12,
  components: {
    title: {
      enabled: true,
      position: 'top',
      style: {
        font: 'NotoSerifTelugu-Black',
        fontSize: 56,
        color: '#C41E3A',
        lineHeight: 1.0,
        textAlign: 'center',
      },
      rules: {
        maxLines: 2,
        maxWordsPerLine: 8,
        overflow: 'shrink_font',
      },
    },
    subTitle: {
      enabled: true,
      position: 'below_title',
      style: {
        font: 'NotoSerifTelugu-SemiBold',
        fontSize: 24,
        color: '#333333',
        lineHeight: 1.2,
        textAlign: 'center',
      },
      rules: {
        maxLines: 2,
      },
    },
    image: {
      enabled: true,
      position: 'below_subtitle',
      style: {
        width: 'full',
        maxHeight: 6,
        fit: 'cover',
      },
      rules: {
        required: true,
        aspectRatio: '21:9',
      },
    },
    body: {
      enabled: true,
      position: 'below_image',
      style: {
        font: 'NotoSerifTelugu-Regular',
        fontSize: 13,
        color: '#000000',
        lineHeight: 1.6,
        textAlign: 'justify',
      },
      rules: {
        minWords: 600,
        maxWords: 2000,
        columnCount: 5,
        overflow: 'continue_next_page',
      },
    },
    spacing: {
      componentGap: 0.2,
      padding: { top: 0.2, right: 0.2, bottom: 0.25, left: 0.2 },
    },
  },
};

// ============================================================================
// MAIN PAGE HEADER (3-inch)
// ============================================================================
const BT_MAIN_HEADER: BlockTemplateData = {
  code: 'BT_MAIN_HEADER',
  name: 'Main Page Header (Masthead)',
  description: '3-inch header for Page 1 with newspaper logo, date, edition info, and tagline',
  category: EpaperBlockCategory.HEADER,
  subCategory: EpaperBlockSubCategory.MAIN_HEADER,
  columns: 12,
  widthInches: 12,
  minHeightInches: 3,
  maxHeightInches: 3,
  components: {
    // Main header is typically designed as a single image/SVG template
    // with placeholders for dynamic content
    title: {
      enabled: true,
      position: 'center',
      style: {
        font: 'NotoSerifTelugu-Black',
        fontSize: 72,
        color: '#C41E3A',
        textAlign: 'center',
      },
      rules: {
        maxLines: 1,
      },
    },
    spacing: {
      padding: { top: 0.1, right: 0.5, bottom: 0.1, left: 0.5 },
    },
  },
};

// ============================================================================
// INNER PAGE HEADER (1-inch)
// ============================================================================
const BT_INNER_HEADER: BlockTemplateData = {
  code: 'BT_INNER_HEADER',
  name: 'Inner Page Header',
  description: '1-inch compact header for Page 2+ with newspaper name, date, and page number',
  category: EpaperBlockCategory.HEADER,
  subCategory: EpaperBlockSubCategory.INNER_HEADER,
  columns: 12,
  widthInches: 12,
  minHeightInches: 1,
  maxHeightInches: 1,
  components: {
    title: {
      enabled: true,
      position: 'left',
      style: {
        font: 'NotoSerifTelugu-Bold',
        fontSize: 24,
        color: '#000000',
        textAlign: 'left',
      },
      rules: {
        maxLines: 1,
      },
    },
    spacing: {
      padding: { top: 0.1, right: 0.25, bottom: 0.1, left: 0.25 },
    },
  },
};

// ============================================================================
// STANDARD FOOTER
// ============================================================================
const BT_STANDARD_FOOTER: BlockTemplateData = {
  code: 'BT_STANDARD_FOOTER',
  name: 'Standard Page Footer',
  description: 'Standard footer with decorative dots pattern',
  category: EpaperBlockCategory.FOOTER,
  subCategory: EpaperBlockSubCategory.STANDARD_FOOTER,
  columns: 12,
  widthInches: 12,
  minHeightInches: 0.5,
  maxHeightInches: 0.5,
  components: {
    // Footer is typically a decorative element
    spacing: {
      padding: { top: 0.1, right: 0.5, bottom: 0.1, left: 0.5 },
    },
  },
};

// ============================================================================
// LAST PAGE FOOTER (with printer info)
// ============================================================================
const BT_LAST_PAGE_FOOTER: BlockTemplateData = {
  code: 'BT_LAST_PAGE_FOOTER',
  name: 'Last Page Footer (Printer Info)',
  description: 'Last page footer with printer/publisher information for PRGI compliance',
  category: EpaperBlockCategory.FOOTER,
  subCategory: EpaperBlockSubCategory.LAST_PAGE_FOOTER,
  columns: 12,
  widthInches: 12,
  minHeightInches: 0.75,
  maxHeightInches: 1,
  components: {
    body: {
      enabled: true,
      position: 'center',
      style: {
        font: 'NotoSans-Regular',
        fontSize: 8,
        color: '#333333',
        textAlign: 'center',
        lineHeight: 1.3,
      },
      rules: {
        maxLines: 3,
      },
    },
    spacing: {
      padding: { top: 0.1, right: 0.5, bottom: 0.1, left: 0.5 },
    },
  },
};

// ============================================================================
// ALL TEMPLATES TO SEED
// ============================================================================
const ALL_TEMPLATES: BlockTemplateData[] = [
  BT_2COL_COMPACT,
  BT_4COL_HIGHLIGHT,
  BT_6COL_FEATURE,
  BT_10COL_HERO,
  BT_12COL_BANNER,
  BT_MAIN_HEADER,
  BT_INNER_HEADER,
  BT_STANDARD_FOOTER,
  BT_LAST_PAGE_FOOTER,
];

// ============================================================================
// SEED FUNCTION
// ============================================================================
async function seedEpaperBlockTemplates() {
  console.log('🚀 Seeding ePaper Block Templates...\n');

  for (const template of ALL_TEMPLATES) {
    const existing = await prisma.epaperBlockTemplate.findUnique({
      where: { code: template.code },
    });

    if (existing) {
      console.log(`⏭️  Skipping ${template.code} (already exists)`);
      continue;
    }

    await prisma.epaperBlockTemplate.create({
      data: {
        code: template.code,
        name: template.name,
        description: template.description,
        category: template.category,
        subCategory: template.subCategory,
        columns: template.columns,
        widthInches: template.widthInches,
        minHeightInches: template.minHeightInches,
        maxHeightInches: template.maxHeightInches,
        components: template.components as any,
        isLocked: true, // Global templates are pre-locked
        status: EpaperBlockStatus.ACTIVE,
        isGlobal: true,
        tenantId: null,
      },
    });

    console.log(`✅ Created ${template.code}: ${template.name}`);
  }

  console.log('\n✨ ePaper Block Templates seeding complete!');
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  try {
    await seedEpaperBlockTemplates();
  } catch (error) {
    console.error('❌ Error seeding ePaper block templates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
