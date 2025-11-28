import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import crypto from 'crypto';
import { requireSuperAdmin, requireSuperOrTenantAdminScoped } from '../middlewares/authz';
import * as bcrypt from 'bcrypt';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * tags:
 *   - name: Tenants
 *     description: Tenant CRUD & PRGI fields
 *   - name: Razorpay Config
 *     description: Global and tenant Razorpay credentials
 *   - name: ID Cards
 *     description: Tenant ID card settings and rendering
 */

/**
 * @swagger
 * /admin/razorpay-config/global:
 *   put:
 *     summary: Upsert global Razorpay keys (SUPER_ADMIN)
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyId
 *               - keySecret
 *             properties:
 *               keyId:
 *                 type: string
 *                 description: Razorpay key_id
 *               keySecret:
 *                 type: string
 *                 description: Razorpay key_secret
 *               active:
 *                 type: boolean
 *                 description: Whether these keys are active
 *                 default: true
 *     responses:
 *       200:
 *         description: Global Razorpay config upserted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   get:
 *     summary: Get global Razorpay config (SUPER_ADMIN)
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current global Razorpay configuration
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put('/admin/razorpay-config/global', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { keyId, keySecret, active = true } = req.body || {};

    if (!keyId || !keySecret) {
      return res.status(400).json({ error: 'keyId and keySecret are required' });
    }

    const config = await (prisma as any).razorpayConfig.upsert({
      where: { tenantId: null },
      update: { keyId, keySecret, active: Boolean(active) },
      create: { tenantId: null, keyId, keySecret, active: Boolean(active) },
    });

    res.json({
      id: config.id,
      tenantId: config.tenantId,
      keyId: config.keyId,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  } catch (e) {
    console.error('global razorpay-config upsert error', e);
    res.status(500).json({ error: 'Failed to upsert global Razorpay config' });
  }
});

/**
 * @swagger
 * /tenants:
 *   get:
 *     summary: List tenants
 *     description: |
 *       Returns basic tenants by default. Pass `full=true` to include domains and entity details for each tenant.
 *     tags: [Tenants]
 *     parameters:
 *       - in: query
 *         name: full
 *         schema: { type: boolean, default: false }
 *         description: Include domains (status, primary) and full PRGI entity details.
 *     responses:
 *       200:
 *         description: List of tenants (optionally enriched with domains and entity)
 */
router.get('/', async (req, res) => {
  const full = ['1','true','yes','full','all'].includes(String(req.query.full || '').toLowerCase());
  const tenants = await (prisma as any).tenant.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
  if (!full || !tenants.length) return res.json(tenants);

  const ids = tenants.map((t: any) => t.id);
  const [domains, entities] = await Promise.all([
    (prisma as any).domain.findMany({
      where: { tenantId: { in: ids } },
      orderBy: [{ isPrimary: 'desc' }, { domain: 'asc' }]
    }),
    (prisma as any).tenantEntity.findMany({
      where: { tenantId: { in: ids } },
      include: {
        language: true,
        publicationCountry: true,
        publicationState: true,
        publicationDistrict: true,
        publicationMandal: true,
        printingDistrict: true,
        printingMandal: true,
      }
    })
  ]);

  const domainsByTenant: Record<string, any[]> = {};
  for (const d of domains) {
    const list = domainsByTenant[d.tenantId] || (domainsByTenant[d.tenantId] = []);
    // Expose non-sensitive domain fields only
    list.push({
      id: d.id,
      domain: d.domain,
      isPrimary: d.isPrimary,
      status: d.status,
      verifiedAt: d.verifiedAt,
      lastCheckAt: d.lastCheckAt,
      lastCheckStatus: d.lastCheckStatus
    });
  }
  const entityByTenant: Record<string, any> = {};
  for (const e of entities) entityByTenant[e.tenantId] = e;

  const shaped = tenants.map((t: any) => ({
    ...t,
    domains: domainsByTenant[t.id] || [],
    entity: entityByTenant[t.id] || null
  }));
  res.json(shaped);
});

/**
 * @swagger
 * /tenants/{id}:
 *   get:
 *     summary: Get tenant by id
 *     tags: [Tenants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tenant }
 *       404: { description: Not found }
 */
router.get('/:id', async (req, res) => {
  const t = await (prisma as any).tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

/**
 * @swagger
 * /tenants:
 *   post:
 *     summary: Create a new Newspaper entity (Tenant) [Superadmin]
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, prgiNumber]
 *             properties:
 *               name: { type: string }
 *               slug: { type: string, description: 'Unique slug for platform subdomains. Optional; auto-generated from name if omitted.' }
 *               prgiNumber: { type: string }
 *               stateId: { type: string }
 *               createDefaultDomains: { type: boolean, default: true }
 *     responses:
 *       200: { description: Created }
 */
router.post('/', auth, requireSuperAdmin, async (req, res) => {
  try {
    const {
      name,
      slug,
      prgiNumber,
      stateId,
      createDefaultDomains = true,
      adminMobileNumber,
      publisherMobileNumber,
      autoCreateAdmin = true,
      autoCreatePublisher = false,
      adminDesignationCode = 'EDITOR_IN_CHIEF',
      publisherDesignationCode = 'STATE_REPORTER'
    } = req.body || {};
    if (!name || !prgiNumber) return res.status(400).json({ error: 'name, prgiNumber required' });

    // Auto-generate slug if missing/null
    const generateSlug = (inputName: string) => {
      const base = String(inputName)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]+/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // spaces to hyphen
        .replace(/-+/g, '-'); // collapse multiple hyphens
      return base || `tenant-${crypto.randomBytes(3).toString('hex')}`;
    };

    let finalSlug = (slug && String(slug).trim()) ? String(slug).trim() : generateSlug(name);
    finalSlug = finalSlug.toLowerCase(); // normalize

    // Ensure uniqueness (light pre-check; DB constraint remains authoritative)
    const existing = await (prisma as any).tenant.findUnique({ where: { slug: finalSlug } }).catch(() => null);
    if (existing) {
      let attempt = 2;
      const base = finalSlug;
      while (attempt < 15) {
        const candidate = `${base}-${attempt}`;
        const taken = await (prisma as any).tenant.findUnique({ where: { slug: candidate } }).catch(() => null);
        if (!taken) { finalSlug = candidate; break; }
        attempt += 1;
      }
      if (existing && finalSlug === base) {
        finalSlug = `${base}-${crypto.randomBytes(2).toString('hex')}`;
      }
    }
    // create tenant
    const tenant = await (prisma as any).tenant.create({
      data: { name, slug: finalSlug, prgiNumber, stateId: stateId || null },
    });
    const createdDomains: any[] = [];
    if (createDefaultDomains) {
      const newsHost = `${finalSlug}.kaburlu.app`;
      const epaperHost = `epaper.${finalSlug}.kaburlu.app`;
      const token1 = crypto.randomBytes(12).toString('hex');
      const token2 = crypto.randomBytes(12).toString('hex');
      const d1 = await (prisma as any).domain.create({ data: { tenantId: tenant.id, domain: newsHost, isPrimary: true, status: 'ACTIVE', verificationToken: token1, verificationMethod: 'MANUAL' } });
      const d2 = await (prisma as any).domain.create({ data: { tenantId: tenant.id, domain: epaperHost, isPrimary: false, status: 'ACTIVE', verificationToken: token2, verificationMethod: 'MANUAL' } });
      createdDomains.push(d1, d2);
    }
    // Auto-create admin / publisher users using last4 mpin strategy
    const results: any = { tenant, domains: createdDomains, autoGeneratedSlug: !slug ? finalSlug : undefined };
    const english = await (prisma as any).language.findFirst({ where: { code: 'en' } }).catch(()=>null);
    const langId = english?.id || null;

    async function createUserAndReporter(mobile: string, roleName: string, designationCode: string) {
      if (!mobile) return { skipped: true, reason: 'mobile_missing' };
      const normalized = String(mobile).trim();
      if (!/^[0-9]{7,}$/.test(normalized)) return { skipped: true, reason: 'invalid_mobile' };
      const existingUser = await (prisma as any).user.findFirst({ where: { mobileNumber: normalized } });
      if (existingUser) return { skipped: true, reason: 'user_exists' };
      const mpinPlain = normalized.slice(-4);
      if (mpinPlain.length < 4) return { skipped: true, reason: 'mobile_too_short_for_last4' };
      const mpinHash = await bcrypt.hash(mpinPlain, 10);
      const role = await (prisma as any).role.findFirst({ where: { name: roleName } });
      if (!role) return { skipped: true, reason: 'role_missing' };
      const user = await (prisma as any).user.create({ data: { mobileNumber: normalized, mpin: mpinHash, roleId: role.id, languageId: langId, status: 'ACTIVE' } });
      // Link reporter profile with designation fallback (tenant override else global)
      const designation = await (prisma as any).reporterDesignation.findFirst({
        where: { OR: [ { tenantId: tenant.id, code: designationCode }, { tenantId: null, code: designationCode } ] },
        orderBy: { tenantId: 'desc' }
      }).catch(()=>null);
      const reporter = await (prisma as any).reporter.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          designationId: designation?.id || null,
          level: designation?.level || null,
          stateId: tenant.stateId || null
        }
      });
      return { created: true, mobile: normalized, defaultMpinStrategy: 'last4', designationCode: designationCode, reporterId: reporter.id };
    }

    if (autoCreateAdmin && adminMobileNumber) {
      results.adminCreation = await createUserAndReporter(adminMobileNumber, 'TENANT_ADMIN', adminDesignationCode);
    } else {
      results.adminCreation = { skipped: true, reason: !autoCreateAdmin ? 'autoCreateAdmin_disabled' : 'adminMobileNumber_missing' };
    }
    if (autoCreatePublisher && publisherMobileNumber) {
      // If same number as admin, skip separate publisher
      if (publisherMobileNumber === adminMobileNumber) {
        results.publisherCreation = { skipped: true, reason: 'same_as_admin' };
      } else {
        results.publisherCreation = await createUserAndReporter(publisherMobileNumber, 'PUBLISHER', publisherDesignationCode);
      }
    } else {
      results.publisherCreation = { skipped: true, reason: !autoCreatePublisher ? 'autoCreatePublisher_disabled' : 'publisherMobileNumber_missing' };
    }

    res.json(results);
  } catch (e: any) {
    if (String(e.message).includes('Unique constraint') || String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Slug or PRGI already exists' });
    }
    console.error('tenant create error', e);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/domains:
 *   post:
 *     summary: Add a domain to an entity (link domain) [Superadmin]
 *     tags: [Domains]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [domain]
 *             properties:
 *               domain: { type: string }
 *               isPrimary: { type: boolean, default: false }
 *     responses:
 *       200: { description: Created }
 */
router.post('/:tenantId/domains', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { domain, isPrimary = false } = req.body || {};
    if (!domain) return res.status(400).json({ error: 'domain required' });
    const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!t) return res.status(404).json({ error: 'Tenant not found' });
    const token = crypto.randomBytes(12).toString('hex');
    const row = await (prisma as any).domain.create({
      data: { tenantId, domain, isPrimary: Boolean(isPrimary), status: 'PENDING', verificationToken: token, verificationMethod: 'DNS_TXT' }
    });
    res.json({ domain: row, verifyInstruction: { type: 'DNS_TXT', name: `_kaburlu-verify.${domain}`, value: token } });
  } catch (e: any) {
    if (String(e.message).includes('Unique constraint') || String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Domain already linked' });
    }
    console.error('add domain error', e);
    res.status(500).json({ error: 'Failed to add domain' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/razorpay-config:
 *   post:
 *     summary: Create Razorpay keys for a tenant
 *     description: Fails if a config already exists for the tenant. Use PUT to update/replace.
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [keyId, keySecret]
 *             properties:
 *               keyId: { type: string }
 *               keySecret: { type: string }
 *               active: { type: boolean, default: true }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Tenant not found }
 *       409: { description: Already exists }
 *   put:
 *     summary: Upsert Razorpay keys for a tenant
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: Tenant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [keyId, keySecret]
 *             properties:
 *               keyId:
 *                 type: string
 *                 description: Razorpay key_id
 *               keySecret:
 *                 type: string
 *                 description: Razorpay key_secret
 *               active:
 *                 type: boolean
 *                 description: Whether these keys are active for this tenant
 *                 default: true
 *     responses:
 *       200: { description: Tenant Razorpay config upserted }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Tenant not found }
 */
router.put('/:tenantId/razorpay-config', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { keyId, keySecret, active = true } = req.body || {};

    if (!keyId || !keySecret) {
      return res.status(400).json({ error: 'keyId and keySecret are required' });
    }

    const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!t) return res.status(404).json({ error: 'Tenant not found' });

    const config = await (prisma as any).razorpayConfig.upsert({
      where: { tenantId },
      update: { keyId, keySecret, active: Boolean(active) },
      create: { tenantId, keyId, keySecret, active: Boolean(active) },
    });

    res.json({
      id: config.id,
      tenantId: config.tenantId,
      keyId: config.keyId,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  } catch (e) {
    console.error('tenant razorpay-config upsert error', e);
    res.status(500).json({ error: 'Failed to upsert tenant Razorpay config' });
  }
});

router.post('/:tenantId/razorpay-config', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { keyId, keySecret, active = true } = req.body || {};
    if (!keyId || !keySecret) return res.status(400).json({ error: 'keyId and keySecret are required' });
    const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!t) return res.status(404).json({ error: 'Tenant not found' });
    const existing = await (prisma as any).razorpayConfig.findUnique({ where: { tenantId } });
    if (existing) return res.status(409).json({ error: 'Tenant Razorpay config already exists. Use PUT to update.' });
    const created = await (prisma as any).razorpayConfig.create({ data: { tenantId, keyId, keySecret, active: Boolean(active) } });
    res.status(201).json({
      id: created.id,
      tenantId: created.tenantId,
      keyId: created.keyId,
      active: created.active,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    });
  } catch (e) {
    console.error('tenant razorpay-config create error', e);
    res.status(500).json({ error: 'Failed to create tenant Razorpay config' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/razorpay-config:
 *   get:
 *     summary: Get tenant Razorpay config
 *     tags: [Razorpay Config]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tenant Razorpay config (masked secret) }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.get('/:tenantId/razorpay-config', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!t) return res.status(404).json({ error: 'Tenant not found' });
    const config = await (prisma as any).razorpayConfig.findUnique({ where: { tenantId } });
    if (!config) return res.status(404).json({ error: 'Tenant Razorpay config not set' });
    const maskedSecret = config.keySecret ? `${config.keySecret.slice(0,4)}***${config.keySecret.slice(-2)}` : null;
    res.json({
      id: config.id,
      tenantId: config.tenantId,
      keyId: config.keyId,
      keySecretMasked: maskedSecret,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    });
  } catch (e) {
    console.error('tenant razorpay-config get error', e);
    res.status(500).json({ error: 'Failed to fetch tenant Razorpay config' });
  }
});

// Utilities: resolve references and parse date
function parseDateDDMMYYYY(input?: string): Date | null {
  if (!input) return null;
  // Accept DD/MM/YYYY or YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
    const [d, m, y] = input.split('/').map(Number);
    const iso = new Date(Date.UTC(y, m - 1, d));
    return isNaN(iso.getTime()) ? null : iso;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

async function resolveLanguageId(body: any) {
  const { languageId, languageCode, language } = body || {};
  if (languageId) {
    const row = await (prisma as any).language.findUnique({ where: { id: languageId } });
    return row?.id || null;
  }
  if (languageCode) {
    const row = await (prisma as any).language.findFirst({ where: { code: languageCode } });
    return row?.id || null;
  }
  if (language) {
    const row = await (prisma as any).language.findFirst({ where: { name: { equals: String(language), mode: 'insensitive' } } });
    return row?.id || null;
  }
  return null;
}

async function resolveByIdOrName(model: any, value?: string) {
  if (!value) return null;
  // If looks like cuid/uuid, try id; else try name case-insensitive
  const byId = await model.findUnique?.({ where: { id: value } }).catch(() => null);
  if (byId) return byId.id;
  const byName = await model.findFirst?.({ where: { name: { equals: String(value), mode: 'insensitive' } } }).catch(() => null);
  return byName?.id || null;
}

/**
 * @swagger
 * /tenants/{tenantId}/entity:
 *   post:
 *     summary: Create PRGI/entity details for a Tenant [Superadmin]
 *     description: |
 *       Creates PRGI registration details linked to the tenant.
 *       - If `prgiNumber` is omitted, it will use the Tenant's `prgiNumber`.
 *       - Accepts ONLY IDs for language and locations; name/code fields are ignored.
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prgiNumber: { type: string, example: "PRGI-TS-2025-01987" }
 *               registrationTitle: { type: string, example: "Prashnaayudham" }
 *               periodicity: { type: string, enum: [DAILY, WEEKLY, FORTNIGHTLY, MONTHLY], example: DAILY }
 *               registrationDate: { type: string, example: "27/05/2025" }
 *               languageId: { type: string, description: "Language row id" }
 *               ownerName: { type: string, example: "KATYADA BAPU RAO" }
 *               publisherName: { type: string, example: "KATYADA BAPU RAO" }
 *               editorName: { type: string, example: "KATYADA BAPU RAO" }
 *               publicationCountryId: { type: string, description: "Country id" }
 *               publicationStateId: { type: string, description: "State id" }
 *               publicationDistrictId: { type: string, description: "District id" }
 *               publicationMandalId: { type: string, description: "Mandal id" }
 *               printingPressName: { type: string, example: "SHASHI PRINTING PRESS" }
 *               printingDistrictId: { type: string, description: "District id" }
 *               printingMandalId: { type: string, description: "Mandal id" }
 *               printingCityName: { type: string, example: "KAMAREDDY" }
 *               address: { type: string }
 *     responses:
 *       200: { description: Upserted }
 */
router.post('/:tenantId/entity', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const body = req.body || {};
    const prgiNumber = body.prgiNumber || tenant.prgiNumber;
    if (!prgiNumber) return res.status(400).json({ error: 'prgiNumber missing on request and tenant' });
    // Accept only IDs for language and locations. Names/codes are ignored by design.
    const languageId = body.languageId || null;
    const publicationCountryId = body.publicationCountryId || null;
    const publicationStateId = body.publicationStateId || null;
    const publicationDistrictId = body.publicationDistrictId || null;
    const publicationMandalId = body.publicationMandalId || null;
    const printingDistrictId = body.printingDistrictId || null;
    const printingMandalId = body.printingMandalId || null;
    const registrationDate = parseDateDDMMYYYY(body.registrationDate || body.registration_date);

    const data = {
      tenantId,
      prgiNumber: String(prgiNumber),
      registrationTitle: body.registrationTitle || body.title || null,
      periodicity: (body.periodicity || 'DAILY').toUpperCase(),
      registrationDate: registrationDate || null,
      languageId,
      ownerName: body.ownerName || body.owner || null,
      publisherName: body.publisherName || body.publisher || null,
      editorName: body.editorName || body.editor || null,
      publicationCountryId,
      publicationStateId,
      publicationDistrictId,
      publicationMandalId,
      printingPressName: body.printingPressName || body.printingPress || null,
      printingDistrictId,
      printingMandalId,
      printingCityName: body.printingCityName || body.printingCity || null,
      address: body.address || null,
    };

    // Upsert on tenantId (unique)
    const row = await (prisma as any).tenantEntity.upsert({
      where: { tenantId },
      update: data,
      create: data,
      include: {
        language: true,
        publicationCountry: true,
        publicationState: true,
        publicationDistrict: true,
        publicationMandal: true,
        printingDistrict: true,
        printingMandal: true,
      }
    });
    res.json(row);
  } catch (e: any) {
    if (String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Duplicate prgiNumber' });
    }
    console.error('entity upsert error', e);
    res.status(500).json({ error: 'Failed to upsert entity details' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/entity/simple:
 *   post:
 *     summary: Simplified create of PRGI/entity for a Tenant
 *     description: |
 *       Derives prgiNumber and registrationTitle from Tenant. Defaults publicationStateId from Tenant.stateId.
 *       Creates/updates a TENANT_ADMIN user (with reporter profile) if adminMobile or publisherMobile is provided.
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               periodicity: { type: string, enum: [DAILY, WEEKLY, FORTNIGHTLY, MONTHLY], default: DAILY }
 *               registrationDate: { type: string, example: "04/09/2025" }
 *               adminMobile: { type: string, description: "Digits only (creates TENANT_ADMIN)" }
 *               publisherMobile: { type: string, description: "Alias for adminMobile (backwards compatible)" }
 *               publisherName: { type: string, description: "Stored as publisherName in entity; optional" }
 *               editorName: { type: string }
 *               printingPressName: { type: string }
 *               printingCityName: { type: string }
 *               address: { type: string, description: "Business address (optional)" }
 *               languageId: { type: string, description: "Mandatory language id" }
 *     responses:
 *       200: { description: Upserted }
 */
router.post('/:tenantId/entity/simple', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const body = req.body || {};
    const registrationDate = parseDateDDMMYYYY(body.registrationDate);
    const periodicity = (body.periodicity || 'DAILY').toUpperCase();
    // languageId is mandatory
    const languageId = body.languageId;
    if (!languageId) return res.status(400).json({ error: 'languageId is required' });
    const lang = await (prisma as any).language.findUnique({ where: { id: String(languageId) } }).catch(() => null);
    if (!lang) return res.status(400).json({ error: `Invalid languageId: '${languageId}'` });

    const data = {
      tenantId,
      prgiNumber: tenant.prgiNumber,
      registrationTitle: tenant.name,
      periodicity,
      registrationDate: registrationDate || null,
      languageId,
      ownerName: null,
      publisherName: body.publisherName || null,
      editorName: body.editorName || null,
      publicationCountryId: null,
      publicationStateId: tenant.stateId || null,
      publicationDistrictId: null,
      publicationMandalId: null,
      printingPressName: body.printingPressName || null,
      printingDistrictId: null,
      printingMandalId: null,
      printingCityName: body.printingCityName || null,
      address: body.address || null,
    };

    const row = await (prisma as any).tenantEntity.upsert({
      where: { tenantId },
      update: data,
      create: data,
      include: {
        language: true,
        publicationCountry: true,
        publicationState: true,
        publicationDistrict: true,
        publicationMandal: true,
        printingDistrict: true,
        printingMandal: true,
        tenant: { select: { id: true, name: true, slug: true, prgiNumber: true, prgiStatus: true } },
      }
    });

    // Optionally create / update TENANT_ADMIN user (alias: publisherMobile for backwards compatibility)
    let tenantAdminSetup: any = { skipped: true };
    const adminMobileRaw = body.adminMobile || body.publisherMobile;
    const adminMobile = adminMobileRaw ? String(adminMobileRaw).trim() : '';
    if (adminMobile) {
      if (!/^\d{7,}$/.test(adminMobile)) {
        tenantAdminSetup = { skipped: true, reason: 'invalid_mobile' };
      } else {
        const adminRole = await (prisma as any).role.findFirst({ where: { name: 'TENANT_ADMIN' } });
        if (adminRole) {
          const existingUser = await (prisma as any).user.findFirst({ where: { mobileNumber: adminMobile } });
          let userId: string;
          if (existingUser) {
            const toUpdate: any = {};
            if (existingUser.roleId !== adminRole.id) toUpdate.roleId = adminRole.id;
            if (!existingUser.languageId && languageId) toUpdate.languageId = languageId;
            if (Object.keys(toUpdate).length) {
              await (prisma as any).user.update({ where: { id: existingUser.id }, data: toUpdate });
            }
            userId = existingUser.id;
          } else {
            const mpinPlain = adminMobile.slice(-4);
            const mpinHash = await (require('bcrypt') as typeof import('bcrypt')).hash(mpinPlain, 10);
            const user = await (prisma as any).user.create({ data: { mobileNumber: adminMobile, mpin: mpinHash, roleId: adminRole.id, languageId, status: 'ACTIVE' } });
            userId = user.id;
          }
          const existingReporter = await (prisma as any).reporter.findFirst({ where: { tenantId, userId } });
          if (!existingReporter) {
            const designation = await (prisma as any).reporterDesignation.findFirst({
              where: { OR: [ { tenantId, code: 'EDITOR_IN_CHIEF' }, { tenantId: null, code: 'EDITOR_IN_CHIEF' } ] },
              orderBy: { tenantId: 'desc' }
            }).catch(()=>null);
            await (prisma as any).reporter.create({
              data: { tenantId, userId, designationId: designation?.id || null, level: designation?.level || null, stateId: tenant.stateId || null }
            });
          }
          tenantAdminSetup = { createdOrUpdated: true, mobile: adminMobile };
        } else {
          tenantAdminSetup = { skipped: true, reason: 'tenant_admin_role_missing' };
        }
      }
    }

    res.json({ entity: row, tenantAdminSetup });
  } catch (e: any) {
    if (String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Duplicate prgiNumber' });
    }
    console.error('entity simple upsert error', e);
    res.status(500).json({ error: 'Failed to create entity (simple)' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/entity/business:
 *   put:
 *     summary: Update business and printing details only
 *     description: Updates address, printingPressName, printingCityName, and optionally printingDistrictId/printingMandalId.
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address: { type: string }
 *               printingPressName: { type: string }
 *               printingCityName: { type: string }
 *               printingDistrictId: { type: string, nullable: true }
 *               printingMandalId: { type: string, nullable: true }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put('/:tenantId/entity/business', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const existing = await (prisma as any).tenantEntity.findUnique({ where: { tenantId } });
    if (!existing) return res.status(404).json({ error: 'Entity details not found for tenant' });

    const body = req.body || {};
    const row = await (prisma as any).tenantEntity.update({
      where: { tenantId },
      data: {
        address: body.address ?? existing.address,
        printingPressName: body.printingPressName ?? existing.printingPressName,
        printingCityName: body.printingCityName ?? existing.printingCityName,
        printingDistrictId: body.printingDistrictId ?? existing.printingDistrictId,
        printingMandalId: body.printingMandalId ?? existing.printingMandalId,
      }
    });
    res.json(row);
  } catch (e) {
    console.error('entity business update error', e);
    res.status(500).json({ error: 'Failed to update business/printing details' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/entity:
 *   put:
 *     summary: Update PRGI/entity details for a Tenant [Superadmin]
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registrationTitle: { type: string, example: "Prashnaayudham" }
 *               periodicity: { type: string, enum: [DAILY, WEEKLY, FORTNIGHTLY, MONTHLY], example: DAILY }
 *               registrationDate: { type: string, example: "27/05/2025" }
 *               languageId: { type: string, description: "Language id" }
 *               ownerName: { type: string, example: "KATYADA BAPU RAO" }
 *               publisherName: { type: string, example: "KATYADA BAPU RAO" }
 *               editorName: { type: string, example: "KATYADA BAPU RAO" }
 *               publicationCountryId: { type: string, description: "Country id" }
 *               publicationStateId: { type: string, description: "State id" }
 *               publicationDistrictId: { type: string, description: "District id" }
 *               publicationMandalId: { type: string, description: "Mandal id" }
 *               printingPressName: { type: string, example: "SHASHI PRINTING PRESS" }
 *               printingDistrictId: { type: string, description: "District id" }
 *               printingMandalId: { type: string, description: "Mandal id" }
 *               printingCityName: { type: string, example: "KAMAREDDY" }
 *               address: { type: string }
 *     description: prgiNumber is immutable and cannot be updated.
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put('/:tenantId/entity', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const existing = await (prisma as any).tenantEntity.findUnique({ where: { tenantId } });
    if (!existing) return res.status(404).json({ error: 'Entity details not found for tenant' });

    const body = req.body || {};
    // Enforce immutability of prgiNumber on update
    if (typeof body.prgiNumber === 'string' && body.prgiNumber.trim() && body.prgiNumber.trim() !== existing.prgiNumber) {
      return res.status(400).json({ error: 'prgiNumber cannot be updated once created' });
    }

    // Accept only IDs for language and locations. Names/codes are ignored by design.
    const languageId = body.languageId ?? existing.languageId;
    const publicationCountryId = body.publicationCountryId ?? existing.publicationCountryId;
    const publicationStateId = body.publicationStateId ?? existing.publicationStateId;
    const publicationDistrictId = body.publicationDistrictId ?? existing.publicationDistrictId;
    const publicationMandalId = body.publicationMandalId ?? existing.publicationMandalId;
    const printingDistrictId = body.printingDistrictId ?? existing.printingDistrictId;
    const printingMandalId = body.printingMandalId ?? existing.printingMandalId;
    const registrationDate = parseDateDDMMYYYY(body.registrationDate || body.registration_date);

    const updateData: any = {
      registrationTitle: body.registrationTitle ?? body.title ?? existing.registrationTitle,
      periodicity: (body.periodicity || existing.periodicity || 'DAILY').toUpperCase(),
      registrationDate: registrationDate ?? existing.registrationDate,
      languageId: languageId ?? existing.languageId,
      ownerName: body.ownerName ?? body.owner ?? existing.ownerName,
      publisherName: body.publisherName ?? body.publisher ?? existing.publisherName,
      editorName: body.editorName ?? body.editor ?? existing.editorName,
      publicationCountryId: publicationCountryId ?? existing.publicationCountryId,
      publicationStateId: publicationStateId ?? existing.publicationStateId,
      publicationDistrictId: publicationDistrictId ?? existing.publicationDistrictId,
      publicationMandalId: publicationMandalId ?? existing.publicationMandalId,
      printingPressName: body.printingPressName ?? body.printingPress ?? existing.printingPressName,
      printingDistrictId: printingDistrictId ?? existing.printingDistrictId,
      printingMandalId: printingMandalId ?? existing.printingMandalId,
      printingCityName: body.printingCityName ?? body.printingCity ?? existing.printingCityName,
      address: body.address ?? existing.address,
    };
    // Do not allow updating prgiNumber

    const row = await (prisma as any).tenantEntity.update({
      where: { tenantId },
      data: updateData,
      include: {
        language: true,
        publicationCountry: true,
        publicationState: true,
        publicationDistrict: true,
        publicationMandal: true,
        printingDistrict: true,
        printingMandal: true,
      }
    });
    res.json(row);
  } catch (e: any) {
    if (String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Duplicate prgiNumber' });
    }
    console.error('entity update error', e);
    res.status(500).json({ error: 'Failed to update entity details' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/entity:
 *   get:
 *     summary: Get PRGI/entity details for a Tenant [Superadmin]
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: TenantEntity }
 *       404: { description: Not found }
 */
router.get('/:tenantId/entity', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const row = await (prisma as any).tenantEntity.findUnique({
      where: { tenantId },
      include: {
        language: true,
        publicationCountry: true,
        publicationState: true,
        publicationDistrict: true,
        publicationMandal: true,
        printingDistrict: true,
        printingMandal: true,
        tenant: { select: { id: true, name: true, slug: true, prgiNumber: true, prgiStatus: true } },
      }
    });
    if (!row) return res.status(404).json({ error: 'Entity details not found for tenant' });
    res.json(row);
  } catch (e) {
    console.error('entity get error', e);
    res.status(500).json({ error: 'Failed to fetch entity details' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/categories:
 *   get:
 *     summary: List allocated categories for a tenant (union of domain allocations)
 *     description: |
 *       Returns unique categories allocated to any domain belonging to the tenant. Optionally filter
 *       by specific domain with `domainId`. If the tenant entity has a primary language set and
 *       `includeTranslation` is true (default), the translated name for that language is included as
 *       `translatedName`. If a tenant has no domains or no allocations, an empty array is returned.
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includeTranslation
 *         schema: { type: boolean, default: true }
 *         description: Include tenant primary language translation name.
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *         description: Limit categories to a single domain's allocation (must belong to tenant).
 *     responses:
 *       200:
 *         description: Allocated category list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   slug: { type: string }
 *                   name: { type: string }
 *                   translatedName: { type: string, nullable: true }
 *                   parentId: { type: string, nullable: true }
 *       404: { description: Tenant or domain (when specified) not found }
 */
router.get('/:tenantId/categories', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const includeTranslation = String(req.query.includeTranslation ?? 'true').toLowerCase() === 'true';
    const domainFilterId = req.query.domainId ? String(req.query.domainId) : undefined;
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Fetch domains for tenant; optionally validate domainId
    const domains = await (prisma as any).domain.findMany({ where: { tenantId } });
    if (!domains.length) return res.json([]);
    let targetDomainIds: string[];
    if (domainFilterId) {
      const match = domains.find((d: any) => d.id === domainFilterId);
      if (!match) return res.status(404).json({ error: 'Domain not found for tenant' });
      targetDomainIds = [domainFilterId];
    } else {
      targetDomainIds = domains.map((d: any) => d.id);
    }

    // Domain category allocations
    const domainCats = await (prisma as any).domainCategory.findMany({
      where: { domainId: { in: targetDomainIds } },
      include: { category: true }
    });
    if (!domainCats.length) return res.json([]);
    // Unique categories
    const catMap = new Map<string, any>();
    domainCats.forEach((dc: any) => { if (!dc.category.isDeleted) catMap.set(dc.categoryId, dc.category); });
    const categories = Array.from(catMap.values());

    // Translation logic
    const entity = includeTranslation
      ? await (prisma as any).tenantEntity.findUnique({ where: { tenantId }, include: { language: true } }).catch(() => null)
      : null;
    const langCode = includeTranslation ? entity?.language?.code : null;
    let translations: any[] = [];
    if (langCode && categories.length) {
      const ids = categories.map((c: any) => c.id);
      translations = await (prisma as any).categoryTranslation.findMany({ where: { categoryId: { in: ids }, language: langCode } });
    }
    const tMap = new Map(translations.map((t: any) => [t.categoryId, t.name]));
    const shaped = categories.map((c: any) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      translatedName: langCode ? (tMap.get(c.id) || null) : null,
      parentId: c.parentId || null
    }));
    res.json(shaped);
  } catch (e: any) {
    console.error('tenant allocated categories error', e);
    res.status(500).json({ error: 'Failed to list tenant categories' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/id-card-settings:
 *   get:
 *     summary: Get ID card settings for a tenant
 *     tags: [ID Cards]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tenant ID card settings }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *   put:
 *     summary: Upsert ID card settings for a tenant
 *     tags: [ID Cards]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateId: { type: string, default: "STYLE_1" }
 *               frontLogoUrl: { type: string }
 *               roundStampUrl: { type: string }
 *               signUrl: { type: string }
 *               primaryColor: { type: string, example: "#004f9f" }
 *               secondaryColor: { type: string, example: "#ff0000" }
 *               termsJson: { type: array, items: { type: string } }
 *               officeAddress: { type: string }
 *               helpLine1: { type: string }
 *               helpLine2: { type: string }
 *               validityType: { type: string, enum: [PER_USER_DAYS, FIXED_END_DATE], default: PER_USER_DAYS }
 *               validityDays: { type: integer, description: "Used when validityType = PER_USER_DAYS" }
 *               fixedValidUntil: { type: string, format: date-time, description: "Used when validityType = FIXED_END_DATE" }
 *               idPrefix: { type: string, example: "KM" }
 *               idDigits: { type: integer, example: 6 }
 *     responses:
 *       200: { description: Upserted }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Tenant not found }
 */
router.get('/:tenantId/id-card-settings', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId } });
    if (!settings) return res.status(404).json({ error: 'ID card settings not found for tenant' });
    res.json(settings);
  } catch (e) {
    console.error('tenant id-card-settings get error', e);
    res.status(500).json({ error: 'Failed to fetch ID card settings' });
  }
});

router.put('/:tenantId/id-card-settings', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = req.body || {};
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const data: any = {
      tenantId,
      templateId: body.templateId || 'STYLE_1',
      frontLogoUrl: body.frontLogoUrl ?? null,
      roundStampUrl: body.roundStampUrl ?? null,
      signUrl: body.signUrl ?? null,
      primaryColor: body.primaryColor ?? null,
      secondaryColor: body.secondaryColor ?? null,
      termsJson: Array.isArray(body.termsJson) ? body.termsJson : null,
      officeAddress: body.officeAddress ?? null,
      helpLine1: body.helpLine1 ?? null,
      helpLine2: body.helpLine2 ?? null,
      validityType: body.validityType || 'PER_USER_DAYS',
      validityDays: body.validityType === 'PER_USER_DAYS' ? (body.validityDays ?? null) : null,
      fixedValidUntil: body.validityType === 'FIXED_END_DATE' ? (body.fixedValidUntil ? new Date(body.fixedValidUntil) : null) : null,
      idPrefix: body.idPrefix ?? null,
      idDigits: body.idDigits ?? null,
    };

    const row = await (prisma as any).tenantIdCardSettings.upsert({
      where: { tenantId },
      update: data,
      create: data,
    });
    res.json(row);
  } catch (e) {
    console.error('tenant id-card-settings upsert error', e);
    res.status(500).json({ error: 'Failed to upsert ID card settings' });
  }
});

export default router;
