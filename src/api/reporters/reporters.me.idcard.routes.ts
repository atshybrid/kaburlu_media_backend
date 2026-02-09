/**
 * Reporter self-service ID card endpoints (/reporters/me/id-card/*)
 * These endpoints allow REPORTER role to manage their own ID cards
 */
import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { sendWhatsappIdCardTemplate } from '../../lib/whatsapp';
import { generateAndUploadIdCardPdf, isBunnyCdnConfigured } from '../../lib/idCardPdf';

const router = Router();

async function sendIdCardViaWhatsApp(params: {
  reporterId: string;
  tenantId: string;
  pdfUrl: string;
  cardNumber: string;
}): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const reporter = await (prisma as any).reporter.findUnique({
    where: { id: params.reporterId },
    include: { 
      user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
      tenant: { select: { name: true } }
    }
  });
  if (!reporter?.user?.mobileNumber) return { ok: false, error: 'No mobile number' };

  const result = await sendWhatsappIdCardTemplate({
    toMobileNumber: reporter.user.mobileNumber,
    pdfUrl: params.pdfUrl,
    cardType: 'Reporter ID',
    organizationName: reporter.tenant?.name || 'Kaburlu Media',
    documentType: 'ID Card',
    pdfFilename: `${params.cardNumber}.pdf`,
  });
  return result;
}

/**
 * @swagger
 * /reporters/me/id-card:
 *   post:
 *     summary: Generate ID card for logged-in reporter
 *     description: |
 *       Generates an ID card for the currently logged-in reporter.
 *       
 *       **Access Control:**
 *       - REPORTER role only
 *       - Must have payment completed (if idCardCharge > 0)
 *       
 *       **Returns:**
 *       - ID card details including PDF URL and card number
 *       - PDF is automatically sent via WhatsApp
 *     tags: [Reporters]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       201:
 *         description: ID card generated
 *       200:
 *         description: ID card already exists
 *       402:
 *         description: Payment required
 *       404:
 *         description: Reporter profile not found
 */
router.post('/id-card', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    const userRole = user?.role?.name?.toUpperCase() || '';
    
    if (userRole !== 'REPORTER') {
      return res.status(403).json({ 
        error: 'Only reporters can use this endpoint',
        details: 'Use /tenants/{tenantId}/reporters/{id}/id-card for admin access'
      });
    }
    
    const reporter = await (prisma as any).reporter.findFirst({
      where: { userId: user.id },
      include: { idCard: true, tenant: true }
    });
    
    if (!reporter) {
      return res.status(404).json({ error: 'Reporter profile not found for this user' });
    }
    
    // If ID card already exists, return it
    if (reporter.idCard) {
      const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
      return res.status(200).json({
        ...reporter.idCard,
        pdfUrl: reporter.idCard.pdfUrl || `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}`,
        alreadyExists: true
      });
    }
    
    // Check payment requirements
    if (typeof reporter.idCardCharge === 'number' && reporter.idCardCharge > 0) {
      const onboardingPaid = await (prisma as any).reporterPayment.findFirst({
        where: { reporterId: reporter.id, type: 'ONBOARDING', status: 'PAID' }
      });
      if (!onboardingPaid) {
        return res.status(402).json({
          error: 'Onboarding payment required',
          code: 'PAYMENT_REQUIRED',
          details: 'ID card fee must be paid before generating ID card',
          amount: reporter.idCardCharge
        });
      }
    }
    
    // Get tenant ID card settings
    const settings = await (prisma as any).tenantIdCardSettings.findUnique({ 
      where: { tenantId: reporter.tenantId } 
    });
    if (!settings) {
      return res.status(400).json({ 
        error: 'Tenant ID card settings not configured',
        details: 'Contact your tenant admin to configure ID card settings'
      });
    }
    
    // Generate card number
    const existingCount = await (prisma as any).reporterIDCard.count({
      where: { reporter: { tenantId: reporter.tenantId } }
    });
    const prefix: string = settings.idPrefix || 'ID';
    const digits: number = settings.idDigits || 6;
    const now = new Date();
    const nextNumber = existingCount + 1;
    const padded = String(nextNumber).padStart(digits, '0');
    const cardNumber = `${prefix}${padded}`;
    
    // Calculate validity
    const issuedAt = now;
    let expiresAt: Date;
    if (settings.validityType === 'FIXED_END_DATE' && settings.fixedValidUntil) {
      expiresAt = new Date(settings.fixedValidUntil);
    } else if (typeof settings.validityDays === 'number' && settings.validityDays > 0) {
      expiresAt = new Date(issuedAt.getTime() + settings.validityDays * 24 * 60 * 60 * 1000);
    } else {
      const validityMonths = settings.validityMonths || 12;
      expiresAt = new Date(issuedAt);
      expiresAt.setMonth(expiresAt.getMonth() + validityMonths);
    }
    
    // Create ID card
    const idCard = await (prisma as any).reporterIDCard.create({
      data: {
        reporterId: reporter.id,
        cardNumber,
        issuedAt,
        expiresAt,
      }
    });
    
    // Generate PDF and send via WhatsApp (async)
    const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
    let pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}`;
    
    if (isBunnyCdnConfigured()) {
      generateAndUploadIdCardPdf(reporter.id).then(result => {
        if (result.ok && result.pdfUrl) {
          sendIdCardViaWhatsApp({
            reporterId: reporter.id,
            tenantId: reporter.tenantId,
            pdfUrl: result.pdfUrl,
            cardNumber,
          }).catch(e => console.error('[ID Card] Me generate - WhatsApp error:', e));
        }
      }).catch(e => console.error('[ID Card] Me generate - PDF error:', e));
    } else {
      sendIdCardViaWhatsApp({
        reporterId: reporter.id,
        tenantId: reporter.tenantId,
        pdfUrl,
        cardNumber,
      }).catch(e => console.error('[ID Card] Me generate - WhatsApp error:', e));
    }
    
    res.status(201).json({
      ...idCard,
      pdfUrl,
      pdfGenerating: isBunnyCdnConfigured(),
      whatsappSent: true,
      message: 'ID card generated and will be sent via WhatsApp'
    });
  } catch (e: any) {
    console.error('reporter me id-card error', e);
    res.status(500).json({ error: 'Failed to generate ID card' });
  }
});

/**
 * @swagger
 * /reporters/me/id-card/resend:
 *   post:
 *     summary: Resend ID card to logged-in reporter via WhatsApp
 *     tags: [Reporters]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: ID card resent
 *       404:
 *         description: Reporter or ID card not found
 */
router.post('/id-card/resend', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    const userRole = user?.role?.name?.toUpperCase() || '';
    const forceRegenerate =
      String((req.query as any)?.forceRegenerate ?? (req.body as any)?.forceRegenerate ?? 'false').toLowerCase() === 'true';
    
    if (userRole !== 'REPORTER') {
      return res.status(403).json({ error: 'Only reporters can use this endpoint' });
    }
    
    const reporter = await (prisma as any).reporter.findFirst({
      where: { userId: user.id },
      include: { 
        idCard: true, 
        user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } }
      }
    });
    
    if (!reporter) {
      return res.status(404).json({ error: 'Reporter profile not found' });
    }
    
    if (!reporter.idCard) {
      return res.status(404).json({ error: 'ID card not found. Please generate it first.' });
    }
    
    if (!reporter.user?.mobileNumber) {
      return res.status(400).json({ error: 'Mobile number not found' });
    }
    
    // Get PDF URL
    let pdfUrl = reporter.idCard.pdfUrl;

    if (forceRegenerate) {
      if (isBunnyCdnConfigured()) {
        console.log(`[ID Card Resend/Me] forceRegenerate=true; generating new PDF for reporter ${reporter.id}`);
        const genResult = await generateAndUploadIdCardPdf(reporter.id);
        if (genResult.ok && genResult.pdfUrl) {
          pdfUrl = genResult.pdfUrl;
        } else {
          console.error(`[ID Card Resend/Me] Forced PDF generation failed:`, genResult.error);
          const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
          pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}&forceRender=true&ts=${Date.now()}`;
        }
      } else {
        const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
        pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}&forceRender=true&ts=${Date.now()}`;
      }
    }

    if (!pdfUrl) {
      const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
      pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}&forceRender=true&ts=${Date.now()}`;
    }
    
    // Send via WhatsApp
    const waResult = await sendIdCardViaWhatsApp({
      reporterId: reporter.id,
      tenantId: reporter.tenantId,
      pdfUrl,
      cardNumber: reporter.idCard.cardNumber,
    });
    
    if (!waResult.ok) {
      return res.status(500).json({ error: 'Failed to send via WhatsApp', details: waResult.error });
    }
    
    res.json({
      success: true,
      messageId: waResult.messageId,
      pdfUrl,
      message: 'ID card sent via WhatsApp'
    });
  } catch (e: any) {
    console.error('reporter me id-card resend error', e);
    res.status(500).json({ error: 'Failed to resend ID card' });
  }
});

/**
 * @swagger
 * /reporters/me/id-card/regenerate:
 *   post:
 *     summary: Regenerate ID card for logged-in reporter
 *     description: |
 *       Deletes existing ID card and generates a new one with updated info.
 *       Use this when profile photo or details have changed.
 *     tags: [Reporters]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keepCardNumber:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: ID card regenerated
 *       404:
 *         description: Reporter or settings not found
 */
router.post('/id-card/regenerate', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    const userRole = user?.role?.name?.toUpperCase() || '';
    const body = req.body || {};
    const keepCardNumber = body.keepCardNumber === true;
    
    if (userRole !== 'REPORTER') {
      return res.status(403).json({ error: 'Only reporters can use this endpoint' });
    }
    
    const reporter = await (prisma as any).reporter.findFirst({
      where: { userId: user.id },
      include: { idCard: true, tenant: true }
    });
    
    if (!reporter) {
      return res.status(404).json({ error: 'Reporter profile not found' });
    }
    
    const previousCardNumber = reporter.idCard?.cardNumber || null;
    
    // Delete existing ID card
    if (reporter.idCard) {
      await (prisma as any).reporterIDCard.delete({
        where: { id: reporter.idCard.id }
      });
    }
    
    // Check profile photo
    let hasPhoto = !!reporter.profilePhotoUrl;
    if (!hasPhoto && reporter.userId) {
      const profile = await (prisma as any).userProfile.findUnique({ 
        where: { userId: reporter.userId }, 
        select: { profilePhotoUrl: true } 
      }).catch(() => null);
      hasPhoto = !!profile?.profilePhotoUrl;
    }
    if (!hasPhoto) {
      return res.status(403).json({ error: 'Profile photo is required to generate ID card' });
    }
    
    // Get settings
    const settings = await (prisma as any).tenantIdCardSettings.findUnique({ 
      where: { tenantId: reporter.tenantId } 
    });
    if (!settings) {
      return res.status(404).json({ error: 'Tenant ID card settings not configured' });
    }
    
    // Generate card number
    let cardNumber: string;
    if (keepCardNumber && previousCardNumber) {
      cardNumber = previousCardNumber;
    } else {
      const existingCount = await (prisma as any).reporterIDCard.count({
        where: { reporter: { tenantId: reporter.tenantId } }
      });
      const prefix: string = settings.idPrefix || 'ID';
      const digits: number = settings.idDigits || 6;
      const nextNumber = existingCount + 1;
      const padded = String(nextNumber).padStart(digits, '0');
      cardNumber = `${prefix}${padded}`;
    }
    
    // Create new ID card
    const now = new Date();
    let expiresAt: Date;
    if (settings.validityType === 'FIXED_END_DATE' && settings.fixedValidUntil) {
      expiresAt = new Date(settings.fixedValidUntil);
    } else if (typeof settings.validityDays === 'number' && settings.validityDays > 0) {
      expiresAt = new Date(now.getTime() + settings.validityDays * 24 * 60 * 60 * 1000);
    } else {
      const validityMonths = settings.validityMonths || 12;
      expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + validityMonths);
    }
    
    const idCard = await (prisma as any).reporterIDCard.create({
      data: {
        reporterId: reporter.id,
        cardNumber,
        issuedAt: now,
        expiresAt,
      }
    });
    
    // Generate PDF and send via WhatsApp
    const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
    let pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}`;
    
    if (isBunnyCdnConfigured()) {
      generateAndUploadIdCardPdf(reporter.id).then(result => {
        if (result.ok && result.pdfUrl) {
          sendIdCardViaWhatsApp({
            reporterId: reporter.id,
            tenantId: reporter.tenantId,
            pdfUrl: result.pdfUrl,
            cardNumber,
          }).catch(e => console.error('[ID Card] Regenerate me - WhatsApp error:', e));
        }
      }).catch(e => console.error('[ID Card] Regenerate me - PDF error:', e));
    } else {
      sendIdCardViaWhatsApp({
        reporterId: reporter.id,
        tenantId: reporter.tenantId,
        pdfUrl,
        cardNumber,
      }).catch(e => console.error('[ID Card] Regenerate me - WhatsApp error:', e));
    }
    
    res.status(201).json({
      ...idCard,
      previousCardNumber,
      pdfUrl,
      regeneratedBy: user.id,
      whatsappSent: true,
      message: keepCardNumber 
        ? 'ID card regenerated with same card number' 
        : 'ID card regenerated with new card number'
    });
  } catch (e: any) {
    console.error('reporter me id-card regenerate error', e);
    res.status(500).json({ error: 'Failed to regenerate ID card' });
  }
});

export default router;
