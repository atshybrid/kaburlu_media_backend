/**
 * Import PRGI registered newspaper titles from CSV exports.
 *
 * Usage:
 *   npx ts-node scripts/import_prgi_registered_titles.ts
 *   npx ts-node scripts/import_prgi_registered_titles.ts --dir /path/to/csv/folder
 *   npx ts-node scripts/import_prgi_registered_titles.ts --truncate
 *
 * Default CSV directory: scripts/data/prgi-registered-titles/
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_DIR = path.join(__dirname, 'data', 'prgi-registered-titles');

function parseArgs() {
  const args = process.argv.slice(2);
  let dir = DEFAULT_DIR;
  let truncate = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      dir = path.resolve(args[++i]);
    } else if (args[i] === '--truncate') {
      truncate = true;
    }
  }
  return { dir, truncate };
}

/** Minimal RFC4180-style CSV row parser (handles quoted fields with commas). */
function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseRegistrationDate(raw: string): Date | null {
  const s = (raw || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

function normalizeRegistrationNumber(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function emptyToNull(v: string): string | null {
  const s = (v || '').trim();
  return s ? s : null;
}

type CsvRow = {
  serialNumber: number | null;
  title: string;
  registrationNumber: string;
  registrationDate: Date | null;
  language: string | null;
  periodicity: string | null;
  publisher: string | null;
  owner: string | null;
  publicationState: string;
  publicationDistrict: string | null;
  sourceFile: string;
};

function rowFromColumns(cols: string[], sourceFile: string): CsvRow | null {
  if (cols.length < 10) return null;
  const reg = normalizeRegistrationNumber(cols[2]);
  const title = (cols[1] || '').trim();
  const state = (cols[8] || '').trim();
  if (!reg || !title || !state) return null;

  const sn = parseInt(cols[0], 10);
  return {
    serialNumber: Number.isFinite(sn) ? sn : null,
    title,
    registrationNumber: reg,
    registrationDate: parseRegistrationDate(cols[3]),
    language: emptyToNull(cols[4]),
    periodicity: emptyToNull(cols[5]),
    publisher: emptyToNull(cols[6]),
    owner: emptyToNull(cols[7]),
    publicationState: state,
    publicationDistrict: emptyToNull(cols[9]),
    sourceFile,
  };
}

function listCsvFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`CSV directory not found: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .sort()
    .map((f) => path.join(dir, f));
}

async function loadAllRows(dir: string): Promise<{ rows: CsvRow[]; skipped: number; duplicateInCsv: number }> {
  const files = listCsvFiles(dir);
  if (!files.length) {
    throw new Error(`No CSV files in ${dir}`);
  }

  const byReg = new Map<string, CsvRow>();
  let skipped = 0;
  let duplicateInCsv = 0;

  for (const filePath of files) {
    const sourceFile = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvRow(lines[i]);
      const row = rowFromColumns(cols, sourceFile);
      if (!row) {
        skipped++;
        continue;
      }
      const key = row.registrationNumber.toUpperCase();
      if (byReg.has(key)) {
        duplicateInCsv++;
        continue;
      }
      byReg.set(key, row);
    }
  }

  return { rows: [...byReg.values()], skipped, duplicateInCsv };
}

async function main() {
  const { dir, truncate } = parseArgs();
  console.log(`[prgi-import] Reading CSVs from: ${dir}`);

  const { rows, skipped, duplicateInCsv } = await loadAllRows(dir);
  console.log(`[prgi-import] Parsed ${rows.length} unique rows (skipped ${skipped}, csv dupes ${duplicateInCsv})`);

  const stateCounts: Record<string, number> = {};
  for (const r of rows) {
    stateCounts[r.publicationState] = (stateCounts[r.publicationState] || 0) + 1;
  }
  console.log('[prgi-import] By state:', stateCounts);

  if (truncate) {
    const deleted = await prisma.prgiRegisteredTitle.deleteMany();
    console.log(`[prgi-import] Truncated table (${deleted.count} rows removed)`);
  }

  const BATCH = 500;
  let inserted = 0;
  let batchDupes = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const result = await prisma.prgiRegisteredTitle.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    inserted += result.count;
    batchDupes += chunk.length - result.count;
  }

  const total = await prisma.prgiRegisteredTitle.count();
  console.log(`[prgi-import] Inserted ${inserted} new rows (${batchDupes} skipped as DB duplicates)`);
  console.log(`[prgi-import] Table total: ${total}`);
}

function isDbUnreachable(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '');
  return msg.includes("Can't reach database server") || (err as any)?.name === 'PrismaClientInitializationError';
}

main()
  .catch((e) => {
    console.error('[prgi-import] Failed:', e);
    if (isDbUnreachable(e)) {
      console.error(`
[prgi-import] Your machine cannot connect to the database (DigitalOcean firewall / trusted sources).
  • Add your public IP in DO → Databases → Trusted sources, then re-run this command
  • Or import via production server:
      npm run import:prgi-registered-titles:remote
  • Or generate SQL locally and apply when DB is reachable:
      npm run prgi:generate-sql
      npx prisma db execute --file scripts/data/prgi-registered-titles/import_prgi.sql
`);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
