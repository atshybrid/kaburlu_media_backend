/**
 * PNG to JPEG conversion utility for ePaper social sharing / OG images.
 *
 * Notes:
 * - PNG is the master (lossless)
 * - WebP is for optimized delivery
 * - JPEG is for maximum compatibility with social platforms and share previews
 */

import sharp from 'sharp';
import { config } from '../config/env';

const DEFAULT_JPEG_QUALITY = 85;

function resolveJpegQuality(): number {
  const fromConfig = (config as any)?.epaper?.jpegQuality;
  const q = Number(fromConfig);
  if (!Number.isFinite(q) || q < 1 || q > 100) return DEFAULT_JPEG_QUALITY;
  return Math.floor(q);
}

export async function convertPngToJpeg(pngBuffer: Buffer): Promise<Buffer> {
  const quality = resolveJpegQuality();

  // Force opaque background to avoid unexpected black when source contains alpha.
  // ePaper pages typically have no alpha, but this keeps output stable.
  return await sharp(pngBuffer)
    .flatten({ background: '#ffffff' })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

export async function convertPngsToJpeg(pngBuffers: Buffer[], concurrency = 4): Promise<Buffer[]> {
  const results: Buffer[] = new Array(pngBuffers.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= pngBuffers.length) return;
      results[i] = await convertPngToJpeg(pngBuffers[i]);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, pngBuffers.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}
