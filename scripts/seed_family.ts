import { PrismaClient, FamilyRelationType } from '@prisma/client';

const prisma = new PrismaClient();

async function getDefaults() {
  // Try to find a reasonable default role and language from existing data
  const role = await prisma.role.findFirst({ where: { name: { in: ['CITIZEN_REPORTER', 'USER', 'GUEST'] } } })
    || await prisma.role.findFirst();
  const language = await prisma.language.findFirst({ where: { code: { in: ['te', 'en'] } } })
    || await prisma.language.findFirst();
  if (!role || !language) throw new Error('Missing Role or Language. Please seed base data first.');
  return { roleId: role.id, languageId: language.id };
}

async function upsertUser(mobileNumber: string, name: string) {
  const { roleId, languageId } = await getDefaults();
  const existing = await prisma.user.findUnique({ where: { mobileNumber } as any });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      mobileNumber,
      roleId,
      languageId,
      status: 'ACTIVE',
      profile: { create: { fullName: name, gender: 'OTHER' } as any } as any
    } as any
  });
}

async function linkBoth(userId: string, relatedUserId: string, type: FamilyRelationType) {
  const inverseMap: Record<FamilyRelationType, FamilyRelationType> = {
    PARENT: 'CHILD',
    CHILD: 'PARENT',
    SPOUSE: 'SPOUSE',
    SIBLING: 'SIBLING'
  } as const;
  const inverse = inverseMap[type];

  await prisma.$transaction(async (tx) => {
    await (tx as any)['familyRelation'].upsert({
      where: { userId_relatedUserId_relationType: { userId, relatedUserId, relationType: type } },
      update: {},
      create: { userId, relatedUserId, relationType: type }
    });
    await (tx as any)['familyRelation'].upsert({
      where: { userId_relatedUserId_relationType: { userId: relatedUserId, relatedUserId: userId, relationType: inverse } },
      update: {},
      create: { userId: relatedUserId, relatedUserId: userId, relationType: inverse }
    });
  });
}

async function main() {
  console.log('Seeding family sample data...');
  // Create users with unique phone numbers to avoid constraint issues
  const u_me = await upsertUser('9990000001', 'You Me');
  const u_father = await upsertUser('9990000002', 'Father Me');
  const u_mother = await upsertUser('9990000003', 'Mother Me');
  const u_sister = await upsertUser('9990000004', 'Sister Me');
  const u_spouse = await upsertUser('9990000005', 'Spouse Me');
  const u_child1 = await upsertUser('9990000006', 'Child One');
  const u_gfather = await upsertUser('9990000007', 'Grand Father');

  // Link relations from the perspective of u_me
  // Father: u_me -> u_father (CHILD), inverse auto: u_father -> u_me (PARENT)
  await linkBoth(u_me.id, u_father.id, 'CHILD');
  // Mother
  await linkBoth(u_me.id, u_mother.id, 'CHILD');
  // Sister (sibling)
  await linkBoth(u_me.id, u_sister.id, 'SIBLING');
  // Spouse
  await linkBoth(u_me.id, u_spouse.id, 'SPOUSE');
  // Child
  await linkBoth(u_me.id, u_child1.id, 'PARENT');
  // Grandfather (father's father): link from father perspective
  await linkBoth(u_father.id, u_gfather.id, 'CHILD');

  console.log('Seeded users:', {
    u_me: u_me.id,
    u_father: u_father.id,
    u_mother: u_mother.id,
    u_sister: u_sister.id,
    u_spouse: u_spouse.id,
    u_child1: u_child1.id,
    u_gfather: u_gfather.id
  });
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
