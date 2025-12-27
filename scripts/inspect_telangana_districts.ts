import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const telangana = await prisma.state.findFirst({ where: { name: 'Telangana' } })
  if (!telangana) {
    console.error('Telangana state not found')
    process.exit(1)
  }
  const districts = await prisma.district.findMany({ where: { stateId: telangana.id }, orderBy: { name: 'asc' } })
  console.log(`Telangana districts count: ${districts.length}`)
  for (const d of districts) console.log('-', d.name)
}

main()
  .catch((e) => {
    console.error('Inspect districts failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
