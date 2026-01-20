/**
 * PNG to WebP conversion utility for ePaper page optimization.
 *
 * ARCHITECTURE:
 * - PNG is the MASTER image (lossless, archive quality) - NEVER deleted
 * - WebP is the DELIVERY format (~60-80% smaller) for frontend performance
 * - Single conversion only (PNG → WebP), no re-encoding
 *
 * @module pngToWebp
 */

import sharp from 'sharp';
import { config } from '../config/env';

/**
 * Default WebP quality (0-100).
 * Range 75-82 provides excellent balance of quality and compression for newspaper text.
 */
const DEFAULT_WEBP_QUALITY = 80;

/**
 * Get configured WebP quality from environment or use default.
 */
function resolveWebpQuality(): number {
  const fromConfig = (config as any)?.epaper?.webpQuality;
  const q = Number(fromConfig);
  if (!Number.isFinite(q) || q < 1 || q > 100) return DEFAULT_WEBP_QUALITY;
  return Math.floor(q);
}

/**
 * Convert a PNG buffer to WebP format.
 *
 * Best practices for newspaper/ePaper:
 * - No resize (maintain original dimensions from pdftoppm)
 * - Quality ~80 for sharp text preservation
 * - Single pass, no re-encoding
 *
 * @param pngBuffer - The source PNG image buffer (lossless master)
 * @returns WebP buffer (optimized for delivery)
 * @throws Error if conversion fails
 */
export async function convertPngToWebp(pngBuffer: Buffer): Promise<Buffer> {
  const quality = resolveWebpQuality();

  const webpBuffer = await sharp(pngBuffer)
    .webp({
      quality,
      // Use default effort (4) for balanced speed/compression
      // Higher effort = smaller file but slower
      effort: 4,
      // Preserve any alpha channel (usually not present in ePaper)
      alphaQuality: 100,
    })
    .toBuffer();

  return webpBuffer;
}

/**
 * Convert multiple PNG buffers to WebP in parallel with concurrency control.
 *
 * @param pngBuffers - Array of PNG buffers to convert
 * @param concurrency - Max concurrent conversions (default: 4)
 * @returns Array of WebP buffers in same order
 */
export async function convertPngsToWebp(
  pngBuffers: Buffer[],
  concurrency = 4
): Promise<Buffer[]> {
  const results: Buffer[] = new Array(pngBuffers.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= pngBuffers.length) return;
      results[i] = await convertPngToWebp(pngBuffers[i]);
    }
  };

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, pngBuffers.length)) },
    () => worker()
  );
  await Promise.all(workers);

  return results;
}
