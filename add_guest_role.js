const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function addGuestRole() {
  try {
    // Check if GUEST role already exists
    const existing = await prisma.role.findUnique({ where: { name: 'GUEST' } });
    
    if (existing) {
      console.log('✓ GUEST role already exists:', existing);
      await prisma.$disconnect();
      return;
    }

    // Create GUEST role
    const guestRole = await prisma.role.create({
      data: {
        name: 'GUEST',
        permissions: {
          articles: { read: true },
          news: { read: true },
          media: { read: true }
        }
      }
    });

    console.log('✓ GUEST role created successfully:', guestRole);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addGuestRole();
