/**
 * Import Indian political parties from ECI seed JSON.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/import_indian_political_parties.ts
 *   npx ts-node --transpile-only scripts/import_indian_political_parties.ts --enrich-colors
 *
 * Full ECI RUPP list (2500+ parties): download XLSX from
 * https://www.eci.gov.in/political-party → save as scripts/data/indian-political-parties/eci-rupp.xlsx
 * (Phase 2 — add xlsx parser when file is provided)
 */
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../src/lib/prisma';
import { upsertPartyFromSeed, type PartySeedRow } from '../src/lib/indianPoliticalParty';
import { enrichPartyColorsWithAi } from '../src/lib/indianPoliticalPartyAi';

const SEED_PATH = path.join(__dirname, 'data/indian-political-parties/eci-national-state-seed.json');

async function main() {
  const enrich = process.argv.includes('--enrich-colors');
  if (!fs.existsSync(SEED_PATH)) {
    console.error('Seed file missing:', SEED_PATH);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as {
    source?: string;
    eciSourceUrl?: string;
    parties: PartySeedRow[];
  };

  console.log('[parties] Importing', raw.parties.length, 'parties from ECI seed...');
  console.log('[parties] Source:', raw.source || 'seed');

  let ok = 0;
  for (const row of raw.parties) {
    await upsertPartyFromSeed(row, raw.eciSourceUrl);
    ok++;
    console.log('  ✓', row.shortCode, '-', row.name);
  }

  if (enrich) {
    console.log('[parties] AI color enrichment for parties missing colors...');
    const updated = await enrichPartyColorsWithAi({ limit: 50 });
    console.log('[parties] AI enriched:', updated);
  }

  const total = await (prisma as any).indianPoliticalParty.count();
  console.log('[parties] Done. Total in DB:', total);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
