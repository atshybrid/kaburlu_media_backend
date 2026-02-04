/**
 * ID Card PDF Generation using PDFKit (no Chrome dependencies)
 * Lightweight alternative to Puppeteer-based generation
 */

import PDFDocument from 'pdfkit';
import prisma from './prisma';
import { bunnyStoragePutObject, isBunnyStorageConfigured } from './bunnyStorage';

export interface IdCardPdfResult {
  ok: boolean;
  pdfUrl?: string;
  cardNumber?: string;
  error?: string;
}

export function isBunnyCdnConfigured(): boolean {
  return isBunnyStorageConfigured();
}

/**
 * Build ID card data for a reporter
 */
async function buildIdCardData(reporterId: string): Promise<any | null> {
  const reporter = await (prisma as any).reporter.findUnique({
    where: { id: reporterId },
    include: {
      idCard: true,
      user: { include: { profile: true } },
      tenant: { include: { entity: true, idCardSettings: true } },
      designation: true,
      state: true,
      district: true,
      mandal: true,
      assemblyConstituency: true,
    }
  });

  if (!reporter || !reporter.idCard) return null;

  const settings = reporter.tenant?.idCardSettings;
  const entity = reporter.tenant?.entity;
  const profile = reporter.user?.profile;

  // Build location string based on level
  const locationParts: string[] = [];
  const level = reporter.level;

  if (level === 'STATE') {
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'DISTRICT') {
    if (reporter.district?.name) locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'DIVISION') {
    if (reporter.district?.name) {
      locationParts.push(`${reporter.district.name} Division`);
    } else if (reporter.mandal?.name) {
      locationParts.push(`${reporter.mandal.name} Division`);
    }
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'CONSTITUENCY') {
    if (reporter.assemblyConstituency?.name) {
      locationParts.push(`${reporter.assemblyConstituency.name} Constituency`);
    } else if (reporter.district?.name) {
      locationParts.push(`${reporter.district.name} Constituency`);
    } else if (reporter.mandal?.name) {
      locationParts.push(`${reporter.mandal.name} Constituency`);
    }
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'ASSEMBLY') {
    if (reporter.assemblyConstituency?.name) locationParts.push(reporter.assemblyConstituency.name);
    if (reporter.district?.name) locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'MANDAL') {
    if (reporter.mandal?.name) locationParts.push(reporter.mandal.name);
    if (reporter.district?.name) locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else {
    if (reporter.mandal?.name) locationParts.push(reporter.mandal?.name);
    if (reporter.assemblyConstituency?.name) locationParts.push(reporter.assemblyConstituency.name);
    if (reporter.district?.name) locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  }

  const workplaceLocation = locationParts.join(', ');

  return {
    reporter: {
      id: reporter.id,
      fullName: profile?.fullName || 'Unknown',
      mobileNumber: reporter.user?.mobileNumber || '',
      email: reporter.user?.email,
      profilePhotoUrl: profile?.profilePhotoUrl || null,
      cardNumber: reporter.idCard.cardNumber,
      issuedAt: reporter.idCard.issuedAt,
      expiresAt: reporter.idCard.expiresAt,
      designation: reporter.designation?.name || 'Reporter',
      level: reporter.level,
      workplaceLocation: workplaceLocation,
    },
    tenant: {
      name: reporter.tenant?.name || 'Kaburlu Media',
      logoUrl: entity?.logoUrl || settings?.logoUrl || null,
      tagline: entity?.tagline || '',
    },
    settings: {
      primaryColor: settings?.primaryColor || '#1E40AF',
      secondaryColor: settings?.secondaryColor || '#FFFFFF',
    }
  };
}

/**
 * Download image as buffer
 */
async function downloadImageBuffer(url: string): Promise<Buffer | null> {
  if (!url || url.startsWith('data:')) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.error('[ID Card PDF] Failed to download image:', url, e);
    return null;
  }
}

/**
 * Generate PDF buffer using PDFKit
 * Credit card size: 54mm × 85.6mm = 153 × 243 points
 */
async function generatePdfBuffer(data: any): Promise<Buffer> {
  const { reporter, tenant, settings } = data;
  
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [153, 243], // 54mm × 85.6mm in points (1mm = 2.834645669 points)
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Card dimensions
      const cardWidth = 153;
      const cardHeight = 243;

      // ===== FRONT SIDE =====
      // Background gradient (simplified as solid color)
      doc.rect(0, 0, cardWidth, cardHeight)
         .fill(settings.primaryColor || '#1E40AF');

      // Logo (if available)
      if (tenant.logoUrl) {
        try {
          const logoBuffer = await downloadImageBuffer(tenant.logoUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, 25, 10, { width: 100, height: 30, fit: [100, 30] });
          }
        } catch (e) {
          console.log('[ID Card PDF] Logo failed, skipping');
        }
      }

      // Tenant name
      doc.fill(settings.secondaryColor || '#FFFFFF')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(tenant.name || 'Kaburlu Media', 0, 45, { align: 'center', width: cardWidth });

      // Tagline
      if (tenant.tagline) {
        doc.fontSize(7)
           .font('Helvetica')
           .text(tenant.tagline, 0, 58, { align: 'center', width: cardWidth });
      }

      // Photo placeholder box
      const photoX = (cardWidth - 60) / 2;
      const photoY = 70;
      doc.rect(photoX, photoY, 60, 75)
         .fill('#FFFFFF');

      // Photo (if available)
      if (reporter.profilePhotoUrl) {
        try {
          const photoBuffer = await downloadImageBuffer(reporter.profilePhotoUrl);
          if (photoBuffer) {
            doc.image(photoBuffer, photoX, photoY, { width: 60, height: 75, fit: [60, 75] });
          }
        } catch (e) {
          console.log('[ID Card PDF] Photo failed, showing placeholder');
          doc.fill('#999999')
             .fontSize(8)
             .text('No Photo', photoX, photoY + 32, { width: 60, align: 'center' });
        }
      } else {
        doc.fill('#999999')
           .fontSize(8)
           .text('No Photo', photoX, photoY + 32, { width: 60, align: 'center' });
      }

      // Name
      doc.fill(settings.secondaryColor || '#FFFFFF')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(reporter.fullName, 0, 153, { align: 'center', width: cardWidth });

      // Designation
      doc.fontSize(8)
         .font('Helvetica')
         .text(reporter.designation, 0, 168, { align: 'center', width: cardWidth });

      // Card Number
      doc.fontSize(8)
         .text(reporter.cardNumber, 0, 180, { align: 'center', width: cardWidth });

      // Workplace Location
      if (reporter.workplaceLocation) {
        doc.fontSize(7)
           .text(reporter.workplaceLocation, 5, 195, { align: 'center', width: cardWidth - 10, lineGap: 1 });
      }

      // ===== BACK SIDE =====
      doc.addPage({ size: [153, 243], margins: { top: 0, bottom: 0, left: 0, right: 0 } });

      // Background
      doc.rect(0, 0, cardWidth, cardHeight)
         .fill(settings.secondaryColor || '#FFFFFF');

      // Header
      doc.fill(settings.primaryColor || '#1E40AF')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('PRESS CARD', 0, 15, { align: 'center', width: cardWidth });

      // Details
      const detailsY = 40;
      const lineHeight = 12;
      doc.fill('#333333')
         .fontSize(7)
         .font('Helvetica-Bold')
         .text('Name:', 10, detailsY)
         .font('Helvetica')
         .text(reporter.fullName, 40, detailsY);

      doc.font('Helvetica-Bold')
         .text('Mobile:', 10, detailsY + lineHeight)
         .font('Helvetica')
         .text(reporter.mobileNumber, 40, detailsY + lineHeight);

      doc.font('Helvetica-Bold')
         .text('ID:', 10, detailsY + lineHeight * 2)
         .font('Helvetica')
         .text(reporter.cardNumber, 40, detailsY + lineHeight * 2);

      doc.font('Helvetica-Bold')
         .text('Valid Till:', 10, detailsY + lineHeight * 3)
         .font('Helvetica')
         .text(new Date(reporter.expiresAt).toLocaleDateString('en-IN'), 50, detailsY + lineHeight * 3);

      // Footer
      doc.fill('#666666')
         .fontSize(6)
         .text(`Issued on: ${new Date(reporter.issuedAt).toLocaleDateString('en-IN')}`, 0, 220, { align: 'center', width: cardWidth });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate and upload ID card PDF
 */
export async function generateAndUploadIdCardPdf(reporterId: string): Promise<IdCardPdfResult> {
  try {
    console.log(`[ID Card PDF] Starting generation for reporter: ${reporterId}`);

    // Check Bunny CDN
    if (!isBunnyStorageConfigured()) {
      return { ok: false, error: 'Bunny CDN not configured' };
    }

    // Build data
    const data = await buildIdCardData(reporterId);
    if (!data) {
      return { ok: false, error: 'Reporter or ID card not found' };
    }

    // Generate PDF
    console.log(`[ID Card PDF] Generating PDF with PDFKit...`);
    const pdfBuffer = await generatePdfBuffer(data);

    // Upload to Bunny CDN
    const cardNumber = data.reporter.cardNumber;
    const filename = `id-cards/${reporterId}_${cardNumber}.pdf`;
    console.log(`[ID Card PDF] Uploading to Bunny CDN: ${filename}`);

    const uploadResult = await bunnyStoragePutObject({
      key: filename,
      body: pdfBuffer,
      contentType: 'application/pdf'
    });
    if (!uploadResult.publicUrl) {
      return { ok: false, error: 'Failed to upload PDF to Bunny CDN' };
    }

    // Update database
    await (prisma as any).reporterIDCard.update({
      where: { reporterId },
      data: { pdfUrl: uploadResult.publicUrl }
    });

    console.log(`[ID Card PDF] ✓ Success! URL: ${uploadResult.publicUrl}`);
    return { ok: true, pdfUrl: uploadResult.publicUrl, cardNumber };
  } catch (e: any) {
    console.error('[ID Card PDF] Generation failed:', e);
    return { ok: false, error: e.message || 'PDF generation failed' };
  }
}
