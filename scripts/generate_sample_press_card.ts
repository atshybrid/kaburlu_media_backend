/**
 * Generate a sample journalist union press card PDF for design preview.
 * Usage: npx ts-node scripts/generate_sample_press_card.ts [output.pdf]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

import { generateSamplePressCardBuffer } from '../src/lib/journalistPressCardPdf';

async function main() {
  const outPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(process.cwd(), 'sample_press_card.pdf');

  console.log('Generating sample press card PDF…');
  const buffer = await generateSamplePressCardBuffer();
  fs.writeFileSync(outPath, buffer);
  console.log(`✓ Saved to: ${outPath}`);
}

main().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
