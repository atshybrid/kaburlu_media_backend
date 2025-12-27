import prisma from '../src/lib/prisma';
import * as bcrypt from 'bcrypt';

async function main() {
  const mobile = process.argv[2];
  const domain = process.argv[3] || 'app.kaburlumedia.com';
  if (!mobile) {
    console.error('Usage: ts-node scripts/add_reporter_by_mobile.ts <mobileNumber> [domain]');
    process.exit(1);
  }

  const dom = await prisma.domain.findFirst({ where: { domain } });
  if (!dom) {
    console.error(`Domain not found: ${domain}`);
    process.exit(1);
  }

  const tenantId = dom.tenantId;
  const telugu = await prisma.language.findFirst({ where: { code: 'te' } });
  if (!telugu) {
    console.error('Language te not found');
    process.exit(1);
  }

  const reporterRole = await prisma.role.findUnique({ where: { name: 'REPORTER' } });
  if (!reporterRole) {
    console.error('Role REPORTER not found');
    process.exit(1);
  }

  let user = await prisma.user.findUnique({ where: { mobileNumber: mobile } });
  if (!user) {
    const mpinHash = await bcrypt.hash(mobile.slice(-4), 10);
    user = await prisma.user.create({
      data: {
        mobileNumber: mobile,
        mpin: mpinHash,
        roleId: reporterRole.id,
        languageId: telugu.id,
        status: 'ACTIVE'
      }
    });
    console.log('Created user', user.id);
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { roleId: reporterRole.id, languageId: telugu.id, status: 'ACTIVE' }
    });
    console.log('Updated user', user.id);
  }

  let reporter = await (prisma as any).reporter.findFirst({ where: { userId: user.id, tenantId } });
  if (!reporter) {
    reporter = await (prisma as any).reporter.create({
      data: {
        userId: user.id,
        tenantId,
        designationId: null,
        subscriptionActive: false
      }
    });
    console.log('Created reporter', reporter.id);
  } else {
    console.log('Reporter already exists', reporter.id);
  }

  console.log('Done. userId:', user.id, 'tenantId:', tenantId, 'domain:', domain);
}

main().catch(e => { console.error(e); process.exit(1); });
