import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { createUser, findUserByMobileNumber } from '../users/users.service';
import { sendWhatsappIdCardTemplate } from '../../lib/whatsapp';
import { generateAndUploadIdCardPdf, isBunnyCdnConfigured } from '../../lib/idCardPdf';

const router = Router();

const includeReporterContact = {
  designation: true,
  user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } }
} as const;

function mapReporterContact(r: any) {
  if (!r) return r;
  const fullName = r?.user?.profile?.fullName || null;
  const mobileNumber = r?.user?.mobileNumber || null;
  const { user, ...rest } = r;
  return { ...rest, fullName, mobileNumber };
}

/**
 * Send ID card PDF to reporter via WhatsApp.
 * Called after ID card generation/regeneration or on resend request.
 */
async function sendIdCardViaWhatsApp(params: {
  reporterId: string;
  tenantId: string;
  pdfUrl: string;
  cardNumber: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    // Get reporter mobile number and tenant info
    const reporter = await (prisma as any).reporter.findFirst({
      where: { id: params.reporterId, tenantId: params.tenantId },
      include: {
        user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
      },
    });

    if (!reporter?.user?.mobileNumber) {
      return { ok: false, error: 'Reporter mobile number not found' };
    }

    // Get tenant/organization name
    const [tenant, tenantEntity] = await Promise.all([
      (prisma as any).tenant.findUnique({ where: { id: params.tenantId }, select: { name: true } }),
      (prisma as any).tenantEntity?.findUnique?.({ where: { tenantId: params.tenantId }, select: { nativeName: true, publisherName: true } }).catch(() => null),
    ]);

    const organizationName = tenantEntity?.nativeName || tenantEntity?.publisherName || tenant?.name || 'Kaburlu Media';
    const reporterName = reporter.user.profile?.fullName || 'Reporter';
    const pdfFilename = `${reporterName.replace(/\s+/g, '_')}_ID_Card_${params.cardNumber}.pdf`;

    console.log(`[WhatsApp ID Card] Sending to ${reporter.user.mobileNumber} for reporter ${params.reporterId}`);

    const result = await sendWhatsappIdCardTemplate({
      toMobileNumber: reporter.user.mobileNumber,
      pdfUrl: params.pdfUrl,
      cardType: 'Reporter ID',
      organizationName,
      documentType: 'ID Card',
      pdfFilename,
    });

    if (result.ok) {
      console.log(`[WhatsApp ID Card] Sent successfully to ${reporter.user.mobileNumber}, messageId: ${result.messageId}`);
      return { ok: true, messageId: result.messageId };
    } else {
      console.error(`[WhatsApp ID Card] Failed to send:`, result.error, result.details);
      return { ok: false, error: result.error };
    }
  } catch (e: any) {
    console.error('[WhatsApp ID Card] Error:', e);
    return { ok: false, error: e.message || 'Failed to send WhatsApp message' };
  }
}

type ReporterLevelInput = 'STATE' | 'DISTRICT' | 'MANDAL' | 'ASSEMBLY';

function getLocationKeyFromLevel(
  level: ReporterLevelInput,
  body: any
): { field: 'stateId' | 'districtId' | 'mandalId' | 'assemblyConstituencyId'; id: string } {
  if (level === 'STATE') return { field: 'stateId', id: String(body?.stateId || '') };
  if (level === 'DISTRICT') return { field: 'districtId', id: String(body?.districtId || '') };
  // ASSEMBLY level accepts assemblyConstituencyId OR mandalId (backward compatibility)
  if (level === 'ASSEMBLY') {
    const assemblyId = String(body?.assemblyConstituencyId || body?.mandalId || '');
    return { field: 'assemblyConstituencyId', id: assemblyId };
  }
  return { field: 'mandalId', id: String(body?.mandalId || '') };
}

function pickReporterLimitMax(
  settingsData: any,
  input: { designationId: string; level: ReporterLevelInput; location: { field: string; id: string } }
): number | undefined {
  const limits = settingsData?.reporterLimits;
  // Limits are always enforced. Default is max=1 when not configured.
  if (!limits) return 1;

  const rules: any[] = Array.isArray(limits.rules) ? limits.rules : [];
  const defaultMax = typeof limits.defaultMax === 'number' ? limits.defaultMax : 1;

  const locationField = input.location.field;
  const locationId = input.location.id;

  const exact = rules.find(
    (r) =>
      String(r?.designationId || '') === input.designationId &&
      String(r?.level || '') === input.level &&
      String(r?.[locationField] || '') === locationId
  );
  if (typeof exact?.max === 'number') return exact.max;

  const wildcardLocation = rules.find(
    (r) =>
      String(r?.designationId || '') === input.designationId &&
      String(r?.level || '') === input.level &&
      !r?.stateId &&
      !r?.districtId &&
      !r?.mandalId &&
      !r?.assemblyConstituencyId
  );
  if (typeof wildcardLocation?.max === 'number') return wildcardLocation.max;

  const wildcardDesignation = rules.find((r) => String(r?.designationId || '') === input.designationId && !r?.level);
  if (typeof wildcardDesignation?.max === 'number') return wildcardDesignation.max;

  return defaultMax;
}

/**
 * @swagger
 * tags:
 *   - name: Reporters
 *     description: Reporter hierarchy & roles
 */

/**
 * @swagger
 * /reporters:
 *   get:
 *     summary: List reporters with filters (legacy global scope)
 *     tags: [Reporters]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *       - in: query
 *         name: stateId
 *         schema: { type: string }
 *       - in: query
 *         name: districtId
 *         schema: { type: string }
 *       - in: query
 *         name: mandalId
 *         schema: { type: string }
 *       - in: query
 *         name: assemblyConstituencyId
 *         schema: { type: string }
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Filtered reporters
 */
router.get('/', async (req, res) => {
  const { tenantId, level, stateId, districtId, mandalId, assemblyConstituencyId } = req.query as Record<string, string>;
  const activeRaw = req.query.active;
  const where: any = {};
  if (tenantId) where.tenantId = tenantId;
  if (level) where.level = level;
  if (stateId) where.stateId = stateId;
  if (districtId) where.districtId = districtId;
  if (mandalId) where.mandalId = mandalId;
  if (assemblyConstituencyId) where.assemblyConstituencyId = assemblyConstituencyId;
  if (typeof activeRaw !== 'undefined') where.active = String(activeRaw).toLowerCase() === 'true';
  const reporters = await (prisma as any).reporter.findMany({ where, orderBy: { createdAt: 'desc' }, include: includeReporterContact });
  res.json(reporters.map(mapReporterContact));
});

/**
 * @swagger
 * /reporters/{id}:
 *   get:
 *     summary: Get single reporter
 *     tags: [Reporters]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Reporter }
 *       404: { description: Not found }
 */
router.get('/:id', async (req, res) => {
  const r = await (prisma as any).reporter.findUnique({ where: { id: req.params.id }, include: includeReporterContact });
  if (!r) return res.status(404).json({ error: 'Reporter not found' });
  res.json(mapReporterContact(r));
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card:
 *   post:
 *     summary: Generate or fetch reporter ID card (number + validity)
 *     description: |
 *       Generates a Reporter ID card for the given reporter using per-tenant ID card settings
 *       (prefix, digit length, validity rules). If a card already exists, it simply returns it.
 *       
 *       **Access Control:**
 *       - Reporter can generate their OWN ID card only
 *       - Tenant Admin/Super Admin can generate ID cards for any reporter in their tenant
 *       
 *       **Prerequisites:**
 *       - Profile photo is required
 *       - If idCardCharge > 0: Onboarding payment must be PAID
 *       - If subscriptionActive: Current month subscription must be PAID
 *     tags: [ID Cards]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         example: "cmk7e7tg401ezlp22wkz5rxky"
 *       - in: path
 *         name: id
 *         description: Reporter id
 *         required: true
 *         schema: { type: string }
 *         example: "cmk8abc123reporter456"
 *     responses:
 *       201:
 *         description: Reporter ID card created or returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, example: "cmkabc123idcard456" }
 *                 reporterId: { type: string, example: "cmk8abc123reporter456" }
 *                 cardNumber: { type: string, example: "KM202601000123" }
 *                 issuedAt: { type: string, format: date-time, example: "2026-01-30T10:30:00.000Z" }
 *                 expiresAt: { type: string, format: date-time, example: "2027-01-30T10:30:00.000Z" }
 *                 pdfUrl: { type: string, nullable: true, example: null }
 *             example:
 *               id: "cmkabc123idcard456"
 *               reporterId: "cmk8abc123reporter456"
 *               cardNumber: "KM202601000123"
 *               issuedAt: "2026-01-30T10:30:00.000Z"
 *               expiresAt: "2027-01-30T10:30:00.000Z"
 *               pdfUrl: null
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid request"
 *       401:
 *         description: Unauthorized - JWT token required
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized"
 *       403:
 *         description: Forbidden - not authorized or prerequisites not met
 *         content:
 *           application/json:
 *             examples:
 *               notAuthorized:
 *                 summary: Not authorized
 *                 value:
 *                   error: "Not authorized to generate ID card for this reporter"
 *                   details: "Only the reporter themselves or tenant admin can generate ID cards"
 *               noPhoto:
 *                 summary: No profile photo
 *                 value:
 *                   error: "Profile photo is required to generate ID card"
 *               paymentRequired:
 *                 summary: Payment required
 *                 value:
 *                   error: "Onboarding payment must be PAID to generate ID card"
 *       404:
 *         description: Reporter or settings not found
 *         content:
 *           application/json:
 *             examples:
 *               reporterNotFound:
 *                 value:
 *                   error: "Reporter not found"
 *               settingsNotFound:
 *                 value:
 *                   error: "Tenant ID card settings not configured"
 */
router.post('/tenants/:tenantId/reporters/:id/id-card', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const user = req.user as any;

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id, tenantId },
      include: { idCard: true }
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    // Access Control: Check if user can generate this ID card
    const userRole = user?.role?.name?.toUpperCase() || '';
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
    const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'ADMIN';
    const isReporter = userRole === 'REPORTER';
    
    // Check if user is the reporter themselves
    const isOwnReporter = reporter.userId && reporter.userId === user?.id;
    
    // Check if user is admin of this tenant
    let isAdminOfTenant = isSuperAdmin;
    if (!isAdminOfTenant && isTenantAdmin) {
      // Check if admin belongs to this tenant
      const adminReporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id, tenantId },
        select: { id: true }
      }).catch(() => null);
      isAdminOfTenant = !!adminReporter;
    }
    
    // Allow if: super admin, tenant admin of this tenant, or reporter generating their own card
    if (!isSuperAdmin && !isAdminOfTenant && !(isReporter && isOwnReporter)) {
      return res.status(403).json({ 
        error: 'Not authorized to generate ID card for this reporter',
        details: 'Only the reporter themselves or tenant admin can generate ID cards'
      });
    }

    if (reporter.idCard) {
      return res.status(201).json(reporter.idCard);
    }

    // Generation pre-conditions
    // Note: KYC is NOT mandatory for ID card generation.
    // Require a profile photo, then enforce payment rules.

    // Require profile photo (either Reporter.profilePhotoUrl or UserProfile.profilePhotoUrl)
    let hasPhoto = !!reporter.profilePhotoUrl;
    if (!hasPhoto && reporter.userId) {
      const profile = await (prisma as any).userProfile.findUnique({ where: { userId: reporter.userId }, select: { profilePhotoUrl: true } }).catch(() => null);
      hasPhoto = !!profile?.profilePhotoUrl;
    }
    if (!hasPhoto) {
      return res.status(403).json({ error: 'Profile photo is required to generate ID card' });
    }

    // Payment requirements
    // - If idCardCharge > 0: onboarding payment must be PAID
    // - If subscriptionActive=true: current month subscription payment must be PAID
    if (typeof reporter.idCardCharge === 'number' && reporter.idCardCharge > 0) {
      const onboardingPaid = await (prisma as any).reporterPayment.findFirst({
        where: { tenantId, reporterId: reporter.id, type: 'ONBOARDING', status: 'PAID' },
        select: { id: true },
      });
      if (!onboardingPaid) {
        return res.status(403).json({ error: 'Onboarding payment must be PAID to generate ID card' });
      }
    }

    if (reporter.subscriptionActive) {
      // Use Asia/Kolkata month/year to avoid UTC month boundary issues
      const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' });
      const parts = fmt.formatToParts(new Date());
      const istYear = Number(parts.find(p => p.type === 'year')?.value);
      const istMonth = Number(parts.find(p => p.type === 'month')?.value);

      // Fallback to UTC if parsing fails
      const now = new Date();
      const utcYear = now.getUTCFullYear();
      const utcMonth = now.getUTCMonth() + 1; // 1-12

      const monthlyPaid = await (prisma as any).reporterPayment.findFirst({
        where: {
          tenantId,
          reporterId: reporter.id,
          type: 'MONTHLY_SUBSCRIPTION',
          status: 'PAID',
          OR: [
            { year: istYear || utcYear, month: istMonth || utcMonth },
            { year: utcYear, month: utcMonth },
          ],
        },
        select: { id: true },
      });
      if (!monthlyPaid) {
        return res.status(403).json({ error: 'Subscription payment must be PAID for current month to generate ID card' });
      }
    }

    const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId } });
    if (!settings) return res.status(404).json({ error: 'Tenant ID card settings not configured' });

    const prefix: string = settings.idPrefix || 'ID';
    const digits: number = settings.idDigits || 6;

    const buildCardNumber = (n: number) => `${prefix}${String(n).padStart(digits, '0')}`;

    const existingCount = await (prisma as any).reporterIDCard.count({
      where: { reporter: { tenantId } }
    });
    const startNumber = existingCount + 1;

    const issuedAt = new Date();
    let expiresAt: Date;
    if (settings.validityType === 'FIXED_END_DATE' && settings.fixedValidUntil) {
      expiresAt = new Date(settings.fixedValidUntil);
    } else {
      const days = settings.validityDays && settings.validityDays > 0 ? settings.validityDays : 365;
      expiresAt = new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);
    }

    // Determine pdfUrl based on configuration
    let initialPdfUrl: string | null = null;
    if (!isBunnyCdnConfigured()) {
      // If Bunny CDN is not configured, use dynamic PDF endpoint
      const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
      initialPdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}&forceRender=true`;
    }
    // If Bunny CDN is configured, pdfUrl will be updated after async upload completes

    let idCard: any = null;
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = buildCardNumber(startNumber + attempt);
      try {
        idCard = await (prisma as any).reporterIDCard.create({
          data: {
            reporterId: reporter.id,
            cardNumber: candidate,
            issuedAt,
            expiresAt,
            pdfUrl: initialPdfUrl
          }
        });
        break;
      } catch (e: any) {
        if (e?.code === 'P2002' && Array.isArray(e?.meta?.target) && e.meta.target.includes('cardNumber')) {
          continue;
        }
        throw e;
      }
    }

    if (!idCard) {
      return res.status(409).json({ error: 'Failed to allocate unique ID card number. Please retry.' });
    }

    // Generate PDF and upload to Bunny CDN (async, don't block response)
    if (isBunnyCdnConfigured()) {
      generateAndUploadIdCardPdf(reporter.id).then(result => {
        if (result.ok) {
          console.log(`[ID Card] PDF generated and uploaded: ${result.pdfUrl}`);
          // Send WhatsApp with Bunny CDN URL
          sendIdCardViaWhatsApp({
            reporterId: reporter.id,
            tenantId,
            pdfUrl: result.pdfUrl!,
            cardNumber: idCard.cardNumber,
          }).then(waResult => {
            if (waResult.ok) {
              console.log(`[ID Card] Auto-sent via WhatsApp to reporter ${reporter.id}, messageId: ${waResult.messageId}`);
            } else {
              console.error(`[ID Card] Auto-send WhatsApp failed:`, waResult.error);
            }
          }).catch(e => console.error('[ID Card] Auto-send WhatsApp error:', e));
        } else {
          console.error(`[ID Card] PDF generation failed:`, result.error);
        }
      }).catch(e => console.error('[ID Card] PDF generation error:', e));
    } else {
      // Fallback: Send WhatsApp with dynamic PDF URL
      sendIdCardViaWhatsApp({
        reporterId: reporter.id,
        tenantId,
        pdfUrl: initialPdfUrl!,
        cardNumber: idCard.cardNumber,
      }).then(result => {
        if (result.ok) {
          console.log(`[ID Card] Auto-sent via WhatsApp to reporter ${reporter.id}, messageId: ${result.messageId}`);
        } else {
          console.error(`[ID Card] Auto-send WhatsApp failed for reporter ${reporter.id}:`, result.error);
        }
      }).catch(e => console.error('[ID Card] Auto-send WhatsApp error:', e));
    }

    // Return clean response
    res.status(201).json({
      id: idCard.id,
      reporterId: idCard.reporterId,
      cardNumber: idCard.cardNumber,
      issuedAt: idCard.issuedAt,
      expiresAt: idCard.expiresAt,
      pdfUrl: idCard.pdfUrl,
      createdAt: idCard.createdAt,
      updatedAt: idCard.updatedAt,
      message: 'ID card generated successfully'
    });
  } catch (e) {
    console.error('generate reporter id-card error', e);
    res.status(500).json({ error: 'Failed to generate reporter ID card' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card/regenerate:
 *   post:
 *     summary: Regenerate reporter ID card (Admin only)
 *     description: |
 *       Deletes existing ID card and generates a new one. Use this when something went wrong 
 *       with the original ID card (wrong photo, wrong data, expired settings, etc.)
 *       
 *       **Access Control:**
 *       - Only Tenant Admin or Super Admin can regenerate ID cards
 *       - Reporters CANNOT regenerate their own ID cards (must contact admin)
 *       
 *       **Options:**
 *       - `keepCardNumber: true` - Keeps the same card number (useful for corrections)
 *       - `keepCardNumber: false` - Generates a new card number (default)
 *     tags: [ID Cards]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         example: "cmk7e7tg401ezlp22wkz5rxky"
 *       - in: path
 *         name: id
 *         description: Reporter id
 *         required: true
 *         schema: { type: string }
 *         example: "cmk8abc123reporter456"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for regeneration (for audit trail)
 *               keepCardNumber:
 *                 type: boolean
 *                 description: If true, keeps the same card number; if false (default), generates new number
 *                 default: false
 *           examples:
 *             photoCorrection:
 *               summary: Photo was wrong - keep same card number
 *               value:
 *                 reason: "Reporter uploaded wrong photo, now corrected"
 *                 keepCardNumber: true
 *             newCard:
 *               summary: Generate completely new card
 *               value:
 *                 reason: "Card was lost, issuing replacement"
 *                 keepCardNumber: false
 *             simple:
 *               summary: Simple regeneration
 *               value:
 *                 reason: "Validity period was incorrect"
 *     responses:
 *       200:
 *         description: ID card regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, example: "cmknew123idcard789" }
 *                 reporterId: { type: string, example: "cmk8abc123reporter456" }
 *                 cardNumber: { type: string, example: "PA0001" }
 *                 issuedAt: { type: string, format: date-time, example: "2026-02-05T21:30:39.601Z" }
 *                 expiresAt: { type: string, format: date-time, example: "2027-02-05T21:30:39.601Z" }
 *                 pdfUrl: 
 *                   type: string
 *                   nullable: true
 *                   description: |
 *                     PDF URL depends on Bunny CDN configuration:
 *                     - If Bunny CDN configured: Static CDN URL (e.g., https://kaburlu-news.b-cdn.net/id-cards/xxx.pdf)
 *                     - If NOT configured: Dynamic endpoint URL (e.g., https://api.kaburlumedia.com/api/v1/id-cards/pdf?reporterId=xxx&forceRender=true)
 *                   example: "https://prashnaayudham.com/api/v1/id-cards/pdf?reporterId=cml54silw009bbzyjen9g7qf8&forceRender=true"
 *                 createdAt: { type: string, format: date-time, example: "2026-02-05T21:30:39.602Z" }
 *                 updatedAt: { type: string, format: date-time, example: "2026-02-05T21:30:39.602Z" }
 *                 previousCardNumber: { type: string, nullable: true, example: "PA0001" }
 *                 reason: { type: string, nullable: true, example: "Reporter uploaded wrong photo, now corrected" }
 *                 message: { type: string, example: "ID card regenerated successfully" }
 *             examples:
 *               withBunnyCdn:
 *                 summary: Response with Bunny CDN (local dev)
 *                 value:
 *                   id: "cml9z18jw01f2jybhlfragi39"
 *                   reporterId: "cml54silw009bbzyjen9g7qf8"
 *                   cardNumber: "PA0001"
 *                   issuedAt: "2026-02-05T21:31:19.052Z"
 *                   expiresAt: "2027-02-05T21:31:19.052Z"
 *                   pdfUrl: "https://kaburlu-news.b-cdn.net/id-cards/cml54silw009bbzyjen9g7qf8_PA0001_1770327082491.pdf"
 *                   createdAt: "2026-02-05T21:31:19.053Z"
 *                   updatedAt: "2026-02-05T21:31:19.053Z"
 *                   previousCardNumber: "PA0001"
 *                   reason: "Reporter uploaded wrong photo, now corrected"
 *                   message: "ID card regenerated successfully"
 *               withoutBunnyCdn:
 *                 summary: Response without Bunny CDN (production)
 *                 value:
 *                   id: "cml9z0e4101f4bzbzylqj60jv"
 *                   reporterId: "cml54silw009bbzyjen9g7qf8"
 *                   cardNumber: "PA0001"
 *                   issuedAt: "2026-02-05T21:30:39.601Z"
 *                   expiresAt: "2027-02-05T21:30:39.601Z"
 *                   pdfUrl: "https://prashnaayudham.com/api/v1/id-cards/pdf?reporterId=cml54silw009bbzyjen9g7qf8&forceRender=true"
 *                   createdAt: "2026-02-05T21:30:39.602Z"
 *                   updatedAt: "2026-02-05T21:30:39.602Z"
 *                   previousCardNumber: "PA0001"
 *                   reason: "Reporter uploaded wrong photo, now corrected"
 *                   message: "ID card regenerated successfully"
 *       401:
 *         description: Unauthorized - JWT token required
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized"
 *       403:
 *         description: Forbidden - Only admin can regenerate
 *         content:
 *           application/json:
 *             examples:
 *               notAdmin:
 *                 summary: Reporter trying to regenerate
 *                 value:
 *                   error: "Only admin can regenerate ID cards"
 *                   details: "Reporters cannot regenerate their own ID cards. Contact your tenant admin."
 *               noPhoto:
 *                 summary: No profile photo
 *                 value:
 *                   error: "Profile photo is required to generate ID card"
 *       404:
 *         description: Reporter or settings not found
 *         content:
 *           application/json:
 *             examples:
 *               reporterNotFound:
 *                 value:
 *                   error: "Reporter not found"
 *               settingsNotFound:
 *                 value:
 *                   error: "Tenant ID card settings not configured"
 */
router.post('/tenants/:tenantId/reporters/:id/id-card/regenerate', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const user = req.user as any;
    const body = req.body || {};
    const keepCardNumber = body.keepCardNumber === true;
    const reason = String(body.reason || '').trim();

    // Fetch reporter first for ownership check
    const reporter = await (prisma as any).reporter.findFirst({
      where: { id, tenantId },
      include: { idCard: true }
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    // Access Control: Admin or own reporter can regenerate
    const userRole = user?.role?.name?.toUpperCase() || '';
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
    const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'ADMIN';
    const isReporter = userRole === 'REPORTER';
    const isOwnReporter = isReporter && reporter.userId && reporter.userId === user?.id;
    
    let isAdminOfTenant = isSuperAdmin;
    if (!isAdminOfTenant && isTenantAdmin) {
      const adminReporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id, tenantId },
        select: { id: true }
      }).catch(() => null);
      isAdminOfTenant = !!adminReporter;
    }
    
    // Allow if: super admin, tenant admin of this tenant, or reporter regenerating own card
    if (!isSuperAdmin && !isAdminOfTenant && !isOwnReporter) {
      return res.status(403).json({ 
        error: 'Not authorized to regenerate ID card',
        details: 'Only the reporter themselves or tenant admin can regenerate ID cards'
      });
    }

    const previousCardNumber = reporter.idCard?.cardNumber || null;

    // Delete existing ID card if present
    if (reporter.idCard) {
      await (prisma as any).reporterIDCard.delete({
        where: { id: reporter.idCard.id }
      });
    }

    // Require profile photo
    let hasPhoto = !!reporter.profilePhotoUrl;
    if (!hasPhoto && reporter.userId) {
      const profile = await (prisma as any).userProfile.findUnique({ where: { userId: reporter.userId }, select: { profilePhotoUrl: true } }).catch(() => null);
      hasPhoto = !!profile?.profilePhotoUrl;
    }
    if (!hasPhoto) {
      return res.status(403).json({ error: 'Profile photo is required to generate ID card' });
    }

    const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId } });
    if (!settings) return res.status(404).json({ error: 'Tenant ID card settings not configured' });

    const prefix: string = settings.idPrefix || 'ID';
    const digits: number = settings.idDigits || 6;
    const buildCardNumber = (n: number) => `${prefix}${String(n).padStart(digits, '0')}`;

    const requestedCardNumber = keepCardNumber && previousCardNumber ? previousCardNumber : null;
    const existingCount = await (prisma as any).reporterIDCard.count({
      where: { reporter: { tenantId } }
    });
    const startNumber = existingCount + 1;

    const issuedAt = new Date();
    let expiresAt: Date;
    if (settings.validityType === 'FIXED_END_DATE' && settings.fixedValidUntil) {
      expiresAt = new Date(settings.fixedValidUntil);
    } else {
      const days = settings.validityDays && settings.validityDays > 0 ? settings.validityDays : 365;
      expiresAt = new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);
    }

    // Determine pdfUrl based on configuration
    let initialPdfUrl: string | null = null;
    if (!isBunnyCdnConfigured()) {
      // If Bunny CDN is not configured, use dynamic PDF endpoint
      const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
      initialPdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}&forceRender=true`;
    }
    // If Bunny CDN is configured, pdfUrl will be updated after async upload completes

    let newIdCard: any = null;
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = requestedCardNumber || buildCardNumber(startNumber + attempt);
      try {
        newIdCard = await (prisma as any).reporterIDCard.create({
          data: {
            reporterId: reporter.id,
            cardNumber: candidate,
            issuedAt,
            expiresAt,
            pdfUrl: initialPdfUrl
          }
        });
        break;
      } catch (e: any) {
        if (requestedCardNumber && e?.code === 'P2002' && Array.isArray(e?.meta?.target) && e.meta.target.includes('cardNumber')) {
          return res.status(409).json({ error: 'Requested card number is already in use', cardNumber: requestedCardNumber });
        }
        if (e?.code === 'P2002' && Array.isArray(e?.meta?.target) && e.meta.target.includes('cardNumber')) {
          continue;
        }
        throw e;
      }
    }

    if (!newIdCard) {
      return res.status(409).json({ error: 'Failed to allocate unique ID card number. Please retry.' });
    }

    console.log(`ID Card regenerated: reporterId=${reporter.id}, previousCard=${previousCardNumber}, newCard=${newIdCard.cardNumber}, by=${user?.id}, reason=${reason}`);

    // Generate PDF and upload to Bunny CDN (async, don't block response)
    if (isBunnyCdnConfigured()) {
      generateAndUploadIdCardPdf(reporter.id).then(result => {
        if (result.ok) {
          console.log(`[ID Card] Regenerate - PDF uploaded: ${result.pdfUrl}`);
          // Send WhatsApp with Bunny CDN URL
          sendIdCardViaWhatsApp({
            reporterId: reporter.id,
            tenantId,
            pdfUrl: result.pdfUrl!,
            cardNumber: newIdCard.cardNumber,
          }).then(waResult => {
            if (waResult.ok) {
              console.log(`[ID Card] Regenerate - sent via WhatsApp, messageId: ${waResult.messageId}`);
            } else {
              console.error(`[ID Card] Regenerate - WhatsApp failed:`, waResult.error);
            }
          }).catch(e => console.error('[ID Card] Regenerate - WhatsApp error:', e));
        } else {
          console.error(`[ID Card] Regenerate - PDF generation failed:`, result.error);
        }
      }).catch(e => console.error('[ID Card] Regenerate - PDF error:', e));
    } else {
      // Fallback: Send WhatsApp with dynamic PDF URL
      sendIdCardViaWhatsApp({
        reporterId: reporter.id,
        tenantId,
        pdfUrl: initialPdfUrl!,
        cardNumber: newIdCard.cardNumber,
      }).then(result => {
        if (result.ok) {
          console.log(`[ID Card] Regenerate - sent via WhatsApp to reporter ${reporter.id}, messageId: ${result.messageId}`);
        } else {
          console.error(`[ID Card] Regenerate - WhatsApp send failed for reporter ${reporter.id}:`, result.error);
        }
      }).catch(e => console.error('[ID Card] Regenerate - WhatsApp error:', e));
    }

    // Return clean response matching production format
    res.status(200).json({
      id: newIdCard.id,
      reporterId: newIdCard.reporterId,
      cardNumber: newIdCard.cardNumber,
      issuedAt: newIdCard.issuedAt,
      expiresAt: newIdCard.expiresAt,
      pdfUrl: newIdCard.pdfUrl,
      createdAt: newIdCard.createdAt,
      updatedAt: newIdCard.updatedAt,
      previousCardNumber,
      reason: reason || null,
      message: 'ID card regenerated successfully'
    });
  } catch (e) {
    console.error('regenerate reporter id-card error', e);
    res.status(500).json({ error: 'Failed to regenerate reporter ID card' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card/resend:
 *   post:
 *     summary: Resend reporter ID card PDF via WhatsApp
 *     description: |
 *       Resends the existing ID card PDF to the reporter's registered mobile number via WhatsApp.
 *       The ID card must already be generated and have a valid PDF URL.
 *       
 *       **Access Control:**
 *       - Super Admin: Can resend for any reporter
 *       - Tenant Admin: Can resend for reporters in their tenant
 *       - Reporter: Can resend their own ID card
 *     tags: [ID Cards]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Reporter ID
 *     responses:
 *       200:
 *         description: WhatsApp message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 messageId: { type: string }
 *                 sentTo: { type: string }
 *             example:
 *               success: true
 *               message: "ID card PDF sent via WhatsApp"
 *               messageId: "wamid.xxx"
 *               sentTo: "91XXXXXXXXXX"
 *       400:
 *         description: ID card not found or PDF not generated
 *         content:
 *           application/json:
 *             examples:
 *               noIdCard:
 *                 value:
 *                   error: "ID card not found. Please generate it first."
 *               noPdf:
 *                 value:
 *                   error: "ID card PDF not generated yet"
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Reporter not found
 */
router.post('/tenants/:tenantId/reporters/:id/id-card/resend', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const user = req.user as any;
    const forceRegenerate =
      String((req.query as any)?.forceRegenerate ?? (req.body as any)?.forceRegenerate ?? 'false').toLowerCase() === 'true';

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id, tenantId },
      include: {
        idCard: true,
        user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
      },
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    // Access Control
    const userRole = user?.role?.name?.toUpperCase() || '';
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
    const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'ADMIN';
    const isOwnReporter = reporter.userId && reporter.userId === user?.id;

    let isAdminOfTenant = isSuperAdmin;
    if (!isAdminOfTenant && isTenantAdmin) {
      const adminReporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id, tenantId },
        select: { id: true },
      }).catch(() => null);
      isAdminOfTenant = !!adminReporter;
    }

    if (!isSuperAdmin && !isAdminOfTenant && !isOwnReporter) {
      return res.status(403).json({
        error: 'Not authorized to resend ID card for this reporter',
      });
    }

    // Check if ID card exists
    if (!reporter.idCard) {
      return res.status(400).json({ error: 'ID card not found. Please generate it first.' });
    }

    // Check if mobile number exists
    if (!reporter.user?.mobileNumber) {
      return res.status(400).json({ error: 'Reporter mobile number not found' });
    }

    // Get PDF URL - either from DB or generate on demand
    let pdfUrl = reporter.idCard.pdfUrl;

    if (forceRegenerate) {
      if (isBunnyCdnConfigured()) {
        console.log(`[ID Card Resend] forceRegenerate=true; generating new PDF for reporter ${reporter.id}`);
        const genResult = await generateAndUploadIdCardPdf(reporter.id);
        if (genResult.ok && genResult.pdfUrl) {
          pdfUrl = genResult.pdfUrl;
          console.log(`[ID Card Resend] Generated PDF (forced): ${pdfUrl}`);
        } else {
          console.error(`[ID Card Resend] Forced PDF generation failed:`, genResult.error);
          const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
          pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}&forceRender=true&ts=${Date.now()}`;
        }
      } else {
        const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
        pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}&forceRender=true&ts=${Date.now()}`;
      }
    }
    
    if (!pdfUrl) {
      // PDF not in DB - try to generate and upload now
      if (isBunnyCdnConfigured()) {
        console.log(`[ID Card Resend] No pdfUrl found, generating for reporter ${reporter.id}`);
        const genResult = await generateAndUploadIdCardPdf(reporter.id);
        if (genResult.ok && genResult.pdfUrl) {
          pdfUrl = genResult.pdfUrl;
          console.log(`[ID Card Resend] Generated PDF: ${pdfUrl}`);
        } else {
          console.error(`[ID Card Resend] PDF generation failed:`, genResult.error);
          // Fallback to dynamic URL
          const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
          pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}&forceRender=true&ts=${Date.now()}`;
        }
      } else {
        // Fallback to dynamic URL
        const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
        pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}&forceRender=true&ts=${Date.now()}`;
      }
    }

    // Send via WhatsApp
    const result = await sendIdCardViaWhatsApp({
      reporterId: reporter.id,
      tenantId,
      pdfUrl,
      cardNumber: reporter.idCard.cardNumber,
    });

    if (result.ok) {
      return res.json({
        success: true,
        message: 'ID card PDF sent via WhatsApp',
        messageId: result.messageId,
        sentTo: reporter.user.mobileNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1******$3'), // Mask middle digits
      });
    } else {
      return res.status(500).json({
        error: 'Failed to send WhatsApp message',
        details: result.error,
      });
    }
  } catch (e: any) {
    console.error('resend reporter id-card error', e);
    res.status(500).json({ error: 'Failed to resend reporter ID card' });
  }
});

/**
 * @swagger
 * /reporters:
 *   post:
 *     summary: Create reporter (admin/manual - prefer /reporters/register for combined user creation)
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId, level]
 *             properties:
 *               tenantId: { type: string }
 *               userId: { type: string, description: 'Existing user id (role REPORTER)' }
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *               designationCode: { type: string, description: 'Optional designation code to resolve' }
 *               designationId: { type: string }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               mandalId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *               subscriptionActive: { type: boolean }
 *               monthlySubscriptionAmount: { type: integer }
 *               idCardCharge: { type: integer }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 */
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const body = req.body || {};
    const { tenantId, level } = body;
    if (!tenantId || !level) return res.status(400).json({ error: 'tenantId and level required' });
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(400).json({ error: 'Invalid tenantId' });
    let designationId = body.designationId || null;
    if (!designationId && body.designationCode) {
      const dTenant = await (prisma as any).reporterDesignation.findFirst({ where: { tenantId, code: body.designationCode } });
      const dGlobal = !dTenant ? await (prisma as any).reporterDesignation.findFirst({ where: { tenantId: null, code: body.designationCode } }) : null;
      designationId = (dTenant || dGlobal)?.id || null;
      if (!designationId) return res.status(400).json({ error: 'Unknown designationCode' });
    }

    // Enforce per-tenant limits (if configured) when designationId is provided.
    // This prevents tenant admins/reporters from bypassing the availability rules.
    const lvl = String(level) as ReporterLevelInput;
    if (designationId && ['STATE', 'DISTRICT', 'MANDAL', 'ASSEMBLY'].includes(lvl)) {
      const locationKey = getLocationKeyFromLevel(lvl, body);
      if (locationKey.id) {
        const designation = await (prisma as any).reporterDesignation
          .findFirst({ where: { id: String(designationId) }, select: { id: true, tenantId: true, level: true } })
          .catch(() => null);
        if (designation?.id) {
          if (designation.tenantId && String(designation.tenantId) !== String(tenantId)) {
            return res.status(400).json({ error: 'designationId does not belong to this tenant' });
          }
          if (String(designation.level) !== lvl) {
            return res.status(400).json({ error: 'designationId does not match requested level' });
          }

          const tenantSettingsRow = await (prisma as any).tenantSettings
            .findUnique({ where: { tenantId }, select: { data: true } })
            .catch(() => null);
          const maxAllowed = pickReporterLimitMax((tenantSettingsRow as any)?.data, {
            designationId: String(designationId),
            level: lvl,
            location: locationKey,
          });
          if (typeof maxAllowed === 'number') {
            const where: any = { tenantId, active: true, designationId: String(designationId), level: lvl };
            where[locationKey.field] = locationKey.id;
            const current = await (prisma as any).reporter.count({ where }).catch(() => 0);
            if (current >= maxAllowed) {
              return res.status(409).json({
                error: 'Reporter limit reached',
                maxAllowed,
                current,
                designationId: String(designationId),
                level: lvl,
                [locationKey.field]: locationKey.id,
              });
            }
          }
        }
      }
    }

    const data: any = {
      tenantId,
      level,
      userId: body.userId || null,
      designationId,
      stateId: body.stateId || null,
      districtId: body.districtId || null,
      mandalId: body.mandalId || null,
      assemblyConstituencyId: body.assemblyConstituencyId || null,
      subscriptionActive: !!body.subscriptionActive,
      monthlySubscriptionAmount: typeof body.monthlySubscriptionAmount === 'number' ? body.monthlySubscriptionAmount : null,
      idCardCharge: typeof body.idCardCharge === 'number' ? body.idCardCharge : null,
      // KYC intentionally excluded from direct creation; default PENDING
    };
    if (level === 'STATE' && !data.stateId) return res.status(400).json({ error: 'stateId required for STATE level' });
    if (level === 'DISTRICT' && !data.districtId) return res.status(400).json({ error: 'districtId required for DISTRICT level' });
    if (level === 'MANDAL' && !data.mandalId) return res.status(400).json({ error: 'mandalId required for MANDAL level' });
    if (level === 'ASSEMBLY' && !data.assemblyConstituencyId) return res.status(400).json({ error: 'assemblyConstituencyId required for ASSEMBLY level' });
    const created = await (prisma as any).reporter.create({ data, include: includeReporterContact });
    res.status(201).json(mapReporterContact(created));
  } catch (e: any) {
    console.error('create reporter error', e);
    res.status(500).json({ error: 'Failed to create reporter' });
  }
});

/**
 * @swagger
 * /reporters/{id}:
 *   patch:
 *     summary: Update reporter
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               designationId: { type: string }
 *               designationCode: { type: string }
 *               active: { type: boolean }
 *               subscriptionActive: { type: boolean }
 *               monthlySubscriptionAmount: { type: integer }
 *               idCardCharge: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.patch('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).reporter.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Reporter not found' });
    let designationId = req.body.designationId || existing.designationId;
    if (!designationId && req.body.designationCode) {
      const dTenant = await (prisma as any).reporterDesignation.findFirst({ where: { tenantId: existing.tenantId, code: req.body.designationCode } });
      const dGlobal = !dTenant ? await (prisma as any).reporterDesignation.findFirst({ where: { tenantId: null, code: req.body.designationCode } }) : null;
      designationId = (dTenant || dGlobal)?.id || designationId;
      if (!designationId) return res.status(400).json({ error: 'Unknown designationCode' });
    }
    const updated = await (prisma as any).reporter.update({
      where: { id },
      data: {
        designationId,
        active: typeof req.body.active === 'boolean' ? req.body.active : existing.active,
        subscriptionActive: typeof req.body.subscriptionActive === 'boolean' ? req.body.subscriptionActive : existing.subscriptionActive,
        monthlySubscriptionAmount: typeof req.body.monthlySubscriptionAmount === 'number' ? req.body.monthlySubscriptionAmount : existing.monthlySubscriptionAmount,
        idCardCharge: typeof req.body.idCardCharge === 'number' ? req.body.idCardCharge : existing.idCardCharge,
        // KYC modifications blocked in generic patch
      },
      include: includeReporterContact
    });
    res.json(mapReporterContact(updated));
  } catch (e: any) {
    console.error('update reporter error', e);
    res.status(500).json({ error: 'Failed to update reporter' });
  }
});

/**
 * @swagger
 * /reporters/{id}:
 *   delete:
 *     summary: Soft deactivate reporter
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deactivated }
 *       404: { description: Not found }
 */
router.delete('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).reporter.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Reporter not found' });
    const updated = await (prisma as any).reporter.update({ where: { id }, data: { active: false }, include: includeReporterContact });
    res.json({ success: true, reporter: mapReporterContact(updated) });
  } catch (e: any) {
    console.error('deactivate reporter error', e);
    res.status(500).json({ error: 'Failed to deactivate reporter' });
  }
});

/**
 * @swagger
 * /reporter-designations:
 *   get:
 *     summary: List reporter designations (global or tenant)
 *     tags: [Reporters]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL, VILLAGE] }
 *     responses:
 *       200: { description: List }
 */
// Global reporter designations (shared by all tenants).
router.get('/designations', async (req, res) => {
  const { level } = req.query as Record<string, string>;
  const whereGlobal: any = { tenantId: null };
  if (level) whereGlobal.level = level;
  const global = await (prisma as any).reporterDesignation.findMany({ where: whereGlobal });
  const filtered = (global as any[]).filter((r: any) => String(r?.code || '').trim().toUpperCase() !== 'TENANT_ADMIN');
  return res.json(filtered.sort((a: any, b: any) => String(a.level).localeCompare(String(b.level))));
});

/**
 * @swagger
 * /reporter-designations:
 *   post:
 *     summary: Create reporter designation
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [level, code, name]
 *             properties:
 *               tenantId: { type: string }
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL, VILLAGE] }
 *               code: { type: string }
 *               name: { type: string }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 */
router.post('/designations', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const authUser: any = (req as any).user;
    const roleName = String(authUser?.role?.name || '');
    if (roleName !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });

    const { tenantId, level, code, name } = req.body || {};
    if (!level || !code || !name) return res.status(400).json({ error: 'level, code, name required' });
    if (tenantId) return res.status(400).json({ error: 'tenantId is not allowed; designations are global' });

    if (String(code).trim().toUpperCase() === 'TENANT_ADMIN') {
      return res.status(400).json({ error: 'TENANT_ADMIN designation cannot be created' });
    }

    const created = await (prisma as any).reporterDesignation.create({ data: { tenantId: null, level, code, name } });
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Designation code already exists for tenant' });
    console.error('create designation error', e);
    res.status(500).json({ error: 'Failed to create designation' });
  }
});

/**
 * @swagger
 * /reporter-designations/{id}:
 *   patch:
 *     summary: Update reporter designation
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.patch('/designations/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const authUser: any = (req as any).user;
    const roleName = String(authUser?.role?.name || '');
    if (roleName !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const existing = await (prisma as any).reporterDesignation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Designation not found' });
    if (existing.tenantId) return res.status(400).json({ error: 'Tenant-specific designations are disabled' });
    const updated = await (prisma as any).reporterDesignation.update({ where: { id }, data: { name: req.body.name || existing.name } });
    res.json(updated);
  } catch (e: any) {
    console.error('update designation error', e);
    res.status(500).json({ error: 'Failed to update designation' });
  }
});

/**
 * @swagger
 * /reporter-designations/{id}:
 *   delete:
 *     summary: Delete reporter designation (fails if reporters reference it)
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 *       409: { description: In use }
 */
router.delete('/designations/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const authUser: any = (req as any).user;
    const roleName = String(authUser?.role?.name || '');
    if (roleName !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const existing = await (prisma as any).reporterDesignation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Designation not found' });
    if (existing.tenantId) return res.status(400).json({ error: 'Tenant-specific designations are disabled' });

    const count = await (prisma as any).reporter.count({ where: { designationId: id } });
    if (count > 0) return res.status(409).json({ error: 'Designation in use by reporters' });
    await (prisma as any).reporterDesignation.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    console.error('delete designation error', e);
    res.status(500).json({ error: 'Failed to delete designation' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporter-designations/seed:
 *   post:
 *     summary: Seed default designations for tenant (idempotent)
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Seeded }
 *       404: { description: Tenant not found }
 */
router.post('/tenants/:tenantId/reporter-designations/seed', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    return res.status(410).json({
      error: 'Tenant-specific designation seeding is disabled. Designations are global (tenantId=null).',
      hint: 'Restart the server to run bootstrap seeding, or run npm run seed:reporter-designations',
    });
  } catch (e: any) {
    console.error('seed designations error', e);
    res.status(500).json({ error: 'Failed to seed designations' });
  }
});

export default router;

/**
 * @swagger
 * /reporters/register:
 *   post:
 *     summary: Register reporter (create user+reporter in one step)
 *     description: Creates a User (if mobile not existing) with role REPORTER (or provided roleName) and a Reporter profile. Allows skipping MPIN creation (mpin null) for later secure setup.
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId, mobileNumber, languageId]
 *             properties:
 *               tenantId: { type: string }
 *               mobileNumber: { type: string }
 *               languageId: { type: string }
 *               roleName: { type: string, description: 'Override default reporter role (default REPORTER)' }
 *               designationCode: { type: string }
 *               designationId: { type: string }
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               mandalId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *               subscriptionActive: { type: boolean }
 *               monthlySubscriptionAmount: { type: integer, description: 'Smallest currency unit (e.g. paise)' }
 *               idCardCharge: { type: integer, description: 'Smallest currency unit (e.g. paise)' }
 *               kycData: { type: object }
 *     responses:
 *       201: { description: Reporter registered }
 *       400: { description: Validation error }
 */
router.post('/register', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const body = req.body || {};
    const { tenantId, mobileNumber, languageId } = body;
    if (!tenantId || !mobileNumber || !languageId) return res.status(400).json({ error: 'tenantId, mobileNumber, languageId required' });
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(400).json({ error: 'Invalid tenantId' });

    let user = await findUserByMobileNumber(mobileNumber);
    if (!user) {
      const roleName = body.roleName || 'REPORTER';
      const role = await (prisma as any).role.findUnique({ where: { name: roleName } });
      if (!role) return res.status(400).json({ error: 'Invalid roleName' });
      user = await createUser({ mobileNumber, languageId, roleId: role.id, skipMpinDefault: true, status: 'ACTIVE' });
    }
    if (!user) return res.status(500).json({ error: 'Failed to create user' });

    let designationId = body.designationId || null;
    if (!designationId && body.designationCode) {
      const dTenant = await (prisma as any).reporterDesignation.findFirst({ where: { tenantId, code: body.designationCode } });
      const dGlobal = !dTenant ? await (prisma as any).reporterDesignation.findFirst({ where: { tenantId: null, code: body.designationCode } }) : null;
      designationId = (dTenant || dGlobal)?.id || null;
      if (!designationId) return res.status(400).json({ error: 'Unknown designationCode' });
    }

    const level = body.level || null;

    // Enforce per-tenant limits (if configured) when designation + level are provided.
    if (designationId && level && ['STATE', 'DISTRICT', 'MANDAL', 'ASSEMBLY'].includes(String(level))) {
      const lvl = String(level) as ReporterLevelInput;
      const locationKey = getLocationKeyFromLevel(lvl, body);
      if (!locationKey.id) {
        return res.status(400).json({ error: `${locationKey.field} required for ${lvl} level` });
      }

      const designation = await (prisma as any).reporterDesignation
        .findFirst({ where: { id: String(designationId) }, select: { id: true, tenantId: true, level: true } })
        .catch(() => null);
      if (!designation?.id) return res.status(400).json({ error: 'Invalid designationId' });
      if (designation.tenantId && String(designation.tenantId) !== String(tenantId)) {
        return res.status(400).json({ error: 'designationId does not belong to this tenant' });
      }
      if (String(designation.level) !== lvl) {
        return res.status(400).json({ error: 'designationId does not match requested level' });
      }

      const tenantSettingsRow = await (prisma as any).tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null);
      const maxAllowed = pickReporterLimitMax((tenantSettingsRow as any)?.data, {
        designationId: String(designationId),
        level: lvl,
        location: locationKey,
      });
      if (typeof maxAllowed === 'number') {
        const where: any = { tenantId, active: true, designationId: String(designationId), level: lvl };
        where[locationKey.field] = locationKey.id;
        const current = await (prisma as any).reporter.count({ where }).catch(() => 0);
        if (current >= maxAllowed) {
          return res.status(409).json({
            error: 'Reporter limit reached',
            maxAllowed,
            current,
            designationId: String(designationId),
            level: lvl,
            [locationKey.field]: locationKey.id,
          });
        }
      }
    }

    const reporterData: any = {
      tenantId,
      userId: user.id,
      designationId,
      level,
      stateId: body.stateId || null,
      districtId: body.districtId || null,
      mandalId: body.mandalId || null,
      assemblyConstituencyId: body.assemblyConstituencyId || null,
      subscriptionActive: !!body.subscriptionActive,
      monthlySubscriptionAmount: typeof body.monthlySubscriptionAmount === 'number' ? body.monthlySubscriptionAmount : null,
      idCardCharge: typeof body.idCardCharge === 'number' ? body.idCardCharge : null,
      kycData: body.kycData || null
    };

    if (reporterData.level === 'STATE' && !reporterData.stateId) return res.status(400).json({ error: 'stateId required for STATE level' });
    if (reporterData.level === 'DISTRICT' && !reporterData.districtId) return res.status(400).json({ error: 'districtId required for DISTRICT level' });
    if (reporterData.level === 'MANDAL' && !reporterData.mandalId) return res.status(400).json({ error: 'mandalId required for MANDAL level' });
    if (reporterData.level === 'ASSEMBLY' && !reporterData.assemblyConstituencyId) return res.status(400).json({ error: 'assemblyConstituencyId required for ASSEMBLY level' });

    const reporter = await (prisma as any).reporter.create({ data: reporterData, include: { designation: true } });
    res.status(201).json({ reporter, user });
  } catch (e: any) {
    console.error('register reporter error', e);
    res.status(500).json({ error: 'Failed to register reporter' });
  }
});
