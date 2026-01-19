import prisma from '../src/lib/prisma';

async function checkCountry() {
  const india = await prisma.country.findFirst({
    where: { name: 'India' }
  });

  if (india) {
    console.log('India country:', india);
  } else {
    console.log('No India country found');
  }

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' },
    include: { country: true }
  });

  if (telangana) {
    console.log('Telangana state:', telangana);
  }

  await prisma.$disconnect();
}

checkCountry();
