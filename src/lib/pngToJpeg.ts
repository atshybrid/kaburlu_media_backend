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
const DEFAULT_OG_WIDTH = 1200;
const DEFAULT_OG_HEIGHT = 630;

function resolveJpegQuality(): number {
  const fromConfig = (config as any)?.epaper?.jpegQuality;
  const q = Number(fromConfig);
  if (!Number.isFinite(q) || q < 1 || q > 100) return DEFAULT_JPEG_QUALITY;
  return Math.floor(q);
}

function resolveOgSettings(): { width: number; height: number; quality: number } {
  const og = (config as any)?.cdn?.ogImage;
  const width = Number(og?.width);
  const height = Number(og?.height);
  const quality = Number(og?.quality);

  return {
    width: Number.isFinite(width) && width > 0 ? Math.floor(width) : DEFAULT_OG_WIDTH,
    height: Number.isFinite(height) && height > 0 ? Math.floor(height) : DEFAULT_OG_HEIGHT,
    quality: Number.isFinite(quality) && quality >= 1 && quality <= 100 ? Math.floor(quality) : DEFAULT_JPEG_QUALITY,
  };
}

export async function convertPngToJpeg(pngBuffer: Buffer): Promise<Buffer> {
  const quality = resolveJpegQuality();

  // Force opaque background to avoid unexpected black when source contains alpha.
  // ePaper pages typically have no alpha, but this keeps output stable.
  return await sharp(pngBuffer)
    .flatten({ background: '#ffffff' })
    .jpeg({ quality, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
    .toBuffer();
}

/**
 * Convert a PNG page (usually portrait) into a share-friendly OG JPEG.
 * Produces a fixed size image (default 1200x630) with white padding (contain)
 * to avoid cropping newspaper pages.
 */
export async function convertPngToOgJpeg(pngBuffer: Buffer): Promise<Buffer> {
  const { width, height, quality } = resolveOgSettings();
  return await sharp(pngBuffer)
    .flatten({ background: '#ffffff' })
    .resize(width, height, { fit: 'contain', background: '#ffffff' })
    .jpeg({ quality, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
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
