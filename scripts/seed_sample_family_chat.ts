/*
  Seed Sample Family & Chat Data
  --------------------------------
  PURPOSE:
    Creates a small realistic family graph with:
      - 6 users (root user + immediate relations)
      - Bidirectional FamilyRelation edges
      - Optional Family grouping (surname based)
      - ChatInterest auto-follows for immediate relations
      - Firestore chat + members for family and one direct chat
      - A few sample plaintext messages (non-encrypted) for clarity
  SAFEGUARDS:
      - Requires env SAMPLE_SEED_OK=1 to run (prevents accidental prod runs)
      - Aborts if any of the sample mobile numbers already exist to avoid mixing environments

  USAGE:
      SAMPLE_SEED_OK=1 ts-node scripts/seed_sample_family_chat.ts

  AFTER:
      Use /chat/token for one user (e.g., root) then connect client to Firestore to inspect chats & messages.
*/

import { PrismaClient, FamilyRelationType } from '@prisma/client';
import { getAdmin } from '../src/lib/firebase';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface CreatedUser { id: string; mobileNumber: string; fullName: string; }

async function main() {
  if (process.env.SAMPLE_SEED_OK !== '1') {
    console.error('Refusing to run: set SAMPLE_SEED_OK=1 to proceed.');
    process.exit(1);
  }

  const mobiles = ['9000000001','9000000002','9000000003','9000000004','9000000005','9000000006'];
  const existing = await prisma.user.findMany({ where: { mobileNumber: { in: mobiles } }, select: { mobileNumber: true } });
  if (existing.length) {
    console.error('Abort: sample mobiles already exist:', existing.map(e => e.mobileNumber));
    process.exit(1);
  }

  // Reuse an existing role & language (pick first)
  const role = await prisma.role.findFirst();
  const language = await prisma.language.findFirst();
  if (!role || !language) throw new Error('Roles/Languages must be seeded first. Run npm run seed');

  const saltRounds = 8;
  const mkUser = async (mobile: string, fullName: string): Promise<CreatedUser> => {
    const hashed = await bcrypt.hash('1234', saltRounds);
    const u = await prisma.user.create({ data: { mobileNumber: mobile, mpin: hashed, roleId: role.id, languageId: language.id, status: 'ACTIVE' } });
    await prisma.userProfile.create({ data: { userId: u.id, fullName, surname: 'Reddy' } }).catch(()=>{});
    return { id: u.id, mobileNumber: mobile, fullName };
  };

  console.log('Creating users...');
  const root = await mkUser(mobiles[0], 'Arjun Reddy'); // root user
  const father = await mkUser(mobiles[1], 'Raghav Reddy');
  const mother = await mkUser(mobiles[2], 'Latha Reddy');
  const spouse = await mkUser(mobiles[3], 'Priya Reddy');
  const sister = await mkUser(mobiles[4], 'Sneha Reddy');
  const brother = await mkUser(mobiles[5], 'Vikram Reddy');

  // Family grouping (optional)
  const family = await prisma.family.create({ data: { familyName: 'Reddy Family' } });
  for (const u of [root, father, mother, spouse, sister, brother]) {
    await prisma.familyMember.create({ data: { familyId: family.id, userId: u.id, role: 'MEMBER' } }).catch(()=>{});
  }

  console.log('Creating family relations (bidirectional edges)...');
  const makeEdge = async (a: CreatedUser, b: CreatedUser, type: FamilyRelationType) => {
    await prisma.familyRelation.upsert({
      where: { userId_relatedUserId_relationType: { userId: a.id, relatedUserId: b.id, relationType: type } },
      update: {},
      create: { userId: a.id, relatedUserId: b.id, relationType: type }
    });
  };
  // Parent/child
  await makeEdge(father, root, 'PARENT');
  await makeEdge(mother, root, 'PARENT');
  await makeEdge(root, father, 'CHILD');
  await makeEdge(root, mother, 'CHILD');
  // Siblings
  await makeEdge(root, sister, 'SIBLING');
  await makeEdge(sister, root, 'SIBLING');
  await makeEdge(root, brother, 'SIBLING');
  await makeEdge(brother, root, 'SIBLING');
  // Spouse
  await makeEdge(root, spouse, 'SPOUSE');
  await makeEdge(spouse, root, 'SPOUSE');

  console.log('Seeding chat interests (auto-follow immediate relations)...');
  const immediate = [father, mother, spouse, sister, brother];
  for (const rel of immediate) {
    await prisma.chatInterest.upsert({
      where: { userId_targetUserId: { userId: root.id, targetUserId: rel.id } },
      update: { followed: true, muted: false },
      create: { userId: root.id, targetUserId: rel.id, followed: true, muted: false }
    });
  }

  // Ensure family chat in Firestore using existing helper semantics
  console.log('Creating Firestore family chat & members...');
  const adminApp = getAdmin();
  const db = adminApp.firestore();
  const familyChatId = 'f_' + root.id;
  await db.collection('chats').doc(familyChatId).set({ chatId: familyChatId, kind: 'FAMILY', createdAt: Date.now(), memberCount: 6, sample: true }, { merge: true });
  const batch = db.batch();
  for (const u of [root, father, mother, spouse, sister, brother]) {
    const ref = db.collection('chatMembers').doc(familyChatId + '_' + u.id);
    batch.set(ref, { chatId: familyChatId, userId: u.id, joinedAt: Date.now() }, { merge: true });
  }
  await batch.commit();

  console.log('Creating one direct chat (root <-> spouse)...');
  const directChatId = 'd_' + [root.id, spouse.id].sort().join('_');
  await db.collection('chats').doc(directChatId).set({ chatId: directChatId, kind: 'DIRECT', createdAt: Date.now(), memberCount: 2, sample: true }, { merge: true });
  await db.collection('chatMembers').doc(directChatId + '_' + root.id).set({ chatId: directChatId, userId: root.id, joinedAt: Date.now() }, { merge: true });
  await db.collection('chatMembers').doc(directChatId + '_' + spouse.id).set({ chatId: directChatId, userId: spouse.id, joinedAt: Date.now() }, { merge: true });

  console.log('Adding sample messages...');
  const msg = (chatId: string, senderId: string, text: string) => ({
    id: db.collection('messages').doc().id,
    chatId,
    kind: 'TEXT',
    senderUserId: senderId,
    createdAt: Date.now(),
    text,
    mediaUrl: null,
    ciphertext: null,
    iv: null,
    meta: { sample: true }
  });
  const messages = [
    msg(familyChatId, root.id, 'Hello everyone, welcome to Kaburlu family chat!'),
    msg(familyChatId, father.id, 'Great to be here.'),
    msg(familyChatId, spouse.id, 'Hi all!'),
    msg(directChatId, root.id, 'Hey Priya, this is our private chat.'),
    msg(directChatId, spouse.id, 'Yes! Works fine.')
  ];
  const batch2 = db.batch();
  for (const m of messages) {
    batch2.set(db.collection('messages').doc(m.id), m);
  }
  await batch2.commit();

  console.log('Sample family & chat seed complete.');
  console.log({
    rootMobile: root.mobileNumber,
    rootUserId: root.id,
    familyChatId,
    directChatId,
    members: { father: father.id, mother: mother.id, spouse: spouse.id, sister: sister.id, brother: brother.id }
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => { await prisma.$disconnect(); });
