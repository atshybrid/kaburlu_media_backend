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
 * Generate PDF buffer using PDFKit - EXACT match to old Puppeteer design
 * Credit card size: 54mm × 85.6mm = 153 × 243 points
 * Matches the HTML/CSS design exactly
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

      // Card dimensions (54mm × 85.6mm)
      const cardWidth = 153;
      const cardHeight = 243;
      const mm = 2.834645669; // 1mm in points
      const padding = 4 * mm; // 4mm padding like HTML version

      // ===== FRONT SIDE =====
      // Background gradient - diagonal from top-left to bottom-right (135deg)
      const primaryColor = settings.primaryColor || '#1E40AF';
      const gradientEndColor = '#3B82F6';
      
      // Create gradient effect using multiple rectangles
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        const ratio = i / steps;
        // Interpolate colors
        const r = Math.round(parseInt(primaryColor.slice(1, 3), 16) * (1 - ratio) + parseInt(gradientEndColor.slice(1, 3), 16) * ratio);
        const g = Math.round(parseInt(primaryColor.slice(3, 5), 16) * (1 - ratio) + parseInt(gradientEndColor.slice(3, 5), 16) * ratio);
        const b = Math.round(parseInt(primaryColor.slice(5, 7), 16) * (1 - ratio) + parseInt(gradientEndColor.slice(5, 7), 16) * ratio);
        const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        doc.rect(0, (cardHeight / steps) * i, cardWidth, cardHeight / steps + 1)
           .fill(color);
      }

      // Logo (height: 12mm, max-width: 40mm)
      let logoHeight = 0;
      if (tenant.logoUrl) {
        try {
          const logoBuffer = await downloadImageBuffer(tenant.logoUrl);
          if (logoBuffer) {
            const logoMaxHeight = 12 * mm;
            const logoMaxWidth = 40 * mm;
            doc.image(logoBuffer, (cardWidth - logoMaxWidth) / 2, padding, { 
              width: logoMaxWidth, 
              height: logoMaxHeight, 
              fit: [logoMaxWidth, logoMaxHeight] 
            });
            logoHeight = logoMaxHeight + (2 * mm); // logo + margin-bottom
          }
        } catch (e) {
          console.log('[ID Card PDF] Logo failed, skipping');
        }
      }

      // Tenant name (10pt, bold, center)
      const tenantNameY = padding + logoHeight;
      doc.fill(settings.secondaryColor || '#FFFFFF')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(tenant.name || 'Kaburlu Media', 0, tenantNameY, { align: 'center', width: cardWidth });

      // Tagline (7pt, opacity 0.9)
      let taglineHeight = 0;
      if (tenant.tagline) {
        doc.fillOpacity(0.9)
           .fontSize(7)
           .font('Helvetica')
           .text(tenant.tagline, 0, tenantNameY + 12, { align: 'center', width: cardWidth });
        taglineHeight = 10;
        doc.fillOpacity(1);
      }

      // Photo box (22mm × 28mm with 2mm border-radius, margin: 3mm 0)
      const photoWidth = 22 * mm;
      const photoHeight = 28 * mm;
      const photoX = (cardWidth - photoWidth) / 2;
      const photoY = tenantNameY + 12 + taglineHeight + (3 * mm);
      const cornerRadius = 2 * mm;
      
      // Draw rounded rectangle background (white)
      doc.roundedRect(photoX, photoY, photoWidth, photoHeight, cornerRadius)
         .fill('#FFFFFF');

      // Photo (if available)
      if (reporter.profilePhotoUrl) {
        try {
          const photoBuffer = await downloadImageBuffer(reporter.profilePhotoUrl);
          if (photoBuffer) {
            doc.save();
            doc.roundedRect(photoX, photoY, photoWidth, photoHeight, cornerRadius).clip();
            doc.image(photoBuffer, photoX, photoY, { 
              width: photoWidth, 
              height: photoHeight, 
              cover: [photoWidth, photoHeight]
            });
            doc.restore();
          }
        } catch (e) {
          console.log('[ID Card PDF] Photo failed, showing placeholder');
          doc.fill('#999999')
             .fontSize(8)
             .font('Helvetica')
             .text('No Photo', photoX, photoY + photoHeight / 2 - 4, { width: photoWidth, align: 'center' });
        }
      } else {
        doc.fill('#999999')
           .fontSize(8)
           .font('Helvetica')
           .text('No Photo', photoX, photoY + photoHeight / 2 - 4, { width: photoWidth, align: 'center' });
      }

      // Name (11pt, bold, center)
      const nameY = photoY + photoHeight + (3 * mm);
      doc.fill(settings.secondaryColor || '#FFFFFF')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(reporter.fullName, 0, nameY, { align: 'center', width: cardWidth });

      // Designation (8pt, opacity 0.9)
      doc.fillOpacity(0.9)
         .fontSize(8)
         .font('Helvetica')
         .text(reporter.designation, 0, nameY + 14, { align: 'center', width: cardWidth });
      doc.fillOpacity(1);

      // Card Number (8pt, margin-top: 1mm)
      doc.fontSize(8)
         .text(reporter.cardNumber, 0, nameY + 14 + 10 + (1 * mm), { align: 'center', width: cardWidth });

      // Workplace Location (7pt, margin-top: 2mm, opacity 0.9, line-height 1.3)
      if (reporter.workplaceLocation) {
        doc.fillOpacity(0.9)
           .fontSize(7)
           .text(reporter.workplaceLocation, padding, nameY + 14 + 10 + (1 * mm) + 10 + (2 * mm), { 
             align: 'center', 
             width: cardWidth - (padding * 2),
             lineGap: 2
           });
        doc.fillOpacity(1);
      }

      // ===== BACK SIDE =====
      doc.addPage({ size: [153, 243], margins: { top: 0, bottom: 0, left: 0, right: 0 } });

      // Background (white/secondary color)
      doc.rect(0, 0, cardWidth, cardHeight)
         .fill(settings.secondaryColor || '#FFFFFF');

      // Header - PRESS CARD (9pt, bold, margin-bottom: 3mm)
      doc.fill(settings.primaryColor || '#1E40AF')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('PRESS CARD', 0, padding, { align: 'center', width: cardWidth });

      // Details section (7pt, line-height: 1.4)
      const detailsY = padding + 10 + (3 * mm);
      const lineHeight = 10; // ~1.4 line-height for 7pt
      doc.fill('#333333')
         .fontSize(7)
         .font('Helvetica-Bold')
         .text('Name:', padding, detailsY)
         .font('Helvetica')
         .text(reporter.fullName, padding + 25, detailsY, { width: cardWidth - padding - 30 });

      doc.font('Helvetica-Bold')
         .text('Mobile:', padding, detailsY + lineHeight)
         .font('Helvetica')
         .text(reporter.mobileNumber, padding + 25, detailsY + lineHeight);

      doc.font('Helvetica-Bold')
         .text('ID:', padding, detailsY + lineHeight * 2)
         .font('Helvetica')
         .text(reporter.cardNumber, padding + 25, detailsY + lineHeight * 2);

      doc.font('Helvetica-Bold')
         .text('Valid Till:', padding, detailsY + lineHeight * 3)
         .font('Helvetica')
         .text(new Date(reporter.expiresAt).toLocaleDateString('en-IN'), padding + 35, detailsY + lineHeight * 3);

      // Custom back content (6pt, margin-top: 3mm, opacity 0.8)
      if (settings.customBackContent) {
        doc.fillOpacity(0.8)
           .fontSize(6)
           .text(settings.customBackContent, padding, detailsY + lineHeight * 4 + (3 * mm), {
             width: cardWidth - (padding * 2),
             lineGap: 1
           });
        doc.fillOpacity(1);
      }

      // Footer - Issued date (6pt, opacity 0.7, bottom aligned)
      doc.fillOpacity(0.7)
         .fill('#666666')
         .fontSize(6)
         .text(
           `Issued on: ${new Date(reporter.issuedAt).toLocaleDateString('en-IN')}`, 
           0, 
           cardHeight - padding - 8, 
           { align: 'center', width: cardWidth }
         );
      doc.fillOpacity(1);

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
