import prisma from '../src/lib/prisma';
import * as bcrypt from 'bcrypt';

async function createTenantAdmin() {
  try {
    console.log('Creating Tenant Admin for Prem Kumar...');
    
    // Get TENANT_ADMIN role
    let role = await prisma.role.findFirst({
      where: { name: { in: ['TENANT_ADMIN', 'Admin'] } }
    });
    
    if (!role) {
      console.log('Creating TENANT_ADMIN role...');
      role = await prisma.role.create({
        data: {
          name: 'TENANT_ADMIN',
          permissions: {
            tenant: ['read', 'update'],
            reporters: ['create', 'read', 'update', 'delete'],
            articles: ['create', 'read', 'update', 'delete', 'approve'],
            settings: ['read', 'update'],
          }
        }
      });
    }
    
    // Get default language
    const language = await prisma.language.findFirst({
      where: { code: { in: ['en', 'te'] } }
    }) || await prisma.language.findFirst();
    
    if (!language) {
      throw new Error('No language found in system');
    }
    
    // Get state
    const state = await prisma.state.findFirst({ orderBy: { name: 'asc' } });
    
    // Get TENANT_ADMIN designation
    let designation = await prisma.reporterDesignation.findFirst({
      where: { tenantId: null, code: 'TENANT_ADMIN' }
    });
    
    if (!designation) {
      designation = await prisma.reporterDesignation.findFirst();
    }
    
    // Hash MPIN (last 4 digits: 8154)
    const hashedMpin = await bcrypt.hash('8154', 10);
    
    // Check if user already exists
    let user = await prisma.user.findFirst({
      where: { mobileNumber: '9948148154' }
    });
    
    if (user) {
      console.log('User already exists, updating role...');
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          roleId: role.id,
          email: 'kittudonikena88@gmail.com'
        }
      });
    } else {
      console.log('Creating new user...');
      user = await prisma.user.create({
        data: {
          mobileNumber: '9948148154',
          mpin: hashedMpin,
          email: 'kittudonikena88@gmail.com',
          roleId: role.id,
          languageId: language.id,
          status: 'ACTIVE',
        }
      });
    }
    
    // Create or update profile
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { fullName: 'Prem Kumar Donikana' },
      create: { userId: user.id, fullName: 'Prem Kumar Donikana' }
    });
    
    // Check if reporter already exists
    let reporter = await prisma.reporter.findFirst({
      where: { userId: user.id, tenantId: 'cmkjb7vn201krqv1w7982m6xa' }
    });
    
    if (reporter) {
      console.log('Reporter link already exists');
    } else {
      console.log('Creating Reporter link...');
      reporter = await prisma.reporter.create({
        data: {
          tenantId: 'cmkjb7vn201krqv1w7982m6xa',
          userId: user.id,
          designationId: designation?.id,
          level: 'STATE',
          stateId: state?.id,
          active: true,
          subscriptionActive: false,
          manualLoginEnabled: false,
        }
      });
    }
    
    console.log('\n✅ Tenant Admin Created Successfully!\n');
    console.log('User ID:', user.id);
    console.log('Reporter ID:', reporter.id);
    console.log('Role:', role.name);
    console.log('Tenant ID: cmkjb7vn201krqv1w7982m6xa');
    console.log('\n📱 Login Credentials:');
    console.log('Mobile: 9948148154');
    console.log('MPIN: 8154');
    console.log('Email:', user.email);
    
  } catch (error: any) {
    console.error('❌ Error creating tenant admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTenantAdmin();
