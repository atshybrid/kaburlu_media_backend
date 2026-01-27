import prisma from '../src/lib/prisma';

async function testReporterRole() {
  console.log('🔍 Testing REPORTER role lookup in transaction...\n');

  try {
    await prisma.$transaction(async (tx) => {
      // This is what the code does
      const role = await tx.role.findFirst({ where: { name: 'REPORTER' } });
      
      if (!role) {
        console.log('❌ REPORTER role NOT found in transaction!');
        throw new Error('REPORTER role missing. Seed roles.');
      }
      
      console.log('✅ REPORTER role found in transaction:');
      console.log(`   ID: ${role.id}`);
      console.log(`   Name: ${role.name}`);
      console.log(`   Permissions:`, JSON.stringify(role.permissions, null, 2));
    });
    
    console.log('\n✅ Transaction test passed!\n');
    
  } catch (error: any) {
    console.error('\n❌ Transaction test failed:', error.message);
  }

  await prisma.$disconnect();
}

testReporterRole();
