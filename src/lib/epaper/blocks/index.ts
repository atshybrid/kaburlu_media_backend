/**
 * ePaper block render registry — dispatches to per-block renderers.
 */

import { renderBlock04a, Block04aArticleInput, Block04aRenderResult } from './block04a';

export type BlockArticleInput = Block04aArticleInput;

export type BlockRenderOutput = Block04aRenderResult & {
  blockCode: string;
};

export function renderEpaperBlock(blockCode: string, article: BlockArticleInput): BlockRenderOutput {
  const code = String(blockCode || '').trim().toUpperCase();
  switch (code) {
    case 'BLOCK-04A':
      return { ...renderBlock04a(article), blockCode: 'BLOCK-04A' };
    default:
      throw new Error(`Unsupported block code: ${blockCode}. Supported: BLOCK-04A`);
  }
}

export { BLOCK_04A_RULES } from './block04a';
