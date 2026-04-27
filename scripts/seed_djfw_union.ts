/**
 * Seed script: Democratic Journalist Federation (Working) — DJF(W)
 * REG NO: 343/2025
 *
 * Run: npx ts-node --project tsconfig.json scripts/seed_djfw_union.ts
 *
 * What it does:
 * 1. Create/update union settings for DJF(W)
 * 2. Find users by mobile, create if missing
 * 3. Assign Telangana President (T Arun Kumar) and AP President (Ch Srikanth)
 * 4. Seed default committee posts
 * 5. Appoint presidents as post holders
 * 6. Upload logo to Bunny CDN
 * 7. Full API test via curl-style HTTP calls
 */

import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { bunnyStoragePutObject } from '../src/lib/bunnyStorage';
import sharp from 'sharp';

const prisma = new PrismaClient();
const p: any = prisma;

const UNION_NAME = 'Democratic Journalist Federation (Working)';
const UNION_SLUG = 'djfw';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

// ── Colours for terminal output ──────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const W = (s: string) => `\x1b[1m${s}\x1b[0m`;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function findOrCreateUser(mobileNumber: string, fullName: string): Promise<any> {
  let user: any = await prisma.user.findUnique({ where: { mobileNumber }, include: { profile: true, role: true } });
  if (!user) {
    console.log(Y(`  → User ${mobileNumber} not found — creating...`));
    const hashedMpin = await bcrypt.hash('1234', 10);
    // Find a basic role
    const role = await p.role.findFirst({ where: { name: 'TENANT_ADMIN' } });
    user = await p.user.create({
      data: {
        mobileNumber,
        mpin: hashedMpin,
        roleId: role?.id,
        profile: { create: { fullName } },
      },
      include: { profile: true, role: true },
    });
    console.log(G(`  ✓ Created user ${fullName} (${mobileNumber})`));
  } else {
    console.log(G(`  ✓ Found user ${user.profile?.fullName || mobileNumber} — role: ${(user as any).role?.name || 'none'}`));
  }
  return user;
}

async function getOrCreateSuperAdminToken(): Promise<string> {
  // Login as the existing SUPER_ADMIN user
  const superAdmin = await p.user.findFirst({
    where: { role: { name: 'SUPER_ADMIN' } },
    include: { role: true },
  });
  if (!superAdmin) throw new Error('No SUPER_ADMIN user found in DB');

  const res = await axios.post(`${API_BASE}/auth/login`, {
    mobileNumber: superAdmin.mobileNumber,
    mpin: '1234',
  }).catch(async () => {
    // Try with known mpin from .env or default
    return axios.post(`${API_BASE}/auth/login`, {
      mobileNumber: superAdmin.mobileNumber,
      mpin: process.env.SUPER_ADMIN_MPIN || '1234',
    });
  });

  const token = res.data?.jwt || res.data?.data?.jwt;
  if (!token) throw new Error(`Login failed for ${superAdmin.mobileNumber}: ${JSON.stringify(res.data)}`);
  console.log(G(`  ✓ SuperAdmin token obtained (${superAdmin.mobileNumber})`));
  return token;
}

async function apiTest(label: string, fn: () => Promise<any>) {
  process.stdout.write(`  ${B('TEST')} ${label} ... `);
  try {
    const result = await fn();
    console.log(G('✓ OK'));
    return result;
  } catch (e: any) {
    const msg = e?.response?.data ? JSON.stringify(e.response.data).slice(0, 200) : e.message;
    console.log(R(`✗ FAIL`) + ` — ${msg}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(W('\n═══ DJF(W) Union Seed & Test ═══\n'));

  // ── 1. Union Settings ────────────────────────────────────────────────────────
  console.log(B('1. Union Settings'));
  const settings = await p.journalistUnionSettings.upsert({
    where:  { unionName: UNION_NAME },
    create: {
      unionName:          UNION_NAME,
      displayName:        'Democratic Journalist Federation (Working)',
      registrationNumber: '343/2025',
      address:            'Hyderabad, Telangana',
      primaryState:       'Telangana',
      states:             ['Telangana', 'Andhra Pradesh'],
      foundedYear:        2025,
      email:              'djfw@kaburlu.com',
    },
    update: {
      displayName:        'Democratic Journalist Federation (Working)',
      registrationNumber: '343/2025',
      states:             ['Telangana', 'Andhra Pradesh'],
      primaryState:       'Telangana',
    },
    include: { stateConfigs: true },
  });
  console.log(G(`  ✓ Union settings saved — ${settings.unionName}`));

  // ── 2. State Settings ────────────────────────────────────────────────────────
  console.log(B('\n2. State Settings'));
  await p.journalistUnionStateSettings.upsert({
    where:  { unionName_state: { unionName: UNION_NAME, state: 'Telangana' } },
    create: { unionName: UNION_NAME, state: 'Telangana', address: 'Hyderabad, Telangana' },
    update: { address: 'Hyderabad, Telangana' },
  });
  await p.journalistUnionStateSettings.upsert({
    where:  { unionName_state: { unionName: UNION_NAME, state: 'Andhra Pradesh' } },
    create: { unionName: UNION_NAME, state: 'Andhra Pradesh', address: 'Vijayawada, Andhra Pradesh' },
    update: { address: 'Vijayawada, Andhra Pradesh' },
  });
  console.log(G('  ✓ Telangana + Andhra Pradesh state configs created'));

  // ── 3. Users ─────────────────────────────────────────────────────────────────
  console.log(B('\n3. Users'));
  const arunKumar  = await findOrCreateUser('7392888555', 'T Arun Kumar');
  const srikanth   = await findOrCreateUser('8906189999', 'Ch Srikanth');

  // ── 4. Journalist Profiles ───────────────────────────────────────────────────
  console.log(B('\n4. Journalist Profiles'));
  async function ensureProfile(user: any, name: string, district: string, state: string) {
    let profile = await p.journalistProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await p.journalistProfile.create({
        data: {
          userId:      user.id,
          designation: 'State President',
          district,
          organization: 'Democratic Journalist Federation (Working)',
          unionName:   UNION_NAME,
          state,
          approved:    true,
          approvedAt:  new Date(),
          kycVerified: true,
          kycVerifiedAt: new Date(),
          currentDesignation: 'State President',
          currentNewspaper:   'DJF(W)',
        },
      });
      console.log(G(`  ✓ Created journalist profile for ${name}`));
    } else {
      // Update to ensure approved
      profile = await p.journalistProfile.update({
        where: { id: profile.id },
        data: { approved: true, approvedAt: profile.approvedAt || new Date(), unionName: UNION_NAME, state },
      });
      console.log(G(`  ✓ Profile exists for ${name} (id: ${profile.id})`));
    }
    return profile;
  }

  const arunProfile  = await ensureProfile(arunKumar,  'T Arun Kumar',  'Hyderabad',   'Telangana');
  const srikanth_profile = await ensureProfile(srikanth, 'Ch Srikanth', 'Vijayawada',  'Andhra Pradesh');

  // ── 5. Seed Default Posts ─────────────────────────────────────────────────────
  console.log(B('\n5. Default Committee Posts'));
  const defaultPosts = [
    { title: 'State President',          nativeTitle: 'రాష్ట్ర అధ్యక్షుడు',        level: 'STATE',    type: 'ELECTED',   sortOrder: 1 },
    { title: 'State Working President',  nativeTitle: 'రాష్ట్ర కార్యాచరణ అధ్యక్షుడు', level: 'STATE',    type: 'ELECTED',   sortOrder: 2 },
    { title: 'State General Secretary',  nativeTitle: 'రాష్ట్ర ప్రధాన కార్యదర్శి', level: 'STATE',    type: 'ELECTED',   sortOrder: 3 },
    { title: 'State Treasurer',          nativeTitle: 'రాష్ట్ర కోశాధికారి',         level: 'STATE',    type: 'ELECTED',   sortOrder: 4 },
    { title: 'District President',       nativeTitle: 'జిల్లా అధ్యక్షుడు',         level: 'DISTRICT', type: 'ELECTED',   sortOrder: 5 },
    { title: 'District Secretary',       nativeTitle: 'జిల్లా కార్యదర్శి',          level: 'DISTRICT', type: 'ELECTED',   sortOrder: 6 },
    { title: 'Executive Member',         nativeTitle: 'కార్యనిర్వాహక సభ్యుడు',      level: 'STATE',    type: 'APPOINTED', sortOrder: 7 },
  ];

  for (const post of defaultPosts) {
    const existing = await p.journalistUnionPostDefinition.findFirst({
      where: { title: post.title, unionName: UNION_NAME },
    });
    if (!existing) {
      await p.journalistUnionPostDefinition.create({ data: { ...post, unionName: UNION_NAME } });
      console.log(G(`  ✓ Post: ${post.title}`));
    } else {
      console.log(Y(`  ~ Post exists: ${post.title}`));
    }
  }

  // ── 6. Appoint Presidents ────────────────────────────────────────────────────
  console.log(B('\n6. Appoint State Presidents'));
  const presidentPost = await p.journalistUnionPostDefinition.findFirst({
    where: { title: 'State President', unionName: UNION_NAME },
  });

  if (presidentPost) {
    for (const { profile, state, name } of [
      { profile: arunProfile,        state: 'Telangana',       name: 'T Arun Kumar' },
      { profile: srikanth_profile,   state: 'Andhra Pradesh',  name: 'Ch Srikanth' },
    ]) {
      const existing = await p.journalistUnionPostHolder.findFirst({
        where: { postId: presidentPost.id, profileId: profile.id, isActive: true },
      });
      if (!existing) {
        await p.journalistUnionPostHolder.create({
          data: {
            postId:        presidentPost.id,
            profileId:     profile.id,
            unionName:     UNION_NAME,
            termStartDate: new Date('2025-01-01'),
            isActive:      true,
            notes:         `State President — ${state}`,
          },
        });
        console.log(G(`  ✓ Appointed ${name} as State President (${state})`));
      } else {
        console.log(Y(`  ~ ${name} already appointed`));
      }
    }
  }

  // ── 7. Union Admin assignment ────────────────────────────────────────────────
  console.log(B('\n7. Union Admin records (for scoped admin access)'));
  // Note: These are Journalist Union Admins (can access /admin/applications etc.)
  for (const { user, state, name } of [
    { user: arunKumar as any, state: 'Telangana',      name: 'T Arun Kumar' },
    { user: srikanth  as any, state: 'Andhra Pradesh', name: 'Ch Srikanth' },
  ]) {
    const existing = await p.journalistUnionAdmin.findFirst({
      where: { userId: user.id, unionName: UNION_NAME },
    });
    if (!existing) {
      await p.journalistUnionAdmin.create({
        data: { userId: user.id, unionName: UNION_NAME, state },
      });
      console.log(G(`  ✓ Assigned ${name} as union admin (scoped to ${state})`));
    } else {
      console.log(Y(`  ~ ${name} already a union admin`));
    }
  }

  // ── 8. Logo upload to Bunny ───────────────────────────────────────────────────
  console.log(B('\n8. Logo Upload to Bunny CDN'));
  const logoPath = path.join(__dirname, '../djfw_logo.jpeg');
  if (fs.existsSync(logoPath)) {
    try {
      const imgBuf = fs.readFileSync(logoPath);
      const pngBuf = await sharp(imgBuf).png().toBuffer();
      const safeUnion = UNION_NAME.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      const { publicUrl } = await bunnyStoragePutObject({
        key: `journalist-union/${safeUnion}/assets/logo.png`,
        body: pngBuf,
        contentType: 'image/png',
      });
      await p.journalistUnionSettings.update({
        where: { unionName: UNION_NAME },
        data:  { logoUrl: publicUrl, idCardLogoUrl: publicUrl },
      });
      console.log(G(`  ✓ Logo uploaded → ${publicUrl}`));
    } catch (e: any) {
      console.log(R(`  ✗ Logo upload failed: ${e.message}`));
    }
  } else {
    console.log(Y(`  ⚠ Logo file not found at ${logoPath} — skipping`));
    console.log(Y(`    Place djfw_logo.jpeg in project root and re-run to upload`));
  }

  // ── 9. API Tests ─────────────────────────────────────────────────────────────
  console.log(B('\n9. API Tests'));

  let token: string;
  try {
    token = await getOrCreateSuperAdminToken();
  } catch (e: any) {
    console.log(R(`  ✗ Cannot get SuperAdmin token: ${e.message}`));
    console.log(Y('  Skipping API tests — run manually or check SUPER_ADMIN_MPIN env var'));
    await prisma.$disconnect();
    return;
  }

  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = API_BASE;

  // Public APIs
  await apiTest('GET /journalist/public/settings/:unionName', async () => {
    const r = await axios.get(`${base}/journalist/public/settings/${encodeURIComponent(UNION_NAME)}`);
    if (!r.data?.unionName) throw new Error('No unionName in response');
    return r.data;
  });

  await apiTest('GET /journalist/directory (public)', async () => {
    const r = await axios.get(`${base}/journalist/directory?unionName=${encodeURIComponent(UNION_NAME)}&limit=5`);
    if (typeof r.data?.total === 'undefined') throw new Error('No total in response');
    return r.data;
  });

  await apiTest('GET /journalist/posts/definitions (public)', async () => {
    const r = await axios.get(`${base}/journalist/posts/definitions?unionName=${encodeURIComponent(UNION_NAME)}`);
    if (!Array.isArray(r.data?.posts)) throw new Error('No posts array');
    return r.data;
  });

  await apiTest('GET /journalist/committee (public)', async () => {
    const r = await axios.get(`${base}/journalist/committee?unionName=${encodeURIComponent(UNION_NAME)}`);
    if (typeof r.data !== 'object') throw new Error('Bad response');
    return r.data;
  });

  // SuperAdmin APIs
  await apiTest('GET /journalist/admin/settings (SuperAdmin)', async () => {
    const r = await axios.get(`${base}/journalist/admin/settings?unionName=${encodeURIComponent(UNION_NAME)}`, { headers: h });
    if (!r.data?.unionName) throw new Error('No unionName in response');
    return r.data;
  });

  await apiTest('GET /journalist/admin/applications (SuperAdmin)', async () => {
    const r = await axios.get(`${base}/journalist/admin/applications?unionName=${encodeURIComponent(UNION_NAME)}`, { headers: h });
    if (typeof r.data?.total === 'undefined') throw new Error('No total');
    return r.data;
  });

  await apiTest('GET /journalist/admin/cards/renewal-due (SuperAdmin)', async () => {
    const r = await axios.get(`${base}/journalist/admin/cards/renewal-due?unionName=${encodeURIComponent(UNION_NAME)}`, { headers: h });
    if (!Array.isArray(r.data?.cards)) throw new Error('No cards array');
    return r.data;
  });

  await apiTest('GET /journalist/admin/complaints (SuperAdmin)', async () => {
    const r = await axios.get(`${base}/journalist/admin/complaints?unionName=${encodeURIComponent(UNION_NAME)}`, { headers: h });
    if (typeof r.data?.total === 'undefined') throw new Error('No total');
    return r.data;
  });

  await apiTest('GET /journalist/admin/union-admins (SuperAdmin)', async () => {
    const r = await axios.get(`${base}/journalist/admin/union-admins?unionName=${encodeURIComponent(UNION_NAME)}`, { headers: h });
    if (!Array.isArray(r.data)) throw new Error('Not an array');
    console.log(`(${r.data.length} admin(s))`);
    return r.data;
  });

  // Member APIs — test with Arun Kumar's token
  let memberToken: string | null = null;
  try {
    const mRes = await axios.post(`${base}/auth/login`, { mobileNumber: '7392888555', mpin: '1234' });
    memberToken = mRes.data?.jwt || mRes.data?.data?.jwt;
    console.log(G('  ✓ Arun Kumar member token obtained'));
  } catch (e: any) {
    console.log(Y('  ⚠ Could not login as Arun Kumar (mpin may differ)'));
  }

  if (memberToken) {
    const mh = { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' };
    await apiTest('GET /journalist/profile (member)', async () => {
      const r = await axios.get(`${base}/journalist/profile`, { headers: mh });
      if (!r.data?.id) throw new Error('No profile id');
      return r.data;
    });

    await apiTest('GET /journalist/my-card (member)', async () => {
      const r = await axios.get(`${base}/journalist/my-card`, { headers: mh });
      return r.data;
    });

    await apiTest('GET /journalist/my-posts (member)', async () => {
      const r = await axios.get(`${base}/journalist/my-posts`, { headers: mh });
      if (!Array.isArray(r.data?.posts)) throw new Error('No posts');
      console.log(`(${r.data.posts.length} post(s))`);
      return r.data;
    });

    await apiTest('GET /journalist/reporter-link (member)', async () => {
      const r = await axios.get(`${base}/journalist/reporter-link`, { headers: mh });
      return r.data;
    });

    await apiTest('GET /journalist/my-insurance (member)', async () => {
      const r = await axios.get(`${base}/journalist/my-insurance`, { headers: mh });
      if (!Array.isArray(r.data?.insurances)) throw new Error('No insurances array');
      return r.data;
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(W('\n═══ Seed Complete ═══'));
  console.log(G(`  Union:   ${UNION_NAME}`));
  console.log(G(`  Reg No:  343/2025`));
  console.log(G(`  TS Prez: T Arun Kumar (7392888555)`));
  console.log(G(`  AP Prez: Ch Srikanth  (8906189999)`));
  console.log(Y(`\n  Swagger: ${base.replace('/api/v1', '')}/api/v1/docs#/Journalist%20Union`));
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(R(e.message || String(e)));
  await prisma.$disconnect();
  process.exit(1);
});
