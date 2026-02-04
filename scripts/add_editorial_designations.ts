import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding STATE level editorial designations...\n');

  // 1. Publisher (Highest - levelOrder: 0)
  const publisher = await prisma.reporterDesignation.upsert({
    where: {
      id: 'publisher-global',
    },
    update: {
      level: 'STATE',
      levelOrder: 0,
      code: 'PUBLISHER',
      name: 'Publisher',
      nativeName: 'ప్రచురణకర్త',
    },
    create: {
      id: 'publisher-global',
      tenantId: null,
      level: 'STATE',
      levelOrder: 0,
      code: 'PUBLISHER',
      name: 'Publisher',
      nativeName: 'ప్రచురణకర్త',
    },
  });
  console.log('✓ Created PUBLISHER designation:', publisher);

  // 2. Chief Editor (levelOrder: 0)
  const chiefEditor = await prisma.reporterDesignation.upsert({
    where: {
      id: 'chief-editor-global',
    },
    update: {
      level: 'STATE',
      levelOrder: 0,
      code: 'CHIEF_EDITOR',
      name: 'Chief Editor',
      nativeName: 'ప్రధాన సంపాదకుడు',
    },
    create: {
      id: 'chief-editor-global',
      tenantId: null,
      level: 'STATE',
      levelOrder: 0,
      code: 'CHIEF_EDITOR',
      name: 'Chief Editor',
      nativeName: 'ప్రధాన సంపాదకుడు',
    },
  });
  console.log('✓ Created CHIEF_EDITOR designation:', chiefEditor);

  // 3. Editor (levelOrder: 0)
  const editor = await prisma.reporterDesignation.upsert({
    where: {
      id: 'editor-global',
    },
    update: {
      level: 'STATE',
      levelOrder: 0,
      code: 'EDITOR',
      name: 'Editor',
      nativeName: 'సంపాదకుడు',
    },
    create: {
      id: 'editor-global',
      tenantId: null,
      level: 'STATE',
      levelOrder: 0,
      code: 'EDITOR',
      name: 'Editor',
      nativeName: 'సంపాదకుడు',
    },
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
