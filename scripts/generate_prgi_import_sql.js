#!/usr/bin/env node
/**
 * Build scripts/data/prgi-registered-titles/import_prgi.sql from CSV files.
 * Use when Prisma client import is unavailable; apply with:
 *   npx prisma db execute --file scripts/data/prgi-registered-titles/import_prgi.sql
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = path.join(__dirname, 'data', 'prgi-registered-titles');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv')).sort().map((f) => path.join(dir, f));

function parseCsvRow(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function esc(s) {
  if (s == null || s === '') return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

function parseDate(raw) {
  const m = (raw || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return 'NULL';
  return `'${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}'::date`;
}

const byReg = new Map();
for (const filePath of files) {
  const sourceFile = path.basename(filePath);
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvRow(lines[i]);
    if (c.length < 10) continue;
    const reg = c[2].trim();
    const key = reg.toUpperCase();
    if (byReg.has(key)) continue;
    byReg.set(key, { c, sourceFile, reg });
  }
}

const out = ['BEGIN;'];
for (const { c, sourceFile, reg } of byReg.values()) {
  const id = `c${crypto.randomBytes(12).toString('hex')}`;
  const sn = parseInt(c[0], 10);
  out.push(
    `INSERT INTO "PrgiRegisteredTitle" (id,"serialNumber",title,"registrationNumber","registrationDate",language,periodicity,publisher,owner,"publicationState","publicationDistrict","sourceFile","updatedAt") VALUES (${esc(id)},${Number.isFinite(sn) ? sn : 'NULL'},${esc(c[1].trim())},${esc(reg)},${parseDate(c[3])},${esc(c[4])},${esc(c[5])},${esc(c[6])},${esc(c[7])},${esc(c[8].trim())},${esc(c[9])},${esc(sourceFile)},NOW()) ON CONFLICT ("registrationNumber") DO NOTHING;`,
  );
}
out.push('COMMIT;');

const sqlPath = path.join(dir, 'import_prgi.sql');
fs.writeFileSync(sqlPath, out.join('\n'));
console.log(`[prgi-sql] Wrote ${byReg.size} inserts → ${sqlPath}`);
