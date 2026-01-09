/**
 * ePaper Block Template Types
 * Defines the JSON structure for block template components
 */

// ============================================================================
// STYLE TYPES
// ============================================================================

export interface Padding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface FontStyle {
  font: string;
  fontSize: number;
  color: string;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  backgroundColor?: string;
  padding?: Padding;
}

export interface BorderStyle {
  enabled: boolean;
  style: 'solid' | 'dashed' | 'dotted' | 'double';
  width: number;
  color: string;
}

export interface Borders {
  top?: BorderStyle;
  right?: BorderStyle;
  bottom?: BorderStyle;
  left?: BorderStyle;
}

export interface Spacing {
  componentGap?: number;
  padding?: Padding;
}

// ============================================================================
// COMPONENT RULE TYPES
// ============================================================================

export type OverflowBehavior =
  | 'truncate_ellipsis'
  | 'shrink_font'
  | 'continue_next_block'
  | 'continue_next_page';

export interface TextRules {
  maxLines?: number;
  maxWordsPerLine?: number;
  minWords?: number;
  maxWords?: number;
  overflow?: OverflowBehavior;
}

export interface ListRules {
  minItems?: number;
  maxItems?: number;
  maxLinesPerItem?: number;
  maxCharsPerItem?: number;
}

export interface ImageRules {
  required?: boolean;
  aspectRatio?: string; // e.g., '16:9', '3:4'
}

export interface BodyRules extends TextRules {
  columnCount?: number;
  wrapAroundImage?: boolean;
}

// ============================================================================
// COMPONENT TYPES
// ============================================================================

export interface TitleComponent {
  enabled: boolean;
  position: 'top' | 'center' | 'left' | 'right';
  style: FontStyle;
  rules: TextRules;
}

export interface SubTitleComponent {
  enabled: boolean;
  position: 'below_title';
  style: FontStyle;
  rules: TextRules;
}

export interface HighlightComponent {
  enabled: boolean;
  position: 'below_title' | 'below_subtitle';
  style: FontStyle & {
    bulletColor?: string;
    bulletType?: 'filled_circle' | 'empty_circle' | 'dash' | 'arrow';
    bulletSize?: number;
  };
  rules: ListRules;
}

export interface HighlightListComponent {
  enabled: boolean;
  position: 'below_title' | 'below_subtitle' | 'below_image';
  style: FontStyle & {
    itemSpacing?: number;
  };
  rules: ListRules;
}

export interface ImageComponent {
  enabled: boolean;
  position: 'top' | 'right' | 'left' | 'center' | 'below_title' | 'below_subtitle' | 'below_highlights';
  style: {
    width: number | 'full';
    maxHeight: number;
    fit: 'cover' | 'contain' | 'fill';
    borderRadius?: number;
  };
  rules: ImageRules;
}

export interface DatelineComponent {
  enabled: boolean;
  position: 'body_start' | 'below_title' | 'below_image';
  style: FontStyle & {
    format: string; // e.g., '{city}, {source}:'
  };
}

export interface BodyComponent {
  enabled: boolean;
  position: 'below_title' | 'below_highlight' | 'below_image' | 'below_subheadline';
  style: FontStyle & {
    columnGap?: number;
  };
  rules: BodyRules;
}

export interface ContinuationTagComponent {
  enabled: boolean;
  position: 'below_title';
  style: FontStyle;
  rules?: {
    showWhen?: 'is_continuation';
  };
}

export interface SubHeadlineBoxComponent {
  enabled: boolean;
  position: 'below_image' | 'below_highlights';
  style: FontStyle;
  rules: TextRules;
}

// ============================================================================
// BLOCK COMPONENTS (Main JSON structure)
// ============================================================================

export interface BlockComponents {
  title?: TitleComponent;
  subTitle?: SubTitleComponent;
  highlight?: HighlightComponent;
  highlightList?: HighlightListComponent;
  image?: ImageComponent;
  dateline?: DatelineComponent;
  body?: BodyComponent;
  continuationTag?: ContinuationTagComponent;
  subHeadlineBox?: SubHeadlineBoxComponent;
  borders?: Borders;
  spacing?: Spacing;
}

// ============================================================================
// RENDERED CONTENT (Output after processing)
// ============================================================================

export interface RenderedTitle {
  lines: string[];
  originalText: string;
  truncated: boolean;
}

export interface RenderedHighlight {
  text: string;
  lines: string[];
}

export interface RenderedHighlightList {
  items: RenderedHighlight[];
  truncatedCount: number;
}

export interface RenderedImage {
  url: string;
  width: number;
  height: number;
  alt?: string;
}

export interface RenderedDateline {
  text: string; // Final formatted text
  city?: string;
  source?: string;
  date?: string;
}

export interface RenderedBody {
  text: string;
  columnCount: number;
  overflow: boolean;
  overflowText?: string; // Text that didn't fit (for continuation)
}

export interface RenderedContent {
  title?: RenderedTitle;
  subTitle?: RenderedTitle;
  highlight?: RenderedHighlight;
  highlightList?: RenderedHighlightList;
  image?: RenderedImage;
  dateline?: RenderedDateline;
  body?: RenderedBody;
  continuationTag?: { text: string; show: boolean };
  subHeadlineBox?: RenderedTitle;
}

// ============================================================================
// BLOCK SUGGESTION THRESHOLDS
// ============================================================================

export interface BlockSuggestionThreshold {
  minChars: number;
  maxChars: number;
  hasImage: boolean;
  hasHighlights: boolean;
  suggestedBlockCode: string;
}

export const BLOCK_SUGGESTION_THRESHOLDS: BlockSuggestionThreshold[] = [
  { minChars: 0, maxChars: 500, hasImage: false, hasHighlights: false, suggestedBlockCode: 'BT_2COL_COMPACT' },
  { minChars: 0, maxChars: 800, hasImage: true, hasHighlights: false, suggestedBlockCode: 'BT_2COL_COMPACT' },
  { minChars: 500, maxChars: 1500, hasImage: false, hasHighlights: false, suggestedBlockCode: 'BT_4COL_HIGHLIGHT' },
  { minChars: 500, maxChars: 1500, hasImage: true, hasHighlights: true, suggestedBlockCode: 'BT_4COL_HIGHLIGHT' },
  { minChars: 1500, maxChars: 3000, hasImage: true, hasHighlights: false, suggestedBlockCode: 'BT_6COL_FEATURE' },
  { minChars: 1500, maxChars: 3000, hasImage: true, hasHighlights: true, suggestedBlockCode: 'BT_6COL_FEATURE' },
  { minChars: 3000, maxChars: 5000, hasImage: true, hasHighlights: true, suggestedBlockCode: 'BT_10COL_HERO' },
  { minChars: 5000, maxChars: Infinity, hasImage: true, hasHighlights: true, suggestedBlockCode: 'BT_12COL_BANNER' },
];

// ============================================================================
// EPAPER SETTINGS GENERATION CONFIG
// ============================================================================

export interface GenerationConfig {
  autoGenerate: boolean;
  scheduleTime: string; // HH:MM format
  timezone: string; // e.g., 'Asia/Kolkata'
  autoPublish: boolean;
}

// ============================================================================
// PAGE LAYOUT TYPES
// ============================================================================

export interface PagePosition {
  x: number; // inches from left (after padding)
  y: number; // inches from top (after padding)
  width: number; // inches
  height: number; // inches
}

export interface PageBlock {
  articleId: string | null;
  blockTemplateId: string;
  position: PagePosition;
  renderedContent: RenderedContent | null;
  isHeader: boolean;
  isFooter: boolean;
  sortOrder: number;
}

export interface PageLayout {
  pageNumber: number;
  headerBlock?: PageBlock;
  footerBlock?: PageBlock;
  contentBlocks: PageBlock[];
  totalHeight: number;
  usedHeight: number;
  remainingHeight: number;
}

export interface EditionLayout {
  editionId: string;
  tenantId: string;
  editionDate: Date;
  totalPages: number;
  pages: PageLayout[];
}
