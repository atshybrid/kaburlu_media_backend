/**
 * Seed script: Democratic Journalist Federation (Working) — Andhra Pradesh
 * Posts + Settings → JournalistUnionPostDefinition + JournalistUnionSettings
 *
 * Safe to re-run: skips posts that already exist (matches on unionName+level+title).
 * Run: npx ts-node scripts/seed_djf_posts.ts
 */
import prisma from '../src/lib/prisma';

const UNION_NAME = 'Democratic Journalist Federation (Working)';
const STATE = 'Andhra Pradesh';

// ─────────────────────────────────────────────────────────────────────────────
// Post definitions
// type: ELECTED  = voted in by members (President, Secretary, etc.)
// type: APPOINTED = assigned by leadership (Legal Advisor, Media Coordinator, Executive Members)
// ─────────────────────────────────────────────────────────────────────────────
const POSTS = [
  // ── STATE LEVEL ───────────────────────────────────────────────────────────
  { level: 'STATE', title: 'State President',          nativeTitle: 'రాష్ట్ర అధ్యక్షుడు',          type: 'ELECTED',   maxSeats: 1,  sortOrder: 1  },
  { level: 'STATE', title: 'Working President',        nativeTitle: 'కార్యనిర్వాహక అధ్యక్షుడు',    type: 'ELECTED',   maxSeats: 1,  sortOrder: 2  },
  { level: 'STATE', title: 'Vice President',           nativeTitle: 'ఉపాధ్యక్షుడు',               type: 'ELECTED',   maxSeats: 4,  sortOrder: 3  },
  { level: 'STATE', title: 'General Secretary',        nativeTitle: 'ప్రధాన కార్యదర్శి',          type: 'ELECTED',   maxSeats: 1,  sortOrder: 4  },
  { level: 'STATE', title: 'State Secretary',          nativeTitle: 'రాష్ట్ర కార్యదర్శి',          type: 'ELECTED',   maxSeats: 3,  sortOrder: 5  },
  { level: 'STATE', title: 'Joint Secretary',          nativeTitle: 'సంయుక్త కార్యదర్శి',          type: 'ELECTED',   maxSeats: 3,  sortOrder: 6  },
  { level: 'STATE', title: 'Treasurer',                nativeTitle: 'కోశాధికారి',                  type: 'ELECTED',   maxSeats: 1,  sortOrder: 7  },
  { level: 'STATE', title: 'Organizing Secretary',     nativeTitle: 'సంఘటనా కార్యదర్శి',           type: 'ELECTED',   maxSeats: 1,  sortOrder: 8  },
  { level: 'STATE', title: 'Executive Member',         nativeTitle: 'కార్యనిర్వాహక సభ్యుడు',       type: 'APPOINTED', maxSeats: 15, sortOrder: 9  },
  { level: 'STATE', title: 'Legal Advisor',            nativeTitle: 'న్యాయ సలహాదారు',             type: 'APPOINTED', maxSeats: 1,  sortOrder: 10 },
  { level: 'STATE', title: 'Media Coordinator',        nativeTitle: 'మీడియా సమన్వయకర్త',          type: 'APPOINTED', maxSeats: 1,  sortOrder: 11 },

  // ── DISTRICT LEVEL ────────────────────────────────────────────────────────
  { level: 'DISTRICT', title: 'District President',        nativeTitle: 'జిల్లా అధ్యక్షుడు',           type: 'ELECTED',   maxSeats: 1,  sortOrder: 1  },
  { level: 'DISTRICT', title: 'District Vice President',   nativeTitle: 'జిల్లా ఉపాధ్యక్షుడు',        type: 'ELECTED',   maxSeats: 2,  sortOrder: 2  },
  { level: 'DISTRICT', title: 'District General Secretary',nativeTitle: 'జిల్లా ప్రధాన కార్యదర్శి',   type: 'ELECTED',   maxSeats: 1,  sortOrder: 3  },
  { level: 'DISTRICT', title: 'District Secretary',        nativeTitle: 'జిల్లా కార్యదర్శి',           type: 'ELECTED',   maxSeats: 2,  sortOrder: 4  },
  { level: 'DISTRICT', title: 'District Joint Secretary',  nativeTitle: 'జిల్లా సంయుక్త కార్యదర్శి',  type: 'ELECTED',   maxSeats: 2,  sortOrder: 5  },
  { level: 'DISTRICT', title: 'District Treasurer',        nativeTitle: 'జిల్లా కోశాధికారి',           type: 'ELECTED',   maxSeats: 1,  sortOrder: 6  },
  { level: 'DISTRICT', title: 'District Executive Member', nativeTitle: 'జిల్లా కార్యనిర్వాహక సభ్యుడు', type: 'APPOINTED', maxSeats: 10, sortOrder: 7  },

  // ── MANDAL LEVEL ──────────────────────────────────────────────────────────
  { level: 'MANDAL', title: 'Mandal President', nativeTitle: 'మండల అధ్యక్షుడు',  type: 'ELECTED',   maxSeats: 1,  sortOrder: 1 },
  { level: 'MANDAL', title: 'Mandal Secretary', nativeTitle: 'మండల కార్యదర్శి',  type: 'ELECTED',   maxSeats: 1,  sortOrder: 2 },
  { level: 'MANDAL', title: 'Mandal Member',    nativeTitle: 'మండల సభ్యుడు',     type: 'APPOINTED', maxSeats: 10, sortOrder: 3 },
];

async function main() {
  console.log(`\n📋 Seeding posts for: ${UNION_NAME}\n`);

  // ── 1. Upsert union settings ───────────────────────────────────────────────
  const settings = await (prisma as any).journalistUnionSettings.upsert({
    where: { unionName: UNION_NAME },
    create: {
      unionName: UNION_NAME,
      displayName: 'Democratic Journalist Federation (Working)',
      state: STATE,
    },
    update: {
      // only set state if not already set; don't overwrite any other saved fields
      state: STATE,
    },
  });
  console.log(`✅ Settings upserted (id: ${settings.id})`);

  // ── 2. Check existing posts ────────────────────────────────────────────────
  const existing = await (prisma as any).journalistUnionPostDefinition.findMany({
    where: { unionName: UNION_NAME },
    select: { title: true, level: true },
  });
  const existingKeys = new Set(existing.map((e: any) => `${e.level}:${e.title}`));
  console.log(`   Found ${existing.length} existing post definitions for this union`);

  // ── 3. Filter and insert new ───────────────────────────────────────────────
  const toCreate = POSTS
    .filter(p => !existingKeys.has(`${p.level}:${p.title}`))
    .map(p => ({ ...p, unionName: UNION_NAME, isActive: true }));

  if (toCreate.length === 0) {
    console.log('   All posts already seeded. Nothing to create.\n');
  } else {
    await (prisma as any).journalistUnionPostDefinition.createMany({ data: toCreate });
    console.log(`\n✅ Created ${toCreate.length} post definitions (${POSTS.length - toCreate.length} skipped as existing)\n`);

    // Print summary grouped by level
    const byLevel: Record<string, typeof toCreate> = {};
    for (const p of toCreate) {
      (byLevel[p.level] = byLevel[p.level] || []).push(p);
    }
    for (const [level, posts] of Object.entries(byLevel)) {
      console.log(`  [${level}]`);
      for (const p of posts) {
        console.log(`    • ${p.title} (${p.type}, seats: ${p.maxSeats})`);
      }
    }
  }

  // ── 4. Final count ────────────────────────────────────────────────────────
  const total = await (prisma as any).journalistUnionPostDefinition.count({
    where: { unionName: UNION_NAME },
  });
  console.log(`\n📊 Total post definitions in DB for this union: ${total}`);
  console.log('\nDone.\n');
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
