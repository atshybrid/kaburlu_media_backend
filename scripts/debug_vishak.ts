import { searchGeoLocations } from '../src/api/locations/locations.service';
import prisma from '../src/lib/prisma';

async function debugVishakapatnam() {
  console.log('\n🔍 Debugging "vishakapatnam" search\n');

  // First, check what's in the database
  const districts = await prisma.district.findMany({
    where: {
      name: { contains: 'vishak', mode: 'insensitive' }
    },
    select: { name: true }
  });

  console.log('Districts with "vishak":', districts.map(d => d.name));

  const districts2 = await prisma.district.findMany({
    where: {
      name: { contains: 'visak', mode: 'insensitive' }
    },
    select: { name: true }
  });

  console.log('Districts with "visak":', districts2.map(d => d.name));

  // Test the search
  const results = await searchGeoLocations({
    q: 'vishakapatnam',
    limit: 10,
    types: ['DISTRICT']
  });

  console.log('\nSearch results for "vishakapatnam":');
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}`);
  });

  await prisma.$disconnect();
}

debugVishakapatnam();
