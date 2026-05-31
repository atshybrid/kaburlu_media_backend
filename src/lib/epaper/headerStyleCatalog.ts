/**
 * Canonical ePaper header / sub-header style catalog.
 * Stored in DB (EpaperHeaderStyle); this module is the source for seed + runtime validation.
 */

export type HeaderStyleType = 'MAIN' | 'SUB';

export type HeaderStyleDefinition = {
  number: number;
  key: string;
  slug: string;
  name: string;
  nameTe?: string;
  type: HeaderStyleType;
  supportsCenterLogo: boolean;
  supportsLeftImage: boolean;
  supportsRightImage: boolean;
  supportsPaperNameImage: boolean;
  supportsSubHeaderCenterImage: boolean;
};

export const MAIN_HEADER_STYLES: HeaderStyleDefinition[] = [
  { number: 1, key: 'main_style1', slug: 'classic_3_col_info_bar', name: 'Classic 3-Col + Info Bar', nameTe: 'క్లాసిక్ 3-కాలమ్ + ఇన్ఫో బార్', type: 'MAIN', supportsCenterLogo: true, supportsLeftImage: true, supportsRightImage: true, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
  { number: 2, key: 'main_style2', slug: 'prabha_3_col_meta_strip', name: 'Prabha 3-Col + Meta Strip', nameTe: 'ప్రభ 3-కాలమ్ + మెటా స్ట్రిప్', type: 'MAIN', supportsCenterLogo: true, supportsLeftImage: true, supportsRightImage: true, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
  { number: 3, key: 'main_style3', slug: 'minimal_white_left_align', name: 'Minimal White Left-Align', nameTe: 'మినిమల్ వైట్ ఎడమ అలైన్', type: 'MAIN', supportsCenterLogo: false, supportsLeftImage: true, supportsRightImage: false, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
  { number: 4, key: 'main_style4', slug: 'red_crimson_banner', name: 'Red / Crimson Banner', nameTe: 'ఎరుపు / క్రిమ్సన్ బ్యానర్', type: 'MAIN', supportsCenterLogo: true, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
  { number: 5, key: 'main_style5', slug: 'split_name_ad_panel', name: 'Split — Name + Ad Panel', nameTe: 'స్ప్లిట్ — పేరు + ప్రకటన ప్యానెల్', type: 'MAIN', supportsCenterLogo: true, supportsLeftImage: true, supportsRightImage: true, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
  { number: 6, key: 'main_style6', slug: 'traditional_telugu_ornament', name: 'Traditional Telugu Ornament', nameTe: 'సాంప్రదాయ తెలుగు అలంకరణ', type: 'MAIN', supportsCenterLogo: true, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
  { number: 7, key: 'main_style7', slug: 'black_gold_premium', name: 'Black / Gold Premium', nameTe: 'నలుపు / బంగారం ప్రీమియం', type: 'MAIN', supportsCenterLogo: true, supportsLeftImage: true, supportsRightImage: true, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
  { number: 8, key: 'main_style8', slug: 'blue_gradient', name: 'Blue Gradient', nameTe: 'నీలం గ్రేడియంట్', type: 'MAIN', supportsCenterLogo: true, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
  { number: 9, key: 'main_style9', slug: 'heavy_rules_gothic', name: 'Heavy Rules / Newspaper Gothic', nameTe: 'హెవీ రూల్స్ / న్యూస్‌పేపర్ గాథిక్', type: 'MAIN', supportsCenterLogo: true, supportsLeftImage: true, supportsRightImage: true, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
  { number: 10, key: 'main_style10', slug: 'modern_color_stripe', name: 'Modern Color Stripe', nameTe: 'మోడరన్ కలర్ స్ట్రైప్', type: 'MAIN', supportsCenterLogo: true, supportsLeftImage: true, supportsRightImage: true, supportsPaperNameImage: true, supportsSubHeaderCenterImage: false },
];

export const SUB_HEADER_STYLES: HeaderStyleDefinition[] = [
  { number: 1, key: 'sub_header_style1', slug: 'page_logo_date', name: 'Page · Logo · Date', nameTe: 'పేజీ · లోగో · తేదీ', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: false, supportsSubHeaderCenterImage: true },
  { number: 2, key: 'sub_header_style2', slug: 'full_color_bar', name: 'Full Color Bar', nameTe: 'పూర్తి రంగు బార్', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: false, supportsSubHeaderCenterImage: true },
  { number: 3, key: 'sub_header_style3', slug: 'slim_rule_line', name: 'Slim Rule Line', nameTe: 'సన్నని రేఖ', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: false, supportsSubHeaderCenterImage: false },
  { number: 4, key: 'sub_header_style4', slug: 'edition_name_strip', name: 'Edition Name Strip', nameTe: 'ఎడిషన్ పేరు స్ట్రిప్', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: false, supportsSubHeaderCenterImage: true },
  { number: 5, key: 'sub_header_style5', slug: 'gradient_band', name: 'Gradient Band', nameTe: 'గ్రేడియంట్ బ్యాండ్', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: false, supportsSubHeaderCenterImage: true },
  { number: 6, key: 'sub_header_style6', slug: 'dual_logo_bar', name: 'Dual Logo Bar', nameTe: 'డ్యూయల్ లోగో బార్', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: true, supportsRightImage: true, supportsPaperNameImage: false, supportsSubHeaderCenterImage: true },
  { number: 7, key: 'sub_header_style7', slug: 'minimal_grey', name: 'Minimal Grey', nameTe: 'మినిమల్ గ్రే', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: false, supportsSubHeaderCenterImage: false },
  { number: 8, key: 'sub_header_style8', slug: 'district_highlight', name: 'District Highlight', nameTe: 'జిల్లా హైలైట్', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: false, supportsSubHeaderCenterImage: true },
  { number: 9, key: 'sub_header_style9', slug: 'ornament_border', name: 'Ornament Border', nameTe: 'అలంకరణ బార్డర్', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: false, supportsSubHeaderCenterImage: true },
  { number: 10, key: 'sub_header_style10', slug: 'traditional_telugu', name: 'Traditional Telugu', nameTe: 'సాంప్రదాయ తెలుగు', type: 'SUB', supportsCenterLogo: false, supportsLeftImage: false, supportsRightImage: false, supportsPaperNameImage: false, supportsSubHeaderCenterImage: true },
];

export const ALL_HEADER_STYLES: HeaderStyleDefinition[] = [...MAIN_HEADER_STYLES, ...SUB_HEADER_STYLES];

export function getHeaderStyleCatalog() {
  return {
    mainHeaders: MAIN_HEADER_STYLES,
    subHeaders: SUB_HEADER_STYLES,
    all: ALL_HEADER_STYLES,
  };
}

export function findMainStyleByNumber(n: number): HeaderStyleDefinition | null {
  return MAIN_HEADER_STYLES.find((s) => s.number === n) || null;
}

export function findSubStyleByNumber(n: number): HeaderStyleDefinition | null {
  return SUB_HEADER_STYLES.find((s) => s.number === n) || null;
}

export function findStyleByKey(key: string): HeaderStyleDefinition | null {
  const k = String(key || '').trim();
  return ALL_HEADER_STYLES.find((s) => s.key === k) || null;
}

export function resolveStyleNumbers(input: {
  headerStyleNumber?: unknown;
  subHeaderStyleNumber?: unknown;
  headerStyleKey?: unknown;
  subHeaderStyleKey?: unknown;
}): { headerStyleNumber: number; subHeaderStyleNumber: number; headerStyleKey: string; subHeaderStyleKey: string } {
  let headerStyleNumber = Number(input.headerStyleNumber);
  let subHeaderStyleNumber = Number(input.subHeaderStyleNumber);

  if (input.headerStyleKey) {
    const s = findStyleByKey(String(input.headerStyleKey));
    if (s?.type === 'MAIN') headerStyleNumber = s.number;
  }
  if (input.subHeaderStyleKey) {
    const s = findStyleByKey(String(input.subHeaderStyleKey));
    if (s?.type === 'SUB') subHeaderStyleNumber = s.number;
  }

  if (!Number.isFinite(headerStyleNumber) || headerStyleNumber < 1 || headerStyleNumber > 10) {
    headerStyleNumber = 1;
  }
  if (!Number.isFinite(subHeaderStyleNumber) || subHeaderStyleNumber < 1 || subHeaderStyleNumber > 10) {
    subHeaderStyleNumber = 1;
  }

  const main = findMainStyleByNumber(headerStyleNumber)!;
  const sub = findSubStyleByNumber(subHeaderStyleNumber)!;

  return {
    headerStyleNumber,
    subHeaderStyleNumber,
    headerStyleKey: main.key,
    subHeaderStyleKey: sub.key,
  };
}

export const MAX_ISSUE_NUMBER_PER_YEAR = 365;
