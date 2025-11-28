/*
  Clear Family Relations & Sample Chats
  -------------------------------------
  PURPOSE:
    Utility for development to wipe FamilyRelation edges and any Firestore chats/messages marked sample=true.
  SAFETY:
    Requires CLEAR_RELATIONS_OK=1 env flag.
    DOES NOT delete users. Only relations + sample chats + associated chatMembers + messages with meta.sample=true flag OR chat.sample=true.

  USAGE:
    CLEAR_RELATIONS_OK=1 ts-node scripts/clear_relations_and_chats.ts
*/
import { PrismaClient } from '@prisma/client';
import { getAdmin } from '../src/lib/firebase';

const prisma = new PrismaClient();

async function main() {
  if (process.env.CLEAR_RELATIONS_OK !== '1') {
    console.error('Refusing to run. Set CLEAR_RELATIONS_OK=1');
    process.exit(1);
  }
  console.log('Deleting FamilyRelation edges...');
  await (prisma as any).familyRelation.deleteMany({});
  console.log('Deleting FamilyMember rows...');
  await (prisma as any).familyMember.deleteMany({});

  // Firestore cleanup
  const adminApp = getAdmin();
  const db = adminApp.firestore();

  console.log('Scanning chats for sample=true ...');
  const chatsSnap = await db.collection('chats').where('sample','==', true).get();
  const batch = db.batch();
  const chatIds: string[] = [];
  chatsSnap.forEach(doc => { chatIds.push(doc.id); batch.delete(doc.ref); });
  await batch.commit();
  console.log(`Deleted ${chatIds.length} sample chats.`);

  if (chatIds.length) {
    console.log('Deleting chatMembers for removed chats...');
    for (const cid of chatIds) {
      const memSnap = await db.collection('chatMembers').where('chatId','==', cid).get();
      const b2 = db.batch();
      memSnap.forEach(d => b2.delete(d.ref));
      await b2.commit();
    }
    console.log('Deleting messages belonging to removed chats...');
    for (const cid of chatIds) {
      const msgSnap = await db.collection('messages').where('chatId','==', cid).get();
      const b3 = db.batch();
      msgSnap.forEach(d => b3.delete(d.ref));
      await b3.commit();
    }
  }
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
