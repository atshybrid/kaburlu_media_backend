const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const tenantId = 'cmkk4at2e01nbqn1vmndmrevt';
  const fullName = 'madhav rao patel';
  const mobile = '9666665026';
  const email = 'madhavraopatels@gmail.com';
  const mpin = mobile.slice(-4); // Last 4 digits: 5026
  const languageId = 'cmk74fubb0014ugy41ec79nq4'; // Telugu
  
  // Find TENANT_ADMIN role
  const role = await prisma.role.findFirst({
    where: { name: { in: ['TENANT_ADMIN', 'TenantAdmin'] } }
  });
  
  if (!role) {
    console.log('❌ TENANT_ADMIN role not found');
    return;
  }
  console.log('Role found:', role.name, role.id);
  
  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { mobileNumber: mobile }
      ]
    }
  });
  
  if (existingUser) {
    console.log('⚠️ User already exists:', existingUser.id);
    
    // Update user role to TENANT_ADMIN
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        roleId: role.id,
        status: 'ACTIVE',
      }
    });
    
    // Update profile name
    await prisma.userProfile.upsert({
      where: { userId: existingUser.id },
      update: { fullName },
      create: { userId: existingUser.id, fullName }
    });
    
    // Check/create reporter link to tenant
    let reporter = await prisma.reporter.findFirst({
      where: { userId: existingUser.id, tenantId }
    });
    
    if (!reporter) {
      reporter = await prisma.reporter.create({
        data: {
          tenantId,
          userId: existingUser.id,
          level: 'STATE',
          active: true,
          manualLoginEnabled: false,
          manualLoginDays: null,
        }
      });
    }
    
    console.log('✅ User updated to TENANT_ADMIN:', updated.id);
    console.log('  Reporter ID:', reporter.id);
    return;
  }
  
  // Hash MPIN
  const hashedMpin = await bcrypt.hash(mpin, 10);
  
  // Create new user
  const user = await prisma.user.create({
    data: {
      mobileNumber: mobile,
      email,
      mpin: hashedMpin,
      roleId: role.id,
      languageId,
      status: 'ACTIVE',
    }
  });
  
  // Create UserProfile
  await prisma.userProfile.create({
    data: {
      userId: user.id,
      fullName,
    }
  });
  
  // Create Reporter (links user to tenant)
  const reporter = await prisma.reporter.create({
    data: {
      tenantId,
      userId: user.id,
      level: 'STATE',
      active: true,
      manualLoginEnabled: false,
      manualLoginDays: null,
    }
  });
  
  console.log('\n✅ Tenant Admin Created:');
  console.log('  User ID:', user.id);
  console.log('  Name:', fullName);
  console.log('  Email:', email);
  console.log('  Mobile:', mobile);
  console.log('  Role:', role.name);
  console.log('  Reporter ID:', reporter.id);
  console.log('  Tenant ID:', tenantId);
  console.log('\n📱 Login Credentials:');
  console.log('  Mobile:', mobile);
  console.log('  MPIN:', mpin);
}

main().catch(console.error).finally(() => prisma.$disconnect());
