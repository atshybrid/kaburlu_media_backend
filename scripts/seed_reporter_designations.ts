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
// Levels defined in ReporterLevel enum: STATE | DISTRICT | DIVISION | CONSTITUENCY | ASSEMBLY | MANDAL
const defaults: { level: 'STATE' | 'DISTRICT' | 'DIVISION' | 'CONSTITUENCY' | 'ASSEMBLY' | 'MANDAL'; code: string; name: string; nativeName: string; levelOrder: number }[] = [
  // --- STATE LEVEL (levelOrder: 1 = highest) ---
  { level: 'STATE', code: 'EDITOR_IN_CHIEF',                name: 'Editor-in-Chief',                      nativeName: 'ఎడిటర్-ఇన్-చీఫ్',                    levelOrder: 1 },
  { level: 'STATE', code: 'STATE_EDITOR',                   name: 'State Editor',                         nativeName: 'స్టేట్ ఎడిటర్',                        levelOrder: 1 },
  { level: 'STATE', code: 'CHIEF_EDITOR',                   name: 'Chief Editor',                         nativeName: 'ప్రధాన సంపాదకుడు',                     levelOrder: 1 },
  { level: 'STATE', code: 'EXECUTIVE_EDITOR',               name: 'Executive Editor',                     nativeName: 'ఎగ్జిక్యూటివ్ ఎడిటర్',                levelOrder: 1 },
  { level: 'STATE', code: 'STATE_BUREAU_CHIEF',             name: 'State Bureau Chief',                   nativeName: 'స్టేట్ బ్యూరో చీఫ్',                  levelOrder: 1 },
  { level: 'STATE', code: 'STATE_POLITICAL_EDITOR',         name: 'State Political Editor',               nativeName: 'స్టేట్ పొలిటికల్ ఎడిటర్',             levelOrder: 1 },
  { level: 'STATE', code: 'STATE_SPECIAL_CORRESPONDENT',    name: 'State Special Correspondent',          nativeName: 'స్టేట్ స్పెషల్ కరస్పాండెంట్',         levelOrder: 1 },
  { level: 'STATE', code: 'SENIOR_POLITICAL_CORRESPONDENT', name: 'Senior Political Correspondent',       nativeName: 'సీనియర్ పొలిటికల్ కరస్పాండెంట్',      levelOrder: 1 },
  { level: 'STATE', code: 'STATE_REPORTER',                 name: 'State Reporter',                       nativeName: 'స్టేట్ రిపోర్టర్',                     levelOrder: 1 },
  { level: 'STATE', code: 'STATE_INVESTIGATIVE_REPORTER',   name: 'Investigative Reporter (State Level)',  nativeName: 'దర్యాప్తు విలేకరి',                    levelOrder: 1 },
  { level: 'STATE', code: 'STATE_CRIME_REPORTER',           name: 'State Crime Reporter',                 nativeName: 'స్టేట్ క్రైమ్ రిపోర్టర్',             levelOrder: 1 },
  { level: 'STATE', code: 'STATE_FEATURES_EDITOR',          name: 'State Features Editor',                nativeName: 'స్టేట్ ఫీచర్స్ ఎడిటర్',               levelOrder: 1 },
  { level: 'STATE', code: 'SENIOR_CRIME_CORRESPONDENT',     name: 'Senior Crime Correspondent',           nativeName: 'సీనియర్ క్రైమ్ కరస్పాండెంట్',         levelOrder: 1 },
  { level: 'STATE', code: 'NEWS_EDITOR',                    name: 'News Editor',                          nativeName: 'న్యూస్ ఎడిటర్',                        levelOrder: 1 },
  { level: 'STATE', code: 'CHIEF_PHOTOGRAPHER',             name: 'Chief Photographer',                   nativeName: 'చీఫ్ ఫోటోగ్రాఫర్',                    levelOrder: 1 },

  // --- DISTRICT LEVEL (levelOrder: 2) ---
  { level: 'DISTRICT', code: 'DISTRICT_BUREAU_CHIEF',          name: 'District Bureau Chief',          nativeName: 'జిల్లా బ్యూరో చీఫ్',                  levelOrder: 2 },
  { level: 'DISTRICT', code: 'DISTRICT_EDITOR',                name: 'District Editor',                nativeName: 'జిల్లా సంపాదకుడు',                     levelOrder: 2 },
  { level: 'DISTRICT', code: 'DISTRICT_CORRESPONDENT',         name: 'District Correspondent',         nativeName: 'జిల్లా కరస్పాండెంట్',                 levelOrder: 2 },
  { level: 'DISTRICT', code: 'STAFF_REPORTER',                 name: 'Staff Reporter',                 nativeName: 'స్టాఫ్ రిపోర్టర్',                     levelOrder: 2 },
  { level: 'DISTRICT', code: 'SENIOR_REPORTER',                name: 'Senior Reporter',                nativeName: 'సీనియర్ రిపోర్టర్',                    levelOrder: 2 },
  { level: 'DISTRICT', code: 'SENIOR_DISTRICT_REPORTER',       name: 'Senior District Reporter',       nativeName: 'సీనియర్ జిల్లా రిపోర్టర్',             levelOrder: 2 },
  { level: 'DISTRICT', code: 'DISTRICT_POLITICAL_REPORTER',    name: 'District Political Reporter',    nativeName: 'జిల్లా రాజకీయ విలేకరి',                levelOrder: 2 },
  { level: 'DISTRICT', code: 'DISTRICT_CRIME_REPORTER',        name: 'District Crime Reporter',        nativeName: 'జిల్లా క్రైమ్ రిపోర్టర్',             levelOrder: 2 },
  { level: 'DISTRICT', code: 'CRIME_REPORTER',                 name: 'Crime Reporter',                 nativeName: 'క్రైమ్ రిపోర్టర్',                     levelOrder: 2 },
  { level: 'DISTRICT', code: 'COURT_REPORTER',                 name: 'Court Reporter',                 nativeName: 'కోర్టు విలేకరి',                        levelOrder: 2 },
  { level: 'DISTRICT', code: 'DISTRICT_SPECIAL_CORRESPONDENT', name: 'District Special Correspondent', nativeName: 'జిల్లా స్పెషల్ కరస్పాండెంట్',          levelOrder: 2 },
  { level: 'DISTRICT', code: 'DISTRICT_STRINGER',              name: 'District Stringer',              nativeName: 'జిల్లా స్ట్రింగర్',                    levelOrder: 2 },
  { level: 'DISTRICT', code: 'DISTRICT_PHOTO_JOURNALIST',      name: 'District Photo Journalist',      nativeName: 'జిల్లా ఫోటో జర్నలిస్ట్',              levelOrder: 2 },
  { level: 'DISTRICT', code: 'STAFF_PHOTOGRAPHER',             name: 'Staff Photographer',             nativeName: 'స్టాఫ్ ఫోటోగ్రాఫర్',                  levelOrder: 2 },
  { level: 'DISTRICT', code: 'PHOTO_JOURNALIST',               name: 'Photojournalist',                nativeName: 'ఫోటో జర్నలిస్ట్',                     levelOrder: 2 },
  { level: 'DISTRICT', code: 'VIDEO_JOURNALIST',               name: 'Video Journalist (VJ)',          nativeName: 'వీడియో జర్నలిస్ట్',                   levelOrder: 2 },
  { level: 'DISTRICT', code: 'CAMERAMAN',                      name: 'Cameraman',                      nativeName: 'కెమెరామన్',                             levelOrder: 2 },
  { level: 'DISTRICT', code: 'BUREAU_REPORTER',                name: 'Bureau Reporter',                nativeName: 'బ్యూరో రిపోర్టర్',                    levelOrder: 2 },
  { level: 'DISTRICT', code: 'GENERAL_REPORTER',               name: 'General Reporter',               nativeName: 'జనరల్ రిపోర్టర్',                     levelOrder: 2 },
  { level: 'DISTRICT', code: 'SUB_EDITOR',                     name: 'Sub-Editor (Desk)',              nativeName: 'సబ్ ఎడిటర్',                           levelOrder: 2 },
  { level: 'DISTRICT', code: 'ASSIGNMENT_EDITOR',              name: 'Assignment Editor',              nativeName: 'అసైన్‌మెంట్ ఎడిటర్',                  levelOrder: 2 },

  // --- DIVISION LEVEL (levelOrder: 3) ---
  { level: 'DIVISION', code: 'RC_INCHARGE',            name: 'RC In-charge',           nativeName: 'ఆర్‌సీ ఇన్‌చార్జ్',       levelOrder: 3 },
  { level: 'DIVISION', code: 'DIVISION_CORRESPONDENT', name: 'Division Correspondent',  nativeName: 'డివిజన్ కరస్పాండెంట్',   levelOrder: 3 },
  { level: 'DIVISION', code: 'DIVISION_REPORTER',      name: 'Division Reporter',       nativeName: 'డివిజన్ రిపోర్టర్',      levelOrder: 3 },
  { level: 'DIVISION', code: 'AREA_REPORTER',          name: 'Area Reporter',           nativeName: 'ఏరియా రిపోర్టర్',         levelOrder: 3 },

  // --- CONSTITUENCY LEVEL (levelOrder: 3) ---
  { level: 'CONSTITUENCY', code: 'CONSTITUENCY_REPORTER', name: 'Constituency Reporter', nativeName: 'నియోజకవర్గ రిపోర్టర్',  levelOrder: 3 },
  { level: 'CONSTITUENCY', code: 'POLITICAL_REPORTER',    name: 'Political Reporter',    nativeName: 'రాజకీయ విలేకరి',         levelOrder: 3 },

  // --- ASSEMBLY CONSTITUENCY LEVEL (levelOrder: 3) ---
  { level: 'ASSEMBLY', code: 'ASSEMBLY_CONSTITUENCY_REPORTER',  name: 'Assembly Constituency Reporter',  nativeName: 'అసెంబ్లీ నియోజకవర్గ రిపోర్టర్',     levelOrder: 3 },
  { level: 'ASSEMBLY', code: 'ASSEMBLY_CORRESPONDENT',          name: 'Assembly Correspondent',          nativeName: 'అసెంబ్లీ కరస్పాండెంట్',             levelOrder: 3 },
  { level: 'ASSEMBLY', code: 'CONSTITUENCY_INCHARGE',           name: 'Constituency In-Charge',          nativeName: 'నియోజకవర్గ ఇన్‌చార్జ్',              levelOrder: 3 },
  { level: 'ASSEMBLY', code: 'SENIOR_CONSTITUENCY_REPORTER',    name: 'Senior Constituency Reporter',    nativeName: 'సీనియర్ నియోజకవర్గ రిపోర్టర్',      levelOrder: 3 },
  { level: 'ASSEMBLY', code: 'POLITICAL_CONSTITUENCY_REPORTER', name: 'Political Constituency Reporter', nativeName: 'రాజకీయ నియోజకవర్గ విలేకరి',          levelOrder: 3 },
  { level: 'ASSEMBLY', code: 'ASSEMBLY_BEAT_REPORTER',          name: 'Assembly Beat Reporter',          nativeName: 'అసెంబ్లీ బీట్ రిపోర్టర్',           levelOrder: 3 },
  { level: 'ASSEMBLY', code: 'LOCAL_POLITICAL_REPORTER',        name: 'Local Political Reporter',        nativeName: 'స్థానిక రాజకీయ విలేకరి',             levelOrder: 3 },

  // --- MANDAL LEVEL (levelOrder: 4 = ground level) ---
  { level: 'MANDAL', code: 'MANDAL_REPORTER',          name: 'Mandal Reporter',                    nativeName: 'మండల రిపోర్టర్',                  levelOrder: 4 },
  { level: 'MANDAL', code: 'MANDAL_CORRESPONDENT',     name: 'Mandal Correspondent',               nativeName: 'మండల కరస్పాండెంట్',              levelOrder: 4 },
  { level: 'MANDAL', code: 'MANDAL_INCHARGE_REPORTER', name: 'Mandal In-Charge Reporter',          nativeName: 'మండల ఇన్‌చార్జ్ రిపోర్టర్',      levelOrder: 4 },
  { level: 'MANDAL', code: 'SENIOR_MANDAL_REPORTER',   name: 'Senior Mandal Reporter',             nativeName: 'సీనియర్ మండల రిపోర్టర్',          levelOrder: 4 },
  { level: 'MANDAL', code: 'STRINGER',                 name: 'Stringer',                           nativeName: 'స్ట్రింగర్',                       levelOrder: 4 },
  { level: 'MANDAL', code: 'MANDAL_STRINGER',          name: 'Mandal Stringer',                    nativeName: 'మండల స్ట్రింగర్',                 levelOrder: 4 },
  { level: 'MANDAL', code: 'LOCAL_NEWS_REPORTER',      name: 'Local News Reporter',                nativeName: 'స్థానిక వార్తా విలేకరి',          levelOrder: 4 },
  { level: 'MANDAL', code: 'VILLAGE_MANDAL_REPORTER',  name: 'Village & Mandal Reporter',          nativeName: 'గ్రామ మండల రిపోర్టర్',            levelOrder: 4 },
  { level: 'MANDAL', code: 'RURAL_REPORTER_MANDAL',    name: 'Rural Reporter (Mandal Focus)',       nativeName: 'గ్రామీణ రిపోర్టర్',               levelOrder: 4 },
  { level: 'MANDAL', code: 'VILLAGE_REPORTER',         name: 'Village Reporter',                   nativeName: 'గ్రామ రిపోర్టర్',                 levelOrder: 4 },
  { level: 'MANDAL', code: 'RURAL_CORRESPONDENT',      name: 'Rural Correspondent',                nativeName: 'గ్రామీణ కరస్పాండెంట్',            levelOrder: 4 },
  { level: 'MANDAL', code: 'GRAM_PANCHAYAT_REPORTER',  name: 'Gram Panchayat Reporter',            nativeName: 'గ్రామ పంచాయతీ రిపోర్టర్',         levelOrder: 4 },
  { level: 'MANDAL', code: 'FIELD_REPORTER',           name: 'Field Reporter',                     nativeName: 'ఫీల్డ్ రిపోర్టర్',               levelOrder: 4 },
  { level: 'MANDAL', code: 'FREELANCE_REPORTER',       name: 'Freelance Reporter (Village / Mandal)', nativeName: 'ఫ్రీలాన్స్ రిపోర్టర్',           levelOrder: 4 },
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
      return p.reporterDesignation.update({ where: { id }, data: { name: d.name, nativeName: d.nativeName, level: d.level, levelOrder: d.levelOrder } });
    }
    return p.reporterDesignation.create({ data: { tenantId: null, level: d.level, code: d.code, name: d.name, nativeName: d.nativeName, levelOrder: d.levelOrder } });
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
