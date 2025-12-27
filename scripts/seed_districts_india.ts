import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type DistrictMap = Record<string, string[]>

// District lists for requested states/UTs (modern as of 2025; may vary)
const DISTRICTS: Record<string, DistrictMap> = {
  India: {
    'Telangana': [
      'Adilabad','Komaram Bheem Asifabad','Mancherial','Nirmal','Nizamabad','Jagtial','Peddapalli','Karimnagar','Rajanna Sircilla','Medchal–Malkajgiri','Sangareddy','Vikarabad','Medak','Kamareddy','Hyderabad','Ranga Reddy','Mahabubnagar','Narayanpet','Jogulamba Gadwal','Wanaparthy','Nagarkurnool','Nalgonda','Suryapet','Yadadri Bhuvanagiri','Jangaon','Warangal Urban','Hanamkonda','Warangal Rural','Jayashankar Bhupalpally','Mahabubabad','Bhadradri Kothagudem','Khammam','Mulugu'
    ],
    'Andhra Pradesh': [
      'Alluri Sitarama Raju','Anakapalli','Anantapur','Annamayya','Bapatla','Chittoor','East Godavari','Eluru','Guntur','Kadapa','Kakinada','Konaseema','Krishna','Kurnool','Nandyal','NTR','Palnadu','Parvathipuram Manyam','Prakasam','Srikakulam','Sri Sathya Sai','Tadepalligudem','Tirupati','Visakhapatnam','Vizianagaram','West Godavari'
    ],
    'Karnataka': [
      'Bagalkote','Ballari','Belagavi','Bengaluru Rural','Bengaluru Urban','Bidar','Chamarajanagar','Chikkaballapura','Chikkamagaluru','Chitradurga','Dakshina Kannada','Davanagere','Dharwad','Gadag','Hassan','Haveri','Kalaburagi','Kodagu','Kolar','Koppal','Mandya','Mysuru','Raichur','Ramanagara','Shivamogga','Tumakuru','Udupi','Uttara Kannada','Vijayapura','Yadgir'
    ],
    'Tamil Nadu': [
      'Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri','Dindigul','Erode','Kallakurichi','Kanchipuram','Kanyakumari','Karur','Krishnagiri','Madurai','Mayiladuthurai','Nagapattinam','Namakkal','Nilgiris','Perambalur','Pudukkottai','Ramanathapuram','Ranipet','Salem','Sivaganga','Tenkasi','Thanjavur','Theni','Thiruvallur','Thiruvarur','Tiruchirappalli','Tirunelveli','Tirupathur','Tiruppur','Tiruvannamalai','Vellore','Viluppuram','Virudhunagar'
    ],
    'Kerala': [
      'Thiruvananthapuram','Kollam','Pathanamthitta','Alappuzha','Kottayam','Idukki','Ernakulam','Thrissur','Palakkad','Malappuram','Kozhikode','Wayanad','Kannur','Kasaragod'
    ],
    'Puducherry': [
      // Puducherry is a UT with districts matching regions
      'Puducherry','Karaikal','Mahe','Yanam'
    ],
    'Maharashtra': [
      'Ahmednagar','Akola','Amravati','Aurangabad','Beed','Bhandara','Buldhana','Chandrapur','Dhule','Gadchiroli','Gondia','Hingoli','Jalgaon','Jalna','Kolhapur','Latur','Mumbai City','Mumbai Suburban','Nagpur','Nanded','Nandurbar','Nashik','Osmanabad','Palghar','Parbhani','Pune','Raigad','Ratnagiri','Sangli','Satara','Sindhudurg','Solapur','Thane','Wardha','Washim','Yavatmal'
    ],
  },
}

async function upsertCountryAndState(countryCode: string, countryName: string, stateName: string) {
  const country = await prisma.country.upsert({
    where: { code: countryCode },
    update: {},
    create: { code: countryCode, name: countryName },
  })

  const state = await prisma.state.findFirst({ where: { name: stateName, countryId: country.id } })
  if (!state) {
    return prisma.state.create({ data: { name: stateName, country: { connect: { id: country.id } } } })
  }
  return state
}

async function main() {
  let totalCreated = 0
  let totalExisting = 0

  const india = DISTRICTS.India
  for (const [stateName, districts] of Object.entries(india)) {
    const state = await upsertCountryAndState('IN', 'India', stateName)

    for (const d of districts) {
      const exists = await prisma.district.findFirst({ where: { name: d, stateId: state.id } })
      if (exists) {
        totalExisting++
      } else {
        await prisma.district.create({ data: { name: d, state: { connect: { id: state.id } } } })
        totalCreated++
      }
    }
  }

  console.log(`Districts seed complete. created=${totalCreated}, existing=${totalExisting}`)
}

main()
  .catch((e) => {
    console.error('Seed districts failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
