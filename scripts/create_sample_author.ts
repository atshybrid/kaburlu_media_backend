#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding kaburlutoday domain and tenant...');
  
  const domain = await prisma.domain.findFirst({
    where: { domain: { contains: 'kaburlutoday' } }
  });

  if (!domain) {
    throw new Error('Domain not found');
  }

  console.log(`✅ Found domain: ${domain.domain}`);
  console.log(`   Tenant ID: ${domain.tenantId}`);

  // Find AUTHOR role for this tenant
  const authorRole = await (prisma as any).role.findFirst({
    where: {
      tenantId: domain.tenantId,
      name: { contains: 'AUTHOR', mode: 'insensitive' }
    }
  });

  if (!authorRole) {
    console.log('❌ No AUTHOR role found for this tenant');
    return;
  }

  console.log(`✅ Found AUTHOR role: ${authorRole.name} (${authorRole.id})`);

  // Check for existing users with this role
  const existingUsers = await (prisma as any).user.findMany({
    where: { roleId: authorRole.id },
    include: { profile: true }
  });

  console.log(`\n👥 Found ${existingUsers.length} users with AUTHOR role:`);
  existingUsers.forEach((u: any) => {
    console.log(`   - ${u.profile?.fullName || u.mobileNumber || u.email || u.id}`);
  });

  if (existingUsers.length > 0) {
    console.log('\n✅ Domain has authors. Bootstrap should work!');
    return;
  }

  console.log('\n⚠️  No authors found. Creating a sample author...');

  // Find default language (Telugu or first available)
  const teluguLang = await (prisma as any).language.findFirst({
    where: { code: 'te' }
  });

  const defaultLang = teluguLang || await (prisma as any).language.findFirst();

  if (!defaultLang) {
    throw new Error('No languages found in database');
  }

  // Create a sample author user
  const sampleAuthor = await (prisma as any).user.create({
    data: {
      email: 'author@kaburlutoday.com',
      roleId: authorRole.id,
      languageId: defaultLang.id,
      status: 'ACTIVE',
      profile: {
        create: {
          fullName: 'Kaburlu Editorial Team'
        }
      }
    },
    include: { profile: true }
  });

  console.log(`✅ Created sample author: ${sampleAuthor.profile?.fullName} (${sampleAuthor.email})`);
  console.log('\n✅ Domain is now ready for bootstrap!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
