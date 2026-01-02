import { PrismaClient } from '@prisma/client';

// Fallback DB override similar to main seed if environment flag set
try {
  if (String(process.env.PRISMA_PREFER_FALLBACK).toLowerCase() === 'true' && process.env.DATABASE_URL_FALLBACK) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_FALLBACK;
  }
} catch {}

const prisma = new PrismaClient();
// any-cast for newly added models before type refresh edge cases
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

// Default designation set (global). This script seeds ONLY tenantId=null rows
// so all tenants can use the same designations.
// Only use levels defined in ReporterLevel enum: STATE | DISTRICT | ASSEMBLY | MANDAL
const defaults: { level: 'STATE' | 'DISTRICT' | 'ASSEMBLY' | 'MANDAL'; code: string; name: string }[] = [
  // --- STATE LEVEL ---
  { level: 'STATE', code: 'EDITOR_IN_CHIEF', name: 'Editor-in-Chief' },
  { level: 'STATE', code: 'STATE_EDITOR', name: 'State Editor' },
  { level: 'STATE', code: 'CHIEF_EDITOR', name: 'Chief Editor' },
  { level: 'STATE', code: 'EXECUTIVE_EDITOR', name: 'Executive Editor' },
  { level: 'STATE', code: 'STATE_BUREAU_CHIEF', name: 'State Bureau Chief' },
  { level: 'STATE', code: 'STATE_POLITICAL_EDITOR', name: 'State Political Editor' },
  { level: 'STATE', code: 'STATE_SPECIAL_CORRESPONDENT', name: 'State Special Correspondent' },
  { level: 'STATE', code: 'STATE_REPORTER', name: 'State Reporter' },
  { level: 'STATE', code: 'STATE_INVESTIGATIVE_REPORTER', name: 'Investigative Reporter (State Level)' },
  { level: 'STATE', code: 'STATE_CRIME_REPORTER', name: 'State Crime Reporter' },
  { level: 'STATE', code: 'STATE_FEATURES_EDITOR', name: 'State Features Editor' },

  // --- DISTRICT LEVEL ---
  { level: 'DISTRICT', code: 'DISTRICT_BUREAU_CHIEF', name: 'District Bureau Chief' },
  { level: 'DISTRICT', code: 'DISTRICT_EDITOR', name: 'District Editor' },
  { level: 'DISTRICT', code: 'DISTRICT_CORRESPONDENT', name: 'District Correspondent' },
  { level: 'DISTRICT', code: 'SENIOR_DISTRICT_REPORTER', name: 'Senior District Reporter' },
  { level: 'DISTRICT', code: 'DISTRICT_POLITICAL_REPORTER', name: 'District Political Reporter' },
  { level: 'DISTRICT', code: 'DISTRICT_CRIME_REPORTER', name: 'District Crime Reporter' },
  { level: 'DISTRICT', code: 'DISTRICT_SPECIAL_CORRESPONDENT', name: 'District Special Correspondent' },
  { level: 'DISTRICT', code: 'DISTRICT_STRINGER', name: 'District Stringer' },
  { level: 'DISTRICT', code: 'DISTRICT_PHOTO_JOURNALIST', name: 'District Photo Journalist' },

  // --- ASSEMBLY CONSTITUENCY LEVEL ---
  { level: 'ASSEMBLY', code: 'ASSEMBLY_CONSTITUENCY_REPORTER', name: 'Assembly Constituency Reporter' },
  { level: 'ASSEMBLY', code: 'ASSEMBLY_CORRESPONDENT', name: 'Assembly Correspondent' },
  { level: 'ASSEMBLY', code: 'CONSTITUENCY_INCHARGE', name: 'Constituency In-Charge' },
  { level: 'ASSEMBLY', code: 'SENIOR_CONSTITUENCY_REPORTER', name: 'Senior Constituency Reporter' },
  { level: 'ASSEMBLY', code: 'POLITICAL_CONSTITUENCY_REPORTER', name: 'Political Constituency Reporter' },
  { level: 'ASSEMBLY', code: 'ASSEMBLY_BEAT_REPORTER', name: 'Assembly Beat Reporter' },
  { level: 'ASSEMBLY', code: 'LOCAL_POLITICAL_REPORTER', name: 'Local Political Reporter' },

  // --- MANDAL LEVEL ---
  { level: 'MANDAL', code: 'MANDAL_REPORTER', name: 'Mandal Reporter' },
  { level: 'MANDAL', code: 'MANDAL_CORRESPONDENT', name: 'Mandal Correspondent' },
  { level: 'MANDAL', code: 'MANDAL_INCHARGE_REPORTER', name: 'Mandal In-Charge Reporter' },
  { level: 'MANDAL', code: 'SENIOR_MANDAL_REPORTER', name: 'Senior Mandal Reporter' },
  { level: 'MANDAL', code: 'MANDAL_STRINGER', name: 'Mandal Stringer' },
  { level: 'MANDAL', code: 'LOCAL_NEWS_REPORTER', name: 'Local News Reporter' },
  { level: 'MANDAL', code: 'VILLAGE_MANDAL_REPORTER', name: 'Village & Mandal Reporter' },
  { level: 'MANDAL', code: 'RURAL_REPORTER_MANDAL', name: 'Rural Reporter (Mandal Focus)' },
  { level: 'MANDAL', code: 'VILLAGE_REPORTER', name: 'Village Reporter' },
  { level: 'MANDAL', code: 'RURAL_CORRESPONDENT', name: 'Rural Correspondent' },
  { level: 'MANDAL', code: 'GRAM_PANCHAYAT_REPORTER', name: 'Gram Panchayat Reporter' },
  { level: 'MANDAL', code: 'FIELD_REPORTER', name: 'Field Reporter' },
  { level: 'MANDAL', code: 'FREELANCE_REPORTER', name: 'Freelance Reporter (Village / Mandal)' },
];

async function main() {
  console.log(`Seeding ${defaults.length} global reporter designations (tenantId=null)...`);

  const existing = await p.reporterDesignation.findMany({
    where: { tenantId: null, code: { in: defaults.map((d: any) => d.code) } },
    select: { id: true, code: true },
  });
  const byCode = new Map<string, string>();
  for (const row of existing as any[]) {
    if (!byCode.has(String(row.code))) byCode.set(String(row.code), String(row.id));
  }

  const ops = defaults.map((d) => {
    const id = byCode.get(d.code);
    if (id) {
      return p.reporterDesignation.update({ where: { id }, data: { name: d.name, level: d.level } });
    }
    return p.reporterDesignation.create({ data: { tenantId: null, level: d.level, code: d.code, name: d.name } });
  });

  await p.$transaction(ops);
  const count = await p.reporterDesignation.count({ where: { tenantId: null } });
  console.log(`Global designation total (tenantId=null): ${count}`);
  console.log('Global reporter designations seeding complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
