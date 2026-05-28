/**
 * Download party symbol images (Wikipedia thumbnails) → Bunny CDN.
 *
 *   npx ts-node --transpile-only scripts/upload_indian_party_symbols.ts
 *   npx ts-node --transpile-only scripts/upload_indian_party_symbols.ts --all-national-state
 */
import axios from 'axios';
import sharp from 'sharp';
import prisma from '../src/lib/prisma';
import { bunnyStoragePutObject, isBunnyStorageConfigured } from '../src/lib/bunnyStorage';
import { putPublicObject } from '../src/lib/objectStorage';
import { WIKI_SYMBOL_PAGES } from './lib/parseEciGazette';
import { COMMONS_SYMBOL_FILES, DIRECT_SYMBOL_URLS } from './lib/partySymbolImages';

const p: any = prisma;
const WIKI_UA = 'KaburluMediaBot/1.0 (https://kaburlumedia.com; party-symbol-import)';

async function fetchWikipediaThumbnail(pageTitle: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest.php/page/summary/${encodeURIComponent(pageTitle)}`;
    const { data } = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': WIKI_UA } });
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch {
    return null;
  }
}

async function resolveCommonsFileUrl(fileTitle: string): Promise<string | null> {
  try {
    const api = 'https://en.wikipedia.org/w/api.php';
    const { data } = await axios.get(api, {
      timeout: 20000,
      headers: { 'User-Agent': WIKI_UA },
      params: {
        action: 'query',
        titles: `File:${fileTitle}`,
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json',
      },
    });
    const pages = data?.query?.pages || {};
    for (const page of Object.values(pages) as any[]) {
      const url = page?.imageinfo?.[0]?.url;
      if (url) return url;
    }
  } catch (e: any) {
    console.warn('  commons api:', fileTitle, e?.message);
  }
  return null;
}

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      headers: { 'User-Agent': WIKI_UA },
    });
    return Buffer.from(res.data);
  } catch (e: any) {
    console.warn('  download failed:', url, e?.message);
    return null;
  }
}

async function uploadSymbolBuffer(shortCode: string, buffer: Buffer): Promise<string> {
  const png = await sharp(buffer).png().toBuffer();
  const key = `political-parties/symbols/${shortCode.toLowerCase()}.png`;
  if (isBunnyStorageConfigured()) {
    const r = await bunnyStoragePutObject({ key, body: png, contentType: 'image/png' });
    return r.publicUrl;
  }
  const r = await putPublicObject({ key, body: png, contentType: 'image/png' });
  return r.publicUrl;
}

async function resolveImageUrl(shortCode: string): Promise<string | null> {
  if (DIRECT_SYMBOL_URLS[shortCode]) return DIRECT_SYMBOL_URLS[shortCode];
  const commonsFile = COMMONS_SYMBOL_FILES[shortCode];
  if (commonsFile) {
    const direct = await resolveCommonsFileUrl(commonsFile);
    if (direct) return direct;
  }
  const wiki = WIKI_SYMBOL_PAGES[shortCode];
  if (wiki) {
    const thumb = await fetchWikipediaThumbnail(wiki);
    if (thumb) return thumb;
  }
  return null;
}

async function main() {
  const allNationalState = process.argv.includes('--all-national-state');

  const force = process.argv.includes('--force');
  const where: any = { isActive: true };
  if (!force) where.symbolImageUrl = null;
  if (allNationalState) {
    where.recognition = { in: ['NATIONAL', 'STATE'] };
  } else {
    where.shortCode = { in: Object.keys(WIKI_SYMBOL_PAGES) };
  }

  const parties = await p.indianPoliticalParty.findMany({
    where,
    orderBy: [{ recognition: 'asc' }, { shortCode: 'asc' }],
    take: 120,
  });

  console.log('[symbols] Uploading symbols for', parties.length, 'parties');
  if (!isBunnyStorageConfigured()) {
    console.warn('[symbols] Bunny not configured — using R2/object storage fallback');
  }

  let ok = 0;
  let fail = 0;
  for (const party of parties) {
    const imgUrl = await resolveImageUrl(party.shortCode);
    if (!imgUrl) {
      console.log('  skip (no image):', party.shortCode, party.name);
      fail++;
      continue;
    }
    const buf = await downloadImage(imgUrl);
    if (!buf) {
      fail++;
      continue;
    }
    const publicUrl = await uploadSymbolBuffer(party.shortCode, buf);
    await p.indianPoliticalParty.update({
      where: { id: party.id },
      data: { symbolImageUrl: publicUrl, updatedAt: new Date() },
    });
    console.log('  ✓', party.shortCode, publicUrl);
    ok++;
    await new Promise((r) => setTimeout(r, 350));
  }

  console.log('[symbols] Done. uploaded:', ok, 'failed/skipped:', fail);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
