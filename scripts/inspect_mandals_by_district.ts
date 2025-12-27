import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const districtName = process.argv[2] || 'Kamareddy'

  const telangana = await prisma.state.findFirst({ where: { name: 'Telangana' } })
  if (!telangana) {
    console.error('Telangana state not found')
    process.exit(1)
  }

  const district = await prisma.district.findFirst({
    where: { name: districtName, stateId: telangana.id },
  })
  if (!district) {
    console.error(`District not found: ${districtName}`)
    process.exit(1)
  }

  const mandals = await prisma.mandal.findMany({ where: { districtId: district.id }, orderBy: { name: 'asc' } })
  console.log(`District: ${district.name} (${district.id}) - Mandals count: ${mandals.length}`)
  for (const m of mandals) {
    console.log(`- ${m.name}`)
  }
}

main()
  .catch((e) => {
    console.error('Inspect mandals failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
