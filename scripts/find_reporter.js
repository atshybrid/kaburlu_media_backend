const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mobile = '9118191991';
  
  // Find user and reporter
  const user = await prisma.user.findFirst({
    where: { mobileNumber: mobile },
    include: {
      reporterProfile: {
        include: {
          idCard: true,
          tenant: { select: { id: true, name: true } }
        }
      }
    }
  });
  
  if (!user) {
    console.log('❌ User not found for mobile:', mobile);
    return;
  }
  
  console.log('User ID:', user.id);
  console.log('Reporter:', user.reporterProfile ? 'Found' : 'Not found');
  
  if (user.reporterProfile) {
    console.log('Reporter ID:', user.reporterProfile.id);
    console.log('Tenant ID:', user.reporterProfile.tenantId);
    console.log('Tenant Name:', user.reporterProfile.tenant?.name);
    console.log('ID Card:', user.reporterProfile.idCard ? 'Exists' : 'Not found');
    if (user.reporterProfile.idCard) {
      console.log('  Card Number:', user.reporterProfile.idCard.cardNumber);
      console.log('  PDF URL:', user.reporterProfile.idCard.pdfUrl ? 'Yes' : 'No');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
