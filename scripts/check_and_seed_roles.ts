import prisma from '../src/lib/prisma';

async function checkAndSeedRoles() {
  console.log('🔍 Checking Role table...\n');

  // Check if REPORTER role exists
  const roles = await prisma.role.findMany({
    where: {
      name: { in: ['REPORTER', 'TENANT_ADMIN', 'DESK_EDITOR', 'SUPER_ADMIN'] }
    },
    select: { name: true, permissions: true }
  });

  console.log(`Found ${roles.length} roles:`);
  roles.forEach((r: any) => console.log(`  ✓ ${r.name}`));
  console.log();

  const roleNames = new Set(roles.map((r: any) => r.name));

  if (!roleNames.has('REPORTER')) {
    console.log('❌ REPORTER role missing! Seeding...\n');
    
    const coreRoles: Array<{ name: string; permissions: Record<string, any> }> = [
      { name: 'SUPER_ADMIN', permissions: { all: true } },
      { name: 'TENANT_ADMIN', permissions: { tenants: ['manage'], domains: ['manage'], reporters: ['manage'], articles: ['approve'], shortNews: ['approve'], webArticles: ['approve'] } },
      { name: 'DESK_EDITOR', permissions: { articles: ['edit', 'approve'], shortNews: ['edit', 'approve'], webArticles: ['edit', 'approve'] } },
      { name: 'REPORTER', permissions: { articles: ['create', 'edit_own'], webArticles: ['create', 'edit_own'] } },
    ];

    await prisma.role.createMany({
      data: coreRoles,
      skipDuplicates: true,
    });

    console.log('✅ Roles seeded successfully!\n');
    
    // Verify
    const allRoles = await prisma.role.findMany({ select: { name: true } });
    console.log(`Total roles in database: ${allRoles.length}`);
    allRoles.forEach((r: any) => console.log(`  • ${r.name}`));
  } else {
    console.log('✅ All required roles exist!\n');
  }

  await prisma.$disconnect();
}

checkAndSeedRoles().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
