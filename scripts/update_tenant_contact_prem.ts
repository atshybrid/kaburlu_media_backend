import prisma from '../src/lib/prisma';

async function updateTenantContact() {
  try {
    console.log('Updating tenant entity contact...');
    
    const updated = await prisma.tenantEntity.upsert({
      where: { tenantId: 'cmkjb7vn201krqv1w7982m6xa' },
      update: {
        contactPerson: 'Prem Kumar Donikana',
        contactMobile: '9948148154',
        contactEmail: 'kittudonikena88@gmail.com'
      },
      create: {
        tenantId: 'cmkjb7vn201krqv1w7982m6xa',
        prgiNumber: '', // Required field
        contactPerson: 'Prem Kumar Donikana',
        contactMobile: '9948148154',
        contactEmail: 'kittudonikena88@gmail.com'
      }
    });
    
    console.log('✅ Tenant Entity Contact Updated Successfully!');
    console.log('Tenant ID:', updated.tenantId);
    console.log('Contact Person:', updated.contactPerson);
    console.log('Contact Mobile:', updated.contactMobile);
    console.log('Contact Email:', updated.contactEmail);
    
  } catch (error: any) {
    console.error('❌ Error updating tenant contact:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateTenantContact();
