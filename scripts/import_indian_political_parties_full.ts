/**
 * Full ECI gazette import → IndianPoliticalParty table.
 *
 *   npx ts-node --transpile-only scripts/import_indian_political_parties_full.ts
 *   npx ts-node --transpile-only scripts/import_indian_political_parties_full.ts --dry-run
 */
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../src/lib/prisma';
import { parseEciGazetteFile } from './lib/parseEciGazette';
import { colorsForParty } from './lib/partyBrandColors';
import { upsertPartyFromSeed, type PartySeedRow } from '../src/lib/indianPoliticalParty';

const GAZETTE_TXT = path.join(__dirname, 'data/indian-political-parties/eci-gazette-2024.txt');
const SEED_JSON = path.join(__dirname, 'data/indian-political-parties/eci-national-state-seed.json');
const ECI_REF = '56/25/2024/PPS-II';
const ECI_URL = 'https://www.eci.gov.in';

const p: any = prisma;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log('[eci-import] Parsing gazette:', GAZETTE_TXT);
  const parties = parseEciGazetteFile(GAZETTE_TXT);

  const counts = { NATIONAL: 0, STATE: 0, REGISTERED_UNRECOGNIZED: 0 };
  for (const x of parties) counts[x.recognition as keyof typeof counts]++;

  console.log('[eci-import] Parsed:', parties.length, counts);
  if (dryRun) {
    console.log('[eci-import] Sample:', parties.slice(0, 3), parties.slice(100, 103));
    await prisma.$disconnect();
    return;
  }

  const BATCH = 200;
  let upserted = 0;
  for (let i = 0; i < parties.length; i += BATCH) {
    const batch = parties.slice(i, i + BATCH);
    await p.$transaction(
      batch.map((row) => {
        const colors = colorsForParty(row.shortCode, row.recognition);
        return p.indianPoliticalParty.upsert({
          where: { shortCode: row.shortCode },
          create: {
            shortCode: row.shortCode,
            name: row.name,
            recognition: row.recognition,
            symbolName: row.symbolName,
            primaryColor: colors.primary,
            secondaryColor: colors.secondary,
            states: row.states,
            headquartersAddress: row.headquartersAddress,
            eciSerialNumber: row.eciSerialNumber,
            eciNotificationRef: ECI_REF,
            eciSourceUrl: ECI_URL,
            colorSource: colors.colorSource,
            isActive: true,
          },
          update: {
            name: row.name,
            recognition: row.recognition,
            symbolName: row.symbolName,
            headquartersAddress: row.headquartersAddress,
            eciSerialNumber: row.eciSerialNumber,
            states: row.states.length ? row.states : undefined,
            updatedAt: new Date(),
          },
        });
      }),
    );
    upserted += batch.length;
    if (upserted % 1000 === 0 || upserted === parties.length) {
      console.log(`[eci-import] Upserted ${upserted}/${parties.length}`);
    }
  }

  if (fs.existsSync(SEED_JSON)) {
    const seed = JSON.parse(fs.readFileSync(SEED_JSON, 'utf8')) as { parties: PartySeedRow[] };
    console.log('[eci-import] Merging curated seed parties:', seed.parties.length);
    for (const row of seed.parties) {
      await upsertPartyFromSeed(row, ECI_URL);
    }
  }

  const total = await p.indianPoliticalParty.count();
  console.log('[eci-import] Done. DB total:', total);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
