import { ensureCoreSeeds } from '../src/lib/bootstrap';
import prisma from '../src/lib/prisma';

async function runBootstrap() {
  console.log('🚀 Running bootstrap manually...\n');
  
  try {
    await ensureCoreSeeds();
    console.log('\n✅ Bootstrap completed successfully!\n');
    
    // Verify REPORTER role
    const role = await prisma.role.findFirst({ where: { name: 'REPORTER' } });
    if (role) {
      console.log('✓ REPORTER role confirmed:', role.id);
    } else {
      console.log('❌ REPORTER role still missing!');
    }
    
  } catch (error: any) {
    console.error('❌ Bootstrap failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

runBootstrap();
