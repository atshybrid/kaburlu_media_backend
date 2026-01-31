const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = 'cmkk4at2e01nbqn1vmndmrevt';
  const contactPerson = 'madhav rao patel';
  const contactMobile = '9666665026';
  const contactEmail = 'madhavraopatels@gmail.com';
  
  // Check tenant exists
  const tenant = await prisma.tenant.findUnique({ 
    where: { id: tenantId }, 
    select: { id: true, name: true, slug: true, prgiNumber: true } 
  });
  console.log('Tenant:', JSON.stringify(tenant, null, 2));
  
  if (!tenant) {
    console.log('❌ Tenant not found');
    return;
  }
  
  // Check if entity exists
  const entity = await prisma.tenantEntity.findUnique({ where: { tenantId } });
  console.log('Existing Entity:', entity ? 'Found' : 'Not found');
  
  if (entity) {
    // Update existing entity
    const updated = await prisma.tenantEntity.update({
      where: { tenantId },
      data: {
        contactPerson,
        contactMobile,
        contactEmail,
      }
    });
    console.log('\n✅ Entity Updated:');
    console.log('  contactPerson:', updated.contactPerson);
    console.log('  contactMobile:', updated.contactMobile);
    console.log('  contactEmail:', updated.contactEmail);
  } else {
    // Create new entity with prgiNumber
    const prgiNumber = tenant.prgiNumber || `PRGI-${Date.now()}`;
    const created = await prisma.tenantEntity.create({
      data: {
        tenantId,
        prgiNumber,
        contactPerson,
        contactMobile,
        contactEmail,
      }
    });
    console.log('\n✅ Entity Created:');
    console.log('  prgiNumber:', created.prgiNumber);
    console.log('  contactPerson:', created.contactPerson);
    console.log('  contactMobile:', created.contactMobile);
    console.log('  contactEmail:', created.contactEmail);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
