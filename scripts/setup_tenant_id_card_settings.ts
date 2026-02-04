import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 'cmkh94g0s01eykb21toi1oucu'; // PRASHNA AYUDHAM

  // Check if settings exist
  const existing = await prisma.tenantIdCardSettings.findUnique({
    where: { tenantId }
  });

  if (existing) {
    console.log('✓ Tenant ID card settings already exist');
    console.log(JSON.stringify(existing, null, 2));
    return;
  }

  // Create default settings
  const settings = await prisma.tenantIdCardSettings.create({
    data: {
      tenantId,
      templateId: 'STYLE_1',
      idPrefix: 'PA',  // Prashna Ayudham
      idDigits: 4,
      validityType: 'PER_USER_DAYS',
      validityDays: 365,
      primaryColor: '#FF6B35',
      secondaryColor: '#FFFFFF',
      officeAddress: 'Prashna Ayudham Office',
      helpLine1: '1800-XXX-XXXX',
    }
  });

  console.log('✓ Created tenant ID card settings:');
  console.log(JSON.stringify(settings, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
