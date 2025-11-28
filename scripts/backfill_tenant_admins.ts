import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

// Inline mapping of tenant slug -> admin mobile number(s).
// Prefer external JSON: create file `tenant_admin_mapping.json` in repo root or scripts folder:
// {
//   "greennews": "9876543210",
//   "prashna": ["9000012345", "9000099999"]
// }
// If JSON exists it overrides this inline mapping.
const inlineMapping: Record<string, string | string[]> = {
  // 'greennews': '9876543210',
};

// Optional designation preference order for tenant admin reporter
const designationPreference = ['STATE_EDITOR', 'STATE_BUREAU_CHIEF', 'EDITOR_IN_CHIEF'];

async function run() {
  const prisma = new PrismaClient();
  const saltRounds = 10;
  try {
    const tenantAdminRole = await prisma.role.findFirst({ where: { name: 'TENANT_ADMIN' } });
    if (!tenantAdminRole) {
      console.error('TENANT_ADMIN role not found. Seed roles first.');
      return;
    }

    // Fetch default language (English) for assigning to created users
    const defaultLanguage = await prisma.language.findFirst({ where: { code: 'en' } });
    if (!defaultLanguage) {
      console.error('Default language (code="en") not found. Seed languages first.');
      return;
    }

    // Load external JSON mapping if present
    let tenantAdminMobiles: Record<string, string | string[]> = { ...inlineMapping };
    const possiblePaths = [
      path.join(process.cwd(), 'tenant_admin_mapping.json'),
      path.join(process.cwd(), 'scripts', 'tenant_admin_mapping.json')
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            tenantAdminMobiles = parsed;
            console.log(`Loaded tenant admin mapping from ${p}`);
            break;
          }
        } catch (e:any) {
          console.warn(`Failed to parse mapping file ${p}: ${e.message}`);
        }
      }
    }

    const tenants = await prisma.tenant.findMany();
    console.log(`Found ${tenants.length} tenants.`);

    for (const tenant of tenants) {
      const mapping = tenantAdminMobiles[tenant.slug];
      if (!mapping) {
        console.log(`[SKIP] ${tenant.slug}: no mobile mapping.`);
        continue;
      }
      const mobiles = Array.isArray(mapping) ? mapping : [mapping];
      for (const mobile of mobiles) {
        if (!/^\d{8,15}$/.test(mobile)) {
          console.warn(`[WARN] ${tenant.slug}: invalid mobile '${mobile}' (expect digits length 8-15). Skipping.`);
          continue;
        }
        // Check if reporter already links TENANT_ADMIN user for this tenant & mobile
        const existingUser = await prisma.user.findUnique({ where: { mobileNumber: mobile } });
        let userId: string;
        if (existingUser) {
          // Update role if different
          const updateData: any = {};
          if (existingUser.roleId !== tenantAdminRole.id) {
            updateData.roleId = tenantAdminRole.id;
          }
          if (!existingUser.languageId) {
            updateData.languageId = defaultLanguage.id;
          }
          if (Object.keys(updateData).length) {
            await prisma.user.update({ where: { id: existingUser.id }, data: updateData });
            console.log(`[UPDATE] User ${mobile} updated (${Object.keys(updateData).join(', ')}) for tenant ${tenant.slug}.`);
          }
          userId = existingUser.id;
        } else {
          const mpin = mobile.slice(-4) || '1234';
          const hashed = await bcrypt.hash(mpin, saltRounds);
          const createdUser = await prisma.user.create({
            data: {
              mobileNumber: mobile,
              mpin: hashed,
              roleId: tenantAdminRole.id,
              languageId: defaultLanguage.id,
              status: 'ACTIVE'
            }
          });
          userId = createdUser.id;
          console.log(`[CREATE] User ${mobile} created for tenant ${tenant.slug}.`);
        }

        // Check if reporter exists linking this user to tenant
        const existingReporter = await prisma.reporter.findFirst({ where: { userId, tenantId: tenant.id } });
        if (existingReporter) {
          console.log(`[SKIP] Reporter already exists for user ${mobile} in tenant ${tenant.slug}.`);
          continue;
        }

        // Choose designation (optional)
        let designationId: string | undefined;
        const designations = await prisma.reporterDesignation.findMany({ where: { tenantId: null } });
        for (const pref of designationPreference) {
          const found = designations.find(d => d.code === pref);
          if (found) { designationId = found.id; break; }
        }
        if (!designationId && designations.length) designationId = designations[0].id;

        const reporter = await prisma.reporter.create({
          data: {
            tenantId: tenant.id,
            userId,
            level: 'STATE',
            designationId,
            stateId: tenant.stateId || null
          }
        });
        console.log(`[CREATE] Reporter ${reporter.id} for user ${mobile} tenant ${tenant.slug}.`);
      }
    }
    console.log('Backfill complete.');
  } catch (e:any) {
    console.error('Backfill error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
