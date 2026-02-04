import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create CONSTITUENCY designation
  const constituency = await prisma.reporterDesignation.upsert({
    where: {
      id: 'constituency-reporter-global',
    },
    update: {
      level: 'CONSTITUENCY',
      levelOrder: 3,
      code: 'CONSTITUENCY_REPORTER',
      name: 'Constituency Reporter',
      nativeName: 'నియోజకవర్గ రిపోర్టర్',
    },
    create: {
      id: 'constituency-reporter-global',
      tenantId: null,
      level: 'CONSTITUENCY',
      levelOrder: 3,
      code: 'CONSTITUENCY_REPORTER',
      name: 'Constituency Reporter',
      nativeName: 'నియోజకవర్గ రిపోర్టర్',
    },
  });

  console.log('✓ Created/Updated CONSTITUENCY designation:', constituency);

  // Update existing RC_INCHARGE to DIVISION level
  const existingRC = await prisma.reporterDesignation.findFirst({
    where: { code: 'RC_INCHARGE', tenantId: null },
  });

  if (existingRC) {
    const updated = await prisma.reporterDesignation.update({
      where: { id: existingRC.id },
      data: {
        level: 'DIVISION',
        levelOrder: 2,
      },
    });
    console.log('✓ Updated RC_INCHARGE to DIVISION level:', updated);
  } else {
    const division = await prisma.reporterDesignation.create({
      data: {
        tenantId: null,
        level: 'DIVISION',
        levelOrder: 2,
        code: 'RC_INCHARGE',
        name: 'RC In-charge',
        nativeName: 'ఆర్సీ ఇన్‌చార్జ్',
      },
    });
    console.log('✓ Created DIVISION designation:', division);
  }

  // List all designations
  const all = await prisma.reporterDesignation.findMany({
    where: { tenantId: null },
    orderBy: { levelOrder: 'asc' },
    select: { level: true, code: true, name: true, nativeName: true, levelOrder: true },
  });

  console.log('\n📋 All Reporter Designations:');
  all.forEach((d) => {
    console.log(`  ${d.levelOrder}. ${d.level} - ${d.code} - ${d.name} (${d.nativeName})`);
  });
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
