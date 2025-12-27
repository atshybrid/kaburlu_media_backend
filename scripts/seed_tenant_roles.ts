import prisma from '../src/lib/prisma';

async function main() {
  console.log('--- Seed Tenant & Reporter Roles start ---');
  const roleNames = [
    'TENANT_ADMIN',
    'ADMIN_EDITOR',
    'NEWS_MODERATOR',
    'PARENT_REPORTER',
    'REPORTER',
    'GUEST_REPORTER'
  ];

  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, permissions: {} }
    });
    console.log('Role ensured:', role.name);
  }

  console.log('--- Seed Tenant & Reporter Roles complete ---');
}

main()
  .catch((e) => { console.error('Seed error', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
