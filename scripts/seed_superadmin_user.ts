import prisma from '../src/lib/prisma';

async function main() {
  console.log('--- Seed Super Admin User start ---');

  // Ensure roles exist
  const role = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: { name: 'SUPER_ADMIN', permissions: {} }
  });

  // Ensure Telugu language exists
  const te = await prisma.language.upsert({
    where: { code: 'te' },
    update: {},
    create: { code: 'te', name: 'Telugu' }
  });

  // Upsert user by mobileNumber
  const user = await prisma.user.upsert({
    where: { mobileNumber: '9392010248' },
    update: {
      mpin: '1947',
      roleId: role.id,
      languageId: te.id,
      status: 'ACTIVE'
    },
    create: {
      mobileNumber: '9392010248',
      mpin: '1947',
      roleId: role.id,
      languageId: te.id,
      status: 'ACTIVE'
    }
  });

  console.log('Super Admin seeded:', user.mobileNumber, user.id);
  console.log('--- Seed Super Admin User complete ---');
}

main()
  .catch((e) => { console.error('Seed error', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
