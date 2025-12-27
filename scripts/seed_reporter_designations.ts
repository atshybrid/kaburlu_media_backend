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

// Default designation set (same codes as global list). This script seeds PER TENANT copies.
// Only use levels defined in ReporterLevel enum: STATE | DISTRICT | ASSEMBLY | MANDAL
const defaults: { level: 'STATE' | 'DISTRICT' | 'ASSEMBLY' | 'MANDAL'; code: string; name: string }[] = [
  { level: 'STATE', code: 'EDITOR_IN_CHIEF', name: 'Editor-in-Chief' },
  { level: 'STATE', code: 'STATE_BUREAU_CHIEF', name: 'State Bureau Chief' },
  { level: 'STATE', code: 'STATE_EDITOR', name: 'State Editor' },
  { level: 'STATE', code: 'STATE_REPORTER', name: 'State Reporter' },
  { level: 'DISTRICT', code: 'DISTRICT_BUREAU_CHIEF', name: 'District Bureau Chief' },
  { level: 'DISTRICT', code: 'SENIOR_CORRESPONDENT', name: 'Senior Correspondent' },
  { level: 'DISTRICT', code: 'DISTRICT_REPORTER', name: 'District Reporter' },
  { level: 'DISTRICT', code: 'DISTRICT_DESK', name: 'District Desk' },
  { level: 'ASSEMBLY', code: 'ASSEMBLY_INCHARGE', name: 'Assembly Incharge' },
  { level: 'ASSEMBLY', code: 'ASSEMBLY_REPORTER', name: 'Assembly Reporter' },
  { level: 'MANDAL', code: 'MANDAL_REPORTER', name: 'Mandal Reporter' },
  { level: 'MANDAL', code: 'MANDAL_STRINGER', name: 'Mandal Stringer' }
];

async function main() {
  const tenants = await p.tenant.findMany({ select: { id: true, slug: true } });
  console.log(`Seeding reporter designations for ${tenants.length} tenants...`);
  for (const t of tenants) {
    const ops = defaults.map(d => p.reporterDesignation.upsert({
      where: { tenantId_code: { tenantId: t.id, code: d.code } },
      update: { name: d.name, level: d.level },
      create: { tenantId: t.id, level: d.level, code: d.code, name: d.name }
    }));
    await p.$transaction(ops);
    const count = await p.reporterDesignation.count({ where: { tenantId: t.id } });
    console.log(`Tenant ${t.slug} (${t.id}) designation total: ${count}`);
  }
  console.log('Tenant reporter designations seeding complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
