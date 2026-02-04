const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reporter = await prisma.reporter.findUnique({
    where: { id: 'cml54silw009bbzyjen9g7qf8' },
    include: {
      idCard: true,
      user: {
        include: {
          profile: { select: { fullName: true, profilePhotoUrl: true } }
        }
      }
    }
  });

  if (!reporter) {
    console.log('❌ Reporter not found');
    return;
  }

  console.log('\n📋 Reporter Details:');
  console.log('   ID:', reporter.id);
  console.log('   Name:', reporter.user?.profile?.fullName || 'N/A');
  console.log('   Mobile:', reporter.user?.mobileNumber || 'N/A');
  console.log('   Reporter.profilePhotoUrl:', reporter.profilePhotoUrl || 'NULL');
  console.log('   User.profile.profilePhotoUrl:', reporter.user?.profile?.profilePhotoUrl || 'NULL');
  
  console.log('\n💳 ID Card Status:');
  if (reporter.idCard) {
    console.log('   ✅ ID Card EXISTS');
    console.log('   Card Number:', reporter.idCard.cardNumber);
    console.log('   PDF URL:', reporter.idCard.pdfUrl || 'NULL');
    console.log('   Issued At:', reporter.idCard.issuedAt);
    console.log('   Expires At:', reporter.idCard.expiresAt);
  } else {
    console.log('   ❌ ID Card NOT FOUND');
  }

  console.log('\n🔍 Photo Check:');
  const hasReporterPhoto = !!reporter.profilePhotoUrl;
  const hasUserPhoto = !!reporter.user?.profile?.profilePhotoUrl;
  const hasAnyPhoto = hasReporterPhoto || hasUserPhoto;
  
  console.log('   Reporter.profilePhotoUrl exists:', hasReporterPhoto ? '✅ YES' : '❌ NO');
  console.log('   User.profile.profilePhotoUrl exists:', hasUserPhoto ? '✅ YES' : '❌ NO');
  console.log('   Can generate ID card:', hasAnyPhoto ? '✅ YES' : '❌ NO - PHOTO REQUIRED');

  await prisma.$disconnect();
}

main().catch(console.error);
