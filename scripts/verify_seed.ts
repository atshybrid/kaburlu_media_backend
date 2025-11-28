import { PrismaClient } from '@prisma/client';

async function run() {
  const prisma = new PrismaClient();
  try {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    const designations = await prisma.reporterDesignation.findMany({ where: { tenantId: null }, orderBy: [{ level: 'asc' }, { code: 'asc' }] });

    console.log('\n=== Roles (' + roles.length + ') ===');
    for (const r of roles) {
      const raw = (r as any).permissions; // permissions stored as JSON
      const perms: string[] = Array.isArray(raw) ? raw.filter(p => typeof p === 'string') : [];
      console.log(r.name.padEnd(14), '->', perms.join(',') || '(none)');
    }

    console.log('\n=== Global Reporter Designations (' + designations.length + ') ===');
    for (const d of designations) {
      console.log(d.level.padEnd(9), d.code.padEnd(24), '->', d.name);
    }

    // Quick sanity: ensure new granular roles exist
    const expected = ['EDITOR','REVIEWER','MODERATOR','ANALYST','SEO_EDITOR'];
    const missing = expected.filter(e => !roles.some(r => r.name === e));
    if (missing.length) {
      console.warn('\n[WARN] Missing expected roles:', missing.join(', '));
    } else {
      console.log('\n[OK] All granular editorial roles present.');
    }
  } catch (e:any) {
    console.error('Verification error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
