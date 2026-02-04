import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding STATE level editorial designations...\n');

  async function upsertGlobalDesignation(data: {
    level: 'STATE';
    levelOrder: number;
    code: string;
    name: string;
    nativeName: string;
  }) {
    const existing = await prisma.reporterDesignation.findFirst({
      where: { tenantId: null, code: data.code },
      select: { id: true },
    });

    const desired = { tenantId: null as string | null, ...data };
    return existing
      ? prisma.reporterDesignation.update({ where: { id: existing.id }, data: desired })
      : prisma.reporterDesignation.create({ data: desired });
  }

  // 1. Publisher (Highest - levelOrder: 0)
  const publisher = await upsertGlobalDesignation({
    level: 'STATE',
    levelOrder: 0,
    code: 'PUBLISHER',
    name: 'Publisher',
    nativeName: 'ప్రచురణకర్త',
  });
  console.log('✓ Created PUBLISHER designation:', publisher);

  // 2. Chief Editor (levelOrder: 0)
  const chiefEditor = await upsertGlobalDesignation({
    level: 'STATE',
    levelOrder: 0,
    code: 'CHIEF_EDITOR',
    name: 'Chief Editor',
    nativeName: 'ప్రధాన సంపాదకుడు',
  });
  console.log('✓ Created CHIEF_EDITOR designation:', chiefEditor);

  // 3. Editor (levelOrder: 0)
  const editor = await upsertGlobalDesignation({
    level: 'STATE',
    levelOrder: 0,
    code: 'EDITOR',
    name: 'Editor',
    nativeName: 'సంపాదకుడు',
  });
  console.log('✓ Created EDITOR designation:', editor);

  // List all STATE level designations
  const stateDesignations = await prisma.reporterDesignation.findMany({
    where: { tenantId: null, level: 'STATE' },
    orderBy: { levelOrder: 'asc' },
    select: { level: true, code: true, name: true, nativeName: true, levelOrder: true },
  });

  console.log('\n📋 All STATE Level Designations:');
  stateDesignations.forEach((d) => {
    console.log(`  ${d.levelOrder}. ${d.code} - ${d.name} (${d.nativeName})`);
  });

  console.log('\n✅ All editorial designations added successfully!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
