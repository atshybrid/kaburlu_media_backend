/**
 * BLOCK-04A — 4 inch × max 7 inch compact news block renderer.
 * Generates production HTML + CSS from article input.
 */

export type Block04aArticleInput = {
  title: string;
  subtitle?: string | null;
  image?: string | null;
  highlights?: string[];
  content: string;
  dateline?: string | null;
};

export type Block04aRenderResult = {
  blockType: 'BLOCK-04A';
  width: string;
  height: string;
  html: string;
  css: string;
  estimatedHeightMm: number;
  isOverflow: boolean;
  isRejected: boolean;
  rejectReason?: string;
  wordCount: number;
  titleFontSizePx: number;
};

export const BLOCK_04A_RULES = {
  code: 'BLOCK-04A',
  widthMm: 101.6,
  maxHeightMm: 177.8,
  minWords: 50,
  maxWords: 150,
  titleMinFontPx: 38,
  titleMaxFontPx: 58,
  titleMaxLines: 2,
  subtitleMaxLines: 2,
  maxHighlights: 2,
  bodyFontPx: 11,
  bodyLineHeightPx: 14,
  paddingMm: 2,
  imageAspectRatio: 0.62,
} as const;

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function countWords(text: string): number {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, maxWords: number): string {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ') + '…';
}

/** Scale title font 38–58px based on character length (shorter = larger). */
function titleFontSize(title: string): number {
  const len = String(title || '').trim().length;
  if (len <= 20) return BLOCK_04A_RULES.titleMaxFontPx;
  if (len <= 35) return 52;
  if (len <= 50) return 46;
  if (len <= 70) return 42;
  return BLOCK_04A_RULES.titleMinFontPx;
}

function pxToMm(px: number): number {
  return px * 0.264583;
}

function estimateHeightMm(input: {
  titleLines: number;
  titleFontPx: number;
  hasSubtitle: boolean;
  subtitleLines: number;
  hasImage: boolean;
  highlightCount: number;
  bodyLines: number;
}): number {
  const pad = BLOCK_04A_RULES.paddingMm * 2;
  const titleH = input.titleLines * input.titleFontPx * 1.2;
  const subH = input.hasSubtitle ? input.subtitleLines * (input.titleFontPx * 0.5) * 1.2 + 4 : 0;
  const imgH = input.hasImage ? BLOCK_04A_RULES.widthMm * BLOCK_04A_RULES.imageAspectRatio : 0;
  const hlH = input.highlightCount * 18 + (input.highlightCount > 0 ? 8 : 0);
  const bodyH = input.bodyLines * BLOCK_04A_RULES.bodyLineHeightPx;
  const gaps = 12;
  return Math.round(pxToMm(titleH + subH + imgH + hlH + bodyH + gaps) + pad);
}

function bodyLineCount(content: string, widthMm: number): number {
  const innerWidthMm = widthMm - BLOCK_04A_RULES.paddingMm * 2;
  const innerWidthPx = innerWidthMm / 0.264583;
  const charWidthPx = BLOCK_04A_RULES.bodyFontPx * 0.55;
  const charsPerLine = Math.max(1, Math.floor(innerWidthPx / charWidthPx));
  const chars = String(content || '').replace(/\s+/g, ' ').trim().length;
  return Math.max(1, Math.ceil(chars / charsPerLine));
}

export function renderBlock04a(article: Block04aArticleInput): Block04aRenderResult {
  const wordCount = countWords(article.content);
  const titleFontPx = titleFontSize(article.title);
  const subtitleFontPx = Math.round(titleFontPx * 0.5);

  if (wordCount < BLOCK_04A_RULES.minWords) {
    return {
      blockType: 'BLOCK-04A',
      width: `${BLOCK_04A_RULES.widthMm}mm`,
      height: 'auto',
      html: '',
      css: block04aCss(),
      estimatedHeightMm: 0,
      isOverflow: false,
      isRejected: true,
      rejectReason: `Article has ${wordCount} words; minimum ${BLOCK_04A_RULES.minWords} required for BLOCK-04A`,
      wordCount,
      titleFontSizePx: titleFontPx,
    };
  }

  if (wordCount > BLOCK_04A_RULES.maxWords) {
    return {
      blockType: 'BLOCK-04A',
      width: `${BLOCK_04A_RULES.widthMm}mm`,
      height: 'auto',
      html: '',
      css: block04aCss(),
      estimatedHeightMm: 0,
      isOverflow: false,
      isRejected: true,
      rejectReason: `Article has ${wordCount} words; maximum ${BLOCK_04A_RULES.maxWords} allowed for BLOCK-04A`,
      wordCount,
      titleFontSizePx: titleFontPx,
    };
  }

  const bodyText = truncateWords(article.content, BLOCK_04A_RULES.maxWords);
  const highlights = (article.highlights || []).slice(0, BLOCK_04A_RULES.maxHighlights).filter(Boolean);
  const hasImage = !!article.image;
  const hasSubtitle = !!String(article.subtitle || '').trim();

  const titleLines = Math.min(BLOCK_04A_RULES.titleMaxLines, Math.ceil(article.title.length / 18) || 1);
  const subtitleLines = hasSubtitle
    ? Math.min(BLOCK_04A_RULES.subtitleMaxLines, Math.ceil(String(article.subtitle).length / 24) || 1)
    : 0;
  const bodyLines = bodyLineCount(bodyText, BLOCK_04A_RULES.widthMm);

  const estimatedHeightMm = estimateHeightMm({
    titleLines,
    titleFontPx,
    hasSubtitle,
    subtitleLines,
    hasImage,
    highlightCount: highlights.length,
    bodyLines,
  });

  const isOverflow = estimatedHeightMm > BLOCK_04A_RULES.maxHeightMm;

  const htmlParts: string[] = [
    `<article class="block-04a" data-block="BLOCK-04A">`,
    `<h1 class="block-04a__title" style="font-size:${titleFontPx}px">${escapeHtml(article.title)}</h1>`,
  ];

  if (hasSubtitle) {
    htmlParts.push(
      `<h2 class="block-04a__subtitle" style="font-size:${subtitleFontPx}px">${escapeHtml(String(article.subtitle))}</h2>`,
    );
  }

  if (hasImage) {
    htmlParts.push(
      `<figure class="block-04a__image-wrap"><img class="block-04a__image" src="${escapeHtml(article.image!)}" alt="" loading="lazy" /></figure>`,
    );
  }

  if (highlights.length) {
    htmlParts.push('<ul class="block-04a__highlights">');
    for (const h of highlights) {
      htmlParts.push(`<li class="block-04a__highlight-item">${escapeHtml(h)}</li>`);
    }
    htmlParts.push('</ul>');
  }

  if (article.dateline) {
    htmlParts.push(`<p class="block-04a__dateline">${escapeHtml(article.dateline)}</p>`);
  }

  htmlParts.push(`<div class="block-04a__body">${escapeHtml(bodyText)}</div>`);
  htmlParts.push('</article>');

  return {
    blockType: 'BLOCK-04A',
    width: `${BLOCK_04A_RULES.widthMm}mm`,
    height: 'auto',
    html: htmlParts.join('\n'),
    css: block04aCss(titleFontPx, subtitleFontPx),
    estimatedHeightMm,
    isOverflow,
    isRejected: false,
    wordCount,
    titleFontSizePx: titleFontPx,
  };
}

function block04aCss(titleFontPx = 48, subtitleFontPx = 24): string {
  return `
.block-04a {
  box-sizing: border-box;
  width: ${BLOCK_04A_RULES.widthMm}mm;
  max-height: ${BLOCK_04A_RULES.maxHeightMm}mm;
  overflow: hidden;
  background: #ffffff;
  padding: ${BLOCK_04A_RULES.paddingMm}mm;
  font-family: 'Noto Serif Telugu', 'Ramabhadra', 'Gautami', serif;
  color: #000;
}
.block-04a__title {
  margin: 0 0 4px;
  text-align: center;
  font-weight: 700;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: ${BLOCK_04A_RULES.titleMaxLines};
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: ${titleFontPx}px;
}
.block-04a__subtitle {
  margin: 0 0 6px;
  text-align: center;
  font-weight: 600;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: ${BLOCK_04A_RULES.subtitleMaxLines};
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: ${subtitleFontPx}px;
}
.block-04a__image-wrap {
  margin: 0 0 6px;
  width: 100%;
}
.block-04a__image {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 10;
  object-fit: cover;
}
.block-04a__highlights {
  list-style: none;
  margin: 0 0 6px;
  padding: 0;
  text-align: center;
}
.block-04a__highlight-item {
  margin: 0;
  padding: 4px 0 6px;
  font-size: 11px;
  line-height: 1.3;
  border-bottom: 1px dashed #666;
}
.block-04a__highlight-item:last-child {
  border-bottom: none;
}
.block-04a__dateline {
  margin: 0 0 4px;
  font-size: 10px;
  font-weight: 700;
  text-align: left;
}
.block-04a__body {
  font-size: ${BLOCK_04A_RULES.bodyFontPx}px;
  line-height: ${BLOCK_04A_RULES.bodyLineHeightPx}px;
  text-align: justify;
  hyphens: auto;
  -webkit-hyphens: auto;
  column-count: 1;
  white-space: pre-wrap;
  word-break: break-word;
}
`.trim();
}
