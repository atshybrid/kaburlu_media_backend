/**
 * Canonical ePaper page-size catalog.
 *
 * The smart design only stores `paperType` (BROADSHEET / TABLOID / ...). The actual
 * print dimensions are derived from this catalog so every consumer (React Design Studio,
 * PDF export, print house) renders/exports the SAME exact size.
 *
 * Export rule (frontend):
 *   - Render the page canvas at `widthPx` x `heightPx` (300 DPI), then export the PDF
 *     with page size `widthPt` x `heightPt` (PDF points = inches * 72).
 *   - Never hard-code a width on the frontend — always read it from the API.
 */

export type PaperType = 'BROADSHEET' | 'TABLOID' | 'BERLINER' | 'MAGAZINE';

export type PageSizeDefinition = {
  paperType: PaperType;
  label: string;
  /** Print resolution the px values are computed at. */
  dpi: number;
  widthInches: number;
  heightInches: number;
  widthMm: number;
  heightMm: number;
  /** Pixel canvas size at `dpi` (use for html2canvas / image render). */
  widthPx: number;
  heightPx: number;
  /** PDF page size in points (72 dpi) — use for jsPDF / PDFKit page size. */
  widthPt: number;
  heightPt: number;
  orientation: 'portrait';
};

const DPI = 300;
const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

function build(paperType: PaperType, label: string, widthInches: number, heightInches: number): PageSizeDefinition {
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    paperType,
    label,
    dpi: DPI,
    widthInches,
    heightInches,
    widthMm: round(widthInches * MM_PER_INCH),
    heightMm: round(heightInches * MM_PER_INCH),
    widthPx: Math.round(widthInches * DPI),
    heightPx: Math.round(heightInches * DPI),
    widthPt: round(widthInches * PT_PER_INCH),
    heightPt: round(heightInches * PT_PER_INCH),
    orientation: 'portrait',
  };
}

/**
 * Indian newspaper standards (portrait, height > width):
 *  - BROADSHEET: full-size daily (~13.5 x 22.5 in). Aligned to common Indian broadsheet.
 *  - TABLOID:    half broadsheet (11 x 17 in).
 *  - BERLINER:   315 x 470 mm (~12.4 x 18.5 in).
 *  - MAGAZINE:   A4 (210 x 297 mm).
 */
export const PAGE_SIZE_CATALOG: Record<PaperType, PageSizeDefinition> = {
  BROADSHEET: build('BROADSHEET', 'Broadsheet (13.5" × 22.5")', 13.5, 22.5),
  TABLOID: build('TABLOID', 'Tabloid (11" × 17")', 11, 17),
  BERLINER: build('BERLINER', 'Berliner (315 × 470 mm)', 12.4, 18.5),
  MAGAZINE: build('MAGAZINE', 'Magazine / A4 (210 × 297 mm)', 8.27, 11.69),
};

export function normalizePaperType(value: unknown): PaperType {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'BROADSHEET' || v === 'TABLOID' || v === 'BERLINER' || v === 'MAGAZINE') return v;
  return 'TABLOID';
}

/** Returns the canonical page dimensions for a paperType (falls back to TABLOID). */
export function getPageDimensions(paperType: unknown): PageSizeDefinition {
  return PAGE_SIZE_CATALOG[normalizePaperType(paperType)];
}

export function getPageSizeCatalog(): PageSizeDefinition[] {
  return Object.values(PAGE_SIZE_CATALOG);
}
