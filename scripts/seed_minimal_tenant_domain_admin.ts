import prisma from '../src/lib/prisma';

async function main() {
  console.log('--- Seed Tenant/Domain/Admin start ---');

  // Ensure base roles exist
  const superRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: { name: 'SUPER_ADMIN', permissions: {} }
  });
  const langRole = await prisma.role.upsert({
    where: { name: 'LANGUAGE_ADMIN' },
    update: {},
    create: { name: 'LANGUAGE_ADMIN', permissions: {} }
  });

  // Ensure Telugu language exists
  const teLang = await prisma.language.upsert({
    where: { code: 'te' },
    update: {},
    create: { code: 'te', name: 'Telugu' }
  });

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'kaburlu' },
    update: {},
    create: {
      name: 'Kaburlu',
      slug: 'kaburlu',
      prgiNumber: 'PRGI-TEST-0001'
    }
  });

  // Create domain
  const domain = await prisma.domain.upsert({
    where: { domain: 'app.kaburlumedia.com' },
    update: {},
    create: {
      domain: 'app.kaburlumedia.com',
      status: 'ACTIVE',
      tenantId: tenant.id,
      isPrimary: true,
      verifiedAt: new Date()
    }
  });

  // Create super admin user
  // Create a minimal admin user (note: User schema has no password field; set email + role)
  const email = 'admin@kaburlu.com';
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      roleId: superRole.id,
      languageId: teLang.id
    }
  });

  console.log('Tenant:', tenant.slug, tenant.id);
  console.log('Domain:', domain.domain, domain.id);
  console.log('SuperAdmin:', user.email);
  console.log('--- Seed Tenant/Domain/Admin complete ---');
}

main()
  .catch((e) => {
    console.error('Seed error', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
