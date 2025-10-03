import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Kin = {
  code: string;
  category: string;
  gender?: string;
  side?: string;
  generationUp?: number;
  generationDown?: number;
  en: string;
  te: string;
  isCommon?: boolean;
};

const KIN: Kin[] = [
  // Self
  { code: 'SELF', category: 'SELF', gender: 'NEUTRAL', en: 'Self', te: 'నేను' },
  // Parents
  { code: 'FATHER', category: 'PARENT', gender: 'MALE', side: 'BOTH', generationUp: 1, en: 'Father', te: 'నాన్న' },
  { code: 'MOTHER', category: 'PARENT', gender: 'FEMALE', side: 'BOTH', generationUp: 1, en: 'Mother', te: 'అమ్మ' },
  // Grandparents
  { code: 'PATERNAL_GRANDFATHER', category: 'GRANDPARENT', gender: 'MALE', side: 'PATERNAL', generationUp: 2, en: 'Grandfather (Paternal)', te: 'తాతయ్య' },
  { code: 'PATERNAL_GRANDMOTHER', category: 'GRANDPARENT', gender: 'FEMALE', side: 'PATERNAL', generationUp: 2, en: 'Grandmother (Paternal)', te: 'అమ్మమ్మ' },
  { code: 'MATERNAL_GRANDFATHER', category: 'GRANDPARENT', gender: 'MALE', side: 'MATERNAL', generationUp: 2, en: 'Grandfather (Maternal)', te: 'నాన్నయ్య' },
  { code: 'MATERNAL_GRANDMOTHER', category: 'GRANDPARENT', gender: 'FEMALE', side: 'MATERNAL', generationUp: 2, en: 'Grandmother (Maternal)', te: 'నాన్నమ్మ' },
  // Children
  { code: 'SON', category: 'CHILD', gender: 'MALE', side: 'BOTH', generationDown: 1, en: 'Son', te: 'కొడుకు' },
  { code: 'DAUGHTER', category: 'CHILD', gender: 'FEMALE', side: 'BOTH', generationDown: 1, en: 'Daughter', te: 'కూతురు' },
  { code: 'GRANDSON', category: 'GRANDCHILD', gender: 'MALE', side: 'BOTH', generationDown: 2, en: 'Grandson', te: 'మనవడు' },
  { code: 'GRANDDAUGHTER', category: 'GRANDCHILD', gender: 'FEMALE', side: 'BOTH', generationDown: 2, en: 'Granddaughter', te: 'మనవరాలు' },
  // Siblings
  { code: 'BROTHER', category: 'SIBLING', gender: 'MALE', side: 'BOTH', en: 'Brother', te: 'అన్న/తమ్ముడు' },
  { code: 'SISTER', category: 'SIBLING', gender: 'FEMALE', side: 'BOTH', en: 'Sister', te: 'అక్క/చెల్లి' },
  // Spouse
  { code: 'HUSBAND', category: 'SPOUSE', gender: 'MALE', side: 'BOTH', en: 'Husband', te: 'భర్త' },
  { code: 'WIFE', category: 'SPOUSE', gender: 'FEMALE', side: 'BOTH', en: 'Wife', te: 'భార్య' },
  // Aunts/Uncles (Father side)
  { code: 'PATERNAL_UNCLE', category: 'UNCLE', gender: 'MALE', side: 'PATERNAL', generationUp: 1, en: 'Uncle (Father’s brother)', te: 'బాబాయి' },
  { code: 'PATERNAL_AUNT', category: 'AUNT', gender: 'FEMALE', side: 'PATERNAL', generationUp: 1, en: 'Aunt (Father’s sister)', te: 'పిన్ని' },
  // Aunts/Uncles (Mother side)
  { code: 'MATERNAL_UNCLE', category: 'UNCLE', gender: 'MALE', side: 'MATERNAL', generationUp: 1, en: 'Uncle (Mother’s brother)', te: 'మామయ్య' },
  { code: 'MATERNAL_AUNT', category: 'AUNT', gender: 'FEMALE', side: 'MATERNAL', generationUp: 1, en: 'Aunt (Mother’s sister)', te: 'అత్తయ్య' },
  // Nieces/Nephews
  { code: 'NEPHEW', category: 'NEPHEW', gender: 'MALE', side: 'BOTH', generationDown: 1, en: 'Nephew', te: 'మనవడు/సోదరుని కుమారుడు/సోదరి కుమారుడు' },
  { code: 'NIECE', category: 'NIECE', gender: 'FEMALE', side: 'BOTH', generationDown: 1, en: 'Niece', te: 'మనవరాలు/సోదరుని కుమార్తె/సోదరి కుమార్తె' },
  // Cousins
  { code: 'COUSIN', category: 'COUSIN', gender: 'NEUTRAL', side: 'BOTH', en: 'Cousin', te: 'బాబాయి/పిన్ని/మామయ్య/అత్తయ్య పిల్లలు' },
];

async function main() {
  console.log('Seeding KinRelation dictionary...');
  for (const k of KIN) {
    await (prisma as any)['kinRelation'].upsert({
      where: { code: k.code },
      update: { ...k },
      create: { code: k.code, category: k.category, gender: k.gender || null as any, side: k.side || null as any, generationUp: k.generationUp || 0, generationDown: k.generationDown || 0, en: k.en, te: k.te, isCommon: k.isCommon ?? true }
    } as any);
  }
  console.log('Done.');
}

main().catch((e)=>{ console.error(e); process.exit(1); }).finally(async()=>{ await prisma.$disconnect(); });
