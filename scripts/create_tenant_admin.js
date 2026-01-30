/**
 * Create Tenant Admin Script
 * 
 * Usage: node scripts/create_tenant_admin.js
 * 
 * Edit the CONFIG section below before running.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ============= CONFIG - EDIT THIS =============
const CONFIG = {
  // Admin details
  mobileNumber: '9876543210',     // Change this
  fullName: 'Tenant Admin Name',  // Change this
  mpin: '1234',                   // Default MPIN (4 digits)
  
  // Tenant to assign
  tenantSlug: 'kaburlu-today',    // Or use tenantId directly
  // tenantId: 'cmk7e7tg401ezlp22wkz5rxky',
  
  // Location (STATE level admin)
  stateCode: 'TS',                // Or 'AP' for Andhra Pradesh
};
// ===============================================

async function main() {
  console.log('=== Create Tenant Admin ===\n');

  // 1. Find TENANT_ADMIN role
  const role = await prisma.role.findFirst({
    where: { name: { in: ['TENANT_ADMIN', 'Admin', 'ADMIN'] } }
  });
  
  if (!role) {
    // Create TENANT_ADMIN role if not exists
    const newRole = await prisma.role.create({
      data: {
        name: 'TENANT_ADMIN',
        permissions: {
          tenant: ['read', 'update'],
          reporters: ['create', 'read', 'update', 'delete'],
          articles: ['create', 'read', 'update', 'delete', 'approve'],
          shortnews: ['create', 'read', 'update', 'delete', 'approve'],
          idCards: ['generate', 'regenerate', 'resend'],
          settings: ['read', 'update'],
        }
      }
    });
    console.log('✅ Created TENANT_ADMIN role:', newRole.id);
  } else {
    console.log('✅ Found role:', role.name, '→', role.id);
  }
  const roleId = role?.id;

  // 2. Find tenant
  let tenant;
  if (CONFIG.tenantId) {
    tenant = await prisma.tenant.findUnique({ where: { id: CONFIG.tenantId } });
  } else {
    tenant = await prisma.tenant.findFirst({ 
      where: { slug: { contains: CONFIG.tenantSlug, mode: 'insensitive' } }
    });
  }
  
  if (!tenant) {
    console.error('❌ Tenant not found');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('✅ Found tenant:', tenant.name, '→', tenant.id);

  // 3. Find state
  const state = await prisma.state.findFirst({
    where: { code: { equals: CONFIG.stateCode, mode: 'insensitive' } }
  });
  console.log('✅ Found state:', state?.name, '→', state?.id);

  // 4. Find or get default language
  const language = await prisma.language.findFirst({ where: { isDefault: true } }) ||
                   await prisma.language.findFirst();
  console.log('✅ Found language:', language?.name, '→', language?.id);

  // 5. Find admin designation (or first designation)
  const designation = await prisma.reporterDesignation.findFirst({
    where: { 
      OR: [
        { name: { contains: 'admin', mode: 'insensitive' } },
        { name: { contains: 'editor', mode: 'insensitive' } },
        { name: { contains: 'chief', mode: 'insensitive' } },
      ]
    }
  }) || await prisma.reporterDesignation.findFirst();
  console.log('✅ Found designation:', designation?.name, '→', designation?.id);

  // 6. Check if user exists
  let user = await prisma.user.findFirst({
    where: { mobileNumber: CONFIG.mobileNumber }
  });

  if (user) {
    console.log('⚠️ User already exists:', user.id);
    // Update role if needed
    if (user.roleId !== roleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId }
      });
      console.log('   Updated user role to TENANT_ADMIN');
    }
  } else {
    // Create new user
    const hashedMpin = await bcrypt.hash(CONFIG.mpin, 10);
    user = await prisma.user.create({
      data: {
        mobileNumber: CONFIG.mobileNumber,
        mpin: hashedMpin,
        roleId,
        languageId: language?.id,
        status: 'ACTIVE',
      }
    });
    console.log('✅ Created user:', user.id);
  }

  // 7. Create or update UserProfile
  let profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        fullName: CONFIG.fullName,
      }
    });
    console.log('✅ Created profile:', profile.id);
  } else {
    console.log('✅ Profile exists:', profile.id);
  }

  // 8. Create Reporter (links user to tenant)
  let reporter = await prisma.reporter.findFirst({
    where: { userId: user.id, tenantId: tenant.id }
  });

  if (reporter) {
    console.log('⚠️ Reporter already exists:', reporter.id);
  } else {
    reporter = await prisma.reporter.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        designationId: designation?.id,
        level: 'STATE',
        stateId: state?.id,
        active: true,
        subscriptionActive: false,
        manualLoginEnabled: true,
        manualLoginDays: 365,
        manualLoginEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      }
    });
    console.log('✅ Created reporter:', reporter.id);
  }

  console.log('\n=== TENANT ADMIN CREATED ===');
  console.log('Mobile:', CONFIG.mobileNumber);
  console.log('MPIN:', CONFIG.mpin);
  console.log('Name:', CONFIG.fullName);
  console.log('Tenant:', tenant.name);
  console.log('User ID:', user.id);
  console.log('Reporter ID:', reporter.id);
  console.log('\nLogin: Use mobile + MPIN to login');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  prisma.$disconnect();
  process.exit(1);
});
