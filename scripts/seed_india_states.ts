import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Minimal canonical list of Indian states and union territories
const INDIA_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]

async function main() {
  // Ensure country INDIA exists
  const country = await prisma.country.upsert({
    where: { code: 'IN' },
    update: {},
    create: { code: 'IN', name: 'India' },
  })

  let created = 0
  let updated = 0

  for (const name of INDIA_STATES) {
    const state = await prisma.state.findFirst({
      where: { name, countryId: country.id },
    })

    if (state) {
      updated++
    } else {
      await prisma.state.create({
        data: {
          name,
          country: { connect: { id: country.id } },
        },
      })
      created++
    }
  }

  console.log(
    `India states seed complete. Country IN=${country.id}. created=${created}, updated=${updated}`,
  )
}

main()
  .catch((e) => {
    console.error('Seed india states failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
