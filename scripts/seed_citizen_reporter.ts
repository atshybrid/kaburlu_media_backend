import prisma from '../src/lib/prisma';
import * as bcrypt from 'bcrypt';

type Args = {
  tenant: string;
  designation: string;
  mobile: string;
  fullName: string;
  level: 'STATE' | 'DISTRICT' | 'MANDAL' | 'ASSEMBLY';
  state?: string;
  district?: string;
  mandal?: string;
  assembly?: string;
  createShortNews?: boolean;
};

function parseArgs(): Args {
  const raw = process.argv.join(' ');
  const get = (k: string) => {
    const m = raw.match(new RegExp(`--${k}\\s+([^\\s^]+)`));
    return m ? m[1] : undefined;
  };
  const level = (get('level') as any) || 'STATE';
  return {
    tenant: get('tenant')!,
    designation: get('designation')!,
    mobile: get('mobile')!,
    fullName: get('fullName')!,
    level,
    state: get('state'),
    district: get('district'),
    mandal: get('mandal'),
    assembly: get('assembly'),
    createShortNews: (get('createShortNews') || 'false').toLowerCase() === 'true',
  };
}

async function main() {
  const args = parseArgs();
  const {
    tenant,
    designation,
    mobile,
    fullName,
    level,
    state,
    district,
    mandal,
    assembly,
    createShortNews,
  } = args;

  if (!tenant || !designation || !mobile || !fullName) {
    console.error('Required: --tenant <id> --designation <id> --mobile <digits> --fullName "Name" [--level STATE|DISTRICT|MANDAL|ASSEMBLY]');
    process.exit(1);
  }

  const tenantRow = await (prisma as any).tenant.findUnique({ where: { id: tenant } });
  if (!tenantRow) {
    console.error('Invalid tenant id:', tenant);
    process.exit(1);
  }

  const designationRow = await (prisma as any).reporterDesignation.findUnique({ where: { id: designation } });
  if (!designationRow) {
    console.error('Invalid designation id:', designation);
    process.exit(1);
  }

  const languageTe = await prisma.language.findFirst({ where: { code: 'te' } });
  if (!languageTe) {
    console.error('Language code te not found');
    process.exit(1);
  }

  // Resolve role id: prefer env override, else by name
  const defaultRoleId = process.env.DEFAULT_CITIZEN_REPORTER_ROLE_ID;
  let role = defaultRoleId
    ? await prisma.role.findUnique({ where: { id: String(defaultRoleId) } })
    : await prisma.role.findFirst({ where: { name: 'CITIZEN_REPORTER' } });
  if (!role) {
    console.error('CITIZEN_REPORTER role not found. Seed roles first.');
    process.exit(1);
  }

  const normalizedMobile = String(mobile).trim();
  let user = await prisma.user.findFirst({ where: { mobileNumber: normalizedMobile } });
  if (!user) {
    const mpinHash = await bcrypt.hash(normalizedMobile.slice(-4), 10);
    user = await prisma.user.create({
      data: {
        mobileNumber: normalizedMobile,
        mpin: mpinHash,
        roleId: role.id,
        languageId: languageTe.id,
        status: 'ACTIVE',
      },
    });
    console.log('Created user:', user.id);
  } else {
    if (user.roleId !== role.id) {
      user = await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
    }
    console.log('Using existing user:', user.id);
  }

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: { fullName },
    create: { userId: user.id, fullName },
  });

  const data: any = {
    tenantId: tenant,
    designationId: designation,
    level,
    stateId: state || null,
    districtId: district || null,
    mandalId: mandal || null,
    assemblyConstituencyId: assembly || null,
    subscriptionActive: false,
    monthlySubscriptionAmount: null,
    idCardCharge: null,
    userId: user.id,
  };

  if (level === 'STATE' && !data.stateId) {
    console.error('Provide --state <id> for level STATE');
    process.exit(1);
  }
  if (level === 'DISTRICT' && !data.districtId) {
    console.error('Provide --district <id> for level DISTRICT');
    process.exit(1);
  }
  if (level === 'MANDAL' && !data.mandalId) {
    console.error('Provide --mandal <id> for level MANDAL');
    process.exit(1);
  }
  if (level === 'ASSEMBLY' && !data.assemblyConstituencyId) {
    console.error('Provide --assembly <id> for level ASSEMBLY');
    process.exit(1);
  }

  let reporter = await (prisma as any).reporter.findFirst({ where: { userId: user.id, tenantId: tenant } });
  if (!reporter) {
    reporter = await (prisma as any).reporter.create({ data });
    console.log('Created reporter:', reporter.id);
  } else {
    reporter = await (prisma as any).reporter.update({ where: { id: reporter.id }, data });
    console.log('Updated reporter:', reporter.id);
  }

  if (createShortNews) {
    const domain = await prisma.domain.findFirst({ where: { tenantId: tenant } });
    const lang = languageTe;
    const sn = await (prisma as any).shortNews.create({
      data: {
        tenantId: tenant,
        domainId: domain?.id || null,
        languageId: lang.id,
        title: 'Seed: Test Short News',
        content: 'This is a seeded short news item to validate CITIZEN_REPORTER publishing.',
        authorId: user.id,
        status: 'DRAFT',
        images: [],
      },
    });
    console.log('Created shortNews:', sn.id);
  }

  console.log('Done:', { userId: user.id, reporterId: reporter.id, tenantId: tenant });
}

main().catch((e) => { console.error(e); process.exit(1); });
