import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

type MandalList = string[]

function walkForMandalFiles(baseDir: string): Array<{ state: string; district: string; file: string }> {
  const results: Array<{ state: string; district: string; file: string }> = []
  const entries = fs.readdirSync(baseDir)
  for (const entry of entries) {
    const entryPath = path.join(baseDir, entry)
    const stat = fs.statSync(entryPath)
    if (stat.isDirectory()) {
      // Treat directory name as state
      const stateName = entry
      const files = fs.readdirSync(entryPath)
      for (const f of files) {
        if (!f.toLowerCase().endsWith('_mandals.json')) continue
        const districtName = f.replace(/_mandals\.json$/i, '').replace(/_/g, ' ')
        results.push({ state: stateName, district: districtName, file: path.join(entryPath, f) })
      }
    } else if (stat.isFile()) {
      // Top-level files (assume Telangana-style; infer state from content or default)
      if (entry.toLowerCase().endsWith('_mandals.json')) {
        const districtName = entry.replace(/_mandals\.json$/i, '').replace(/_/g, ' ')
        results.push({ state: 'Telangana', district: districtName, file: entryPath })
      }
    }
  }
  return results
}

async function ensureCountryStateDistrict(countryCode: string, countryName: string, stateName: string, districtName: string) {
  const country = await prisma.country.upsert({ where: { code: countryCode }, update: {}, create: { code: countryCode, name: countryName } })
  let state = await prisma.state.findFirst({ where: { name: stateName, countryId: country.id } })
  if (!state) {
    state = await prisma.state.create({ data: { name: stateName, country: { connect: { id: country.id } } } })
  }
  let district = await prisma.district.findFirst({ where: { name: districtName, stateId: state.id } })
  if (!district) {
    district = await prisma.district.create({ data: { name: districtName, state: { connect: { id: state.id } } } })
  }
  return { country, state, district }
}

async function main() {
  const baseDir = path.join(process.cwd(), 'location')
  const files = walkForMandalFiles(baseDir)
  if (files.length === 0) {
    console.log('No mandal datasets found under location/. Place files as <State>/<District>_mandals.json')
    return
  }

  let mandalsCreated = 0
  let mandalsExisting = 0
  let districtsCreated = 0

  for (const item of files) {
    let arr: MandalList = []
    try {
      const raw = fs.readFileSync(item.file, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) arr = data.map((s) => String(s))
    } catch (e) {
      console.warn(`Skipping ${item.file}: ${String(e)}`)
      continue
    }

    const { state, district } = item
    const refs = await ensureCountryStateDistrict('IN', 'India', state, district)
    // Track if district was newly created by checking mandal count = 0 and created now? We can't know easily; skip.

    for (const m of arr) {
      const exists = await prisma.mandal.findFirst({ where: { name: m, districtId: refs.district.id } })
      if (exists) {
        mandalsExisting++
      } else {
        await prisma.mandal.create({ data: { name: m, district: { connect: { id: refs.district.id } } } })
        mandalsCreated++
      }
    }
  }

  console.log(`All-India mandals seed complete. mandalsCreated=${mandalsCreated}, mandalsExisting=${mandalsExisting}`)
}

main()
  .catch((e) => {
    console.error('Seed all India mandals failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
