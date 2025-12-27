import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

type MandalList = string[]

function readMandalFiles(baseDir: string): Record<string, MandalList> {
  const files = fs.readdirSync(baseDir)
  const out: Record<string, MandalList> = {}
  for (const f of files) {
    if (!f.toLowerCase().endsWith('_mandals.json')) continue
    const districtName = f.replace(/_mandals\.json$/i, '').replace(/_/g, ' ')
    const fullPath = path.join(baseDir, f)
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8')
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        out[districtName] = arr.map((s) => String(s))
      }
    } catch (e) {
      console.warn(`Skipping ${f}: ${String(e)}`)
    }
  }
  return out
}

async function ensureTelangana(): Promise<{ id: string }> {
  const country = await prisma.country.upsert({
    where: { code: 'IN' },
    update: {},
    create: { code: 'IN', name: 'India' },
  })
  const state = await prisma.state.findFirst({ where: { name: 'Telangana', countryId: country.id } })
  if (!state) {
    return prisma.state.create({ data: { name: 'Telangana', country: { connect: { id: country.id } } } })
  }
  return state
}

async function upsertDistrict(stateId: string, districtName: string) {
  const d = await prisma.district.findFirst({ where: { name: districtName, stateId } })
  if (d) return d
  return prisma.district.create({ data: { name: districtName, state: { connect: { id: stateId } } } })
}

async function main() {
  const baseDir = path.join(process.cwd(), 'location')
  const datasets = readMandalFiles(baseDir)
  const telangana = await ensureTelangana()

  let createdMandals = 0
  let existingMandals = 0
  let createdDistricts = 0

  for (const [districtName, mandals] of Object.entries(datasets)) {
    const district = await upsertDistrict(telangana.id, districtName)
    if (!district) {
      createdDistricts++
    }
    for (const m of mandals) {
      const exists = await prisma.mandal.findFirst({ where: { name: m, districtId: district.id } })
      if (exists) {
        existingMandals++
      } else {
        await prisma.mandal.create({ data: { name: m, district: { connect: { id: district.id } } } })
        createdMandals++
      }
    }
  }

  console.log(
    `Telangana mandals seed complete. districtsCreated=${createdDistricts}, mandalsCreated=${createdMandals}, mandalsExisting=${existingMandals}`,
  )
}

main()
  .catch((e) => {
    console.error('Seed telangana mandals failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
