/**
 * ID Card PDF Generation using PDFKit (no Chrome dependencies)
 * Lightweight alternative to Puppeteer-based generation
 * Matches old Puppeteer design with QR codes, banners, detailed layout
 */

import PDFDocument from 'pdfkit';
import prisma from './prisma';
import { bunnyStoragePutObject, isBunnyStorageConfigured } from './bunnyStorage';
import QRCode from 'qrcode';

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
 * Generate QR code as buffer
 */
async function generateQRCode(data: string): Promise<Buffer> {
  try {
    return await QRCode.toBuffer(data, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
  } catch (e) {
    console.error('[ID Card PDF] QR code generation failed:', e);
    throw e;
  }
}

/**
 * Generate PDF buffer using PDFKit - MATCHES OLD PUPPETEER DESIGN EXACTLY
 * Credit card size: 54mm × 85.6mm = 153 × 243 points
 * Design: Red "PRINT MEDIA" banner, photo left, QR right, blue footer, detailed back
 */
async function generatePdfBuffer(data: any): Promise<Buffer> {
  const { reporter, tenant, settings } = data;
  
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [153, 243], // 54mm × 85.6mm in points
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const cardWidth = 153;
      const cardHeight = 243;
      const mm = 2.834645669;

      // ===== FRONT SIDE =====
      // White background
      doc.rect(0, 0, cardWidth, cardHeight).fill('#FFFFFF');

      // Telugu newspaper name at top (centered, blue color)
      doc.fill('#1E40AF')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(tenant.nativeName || tenant.name, 0, 8, { align: 'center', width: cardWidth });

      // Red "PRINT MEDIA" banner
      doc.rect(0, 28, cardWidth, 20).fill('#FF0000');
      doc.fill('#FFFFFF')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('PRINT MEDIA', 0, 33, { align: 'center', width: cardWidth });

      // Photo on LEFT (50mm × 60mm position)
      const photoX = 8;
      const photoY = 55;
      const photoWidth = 50;
      const photoHeight = 65;

      if (reporter.profilePhotoUrl) {
        try {
          const photoBuffer = await downloadImageBuffer(reporter.profilePhotoUrl);
          if (photoBuffer) {
            doc.image(photoBuffer, photoX, photoY, { 
              width: photoWidth, 
              height: photoHeight, 
              fit: [photoWidth, photoHeight] 
            });
          }
        } catch (e) {
          doc.rect(photoX, photoY, photoWidth, photoHeight).stroke('#CCCCCC');
          doc.fill('#999999')
             .fontSize(8)
             .text('No Photo', photoX, photoY + 28, { width: photoWidth, align: 'center' });
        }
      } else {
        doc.rect(photoX, photoY, photoWidth, photoHeight).stroke('#CCCCCC');
        doc.fill('#999999')
           .fontSize(8)
           .text('No Photo', photoX, photoY + 28, { width: photoWidth, align: 'center' });
      }

      // QR Code on RIGHT
      const qrX = 65;
      const qrY = 55;
      const qrSize = 50;
      
      try {
        const qrData = `ID:${reporter.cardNumber}\nName:${reporter.fullName}\nDesig:${reporter.designation}\nPhone:${reporter.mobileNumber}\nValid:${new Date(reporter.expiresAt).toLocaleDateString('en-IN')}`;
        const qrBuffer = await generateQRCode(qrData);
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      } catch (e) {
        console.log('[ID Card PDF] QR code failed');
      }

      // Details section (below photo/QR)
      const detailsY = 128;
      const labelX = 8;
      const valueX = 45;
      const lineHeight = 11;
      
      doc.fill('#000000')
         .fontSize(7)
         .font('Helvetica-Bold');

      // Name
      doc.text('Name', labelX, detailsY, { width: 35, continued: false });
      doc.text(':', valueX - 8, detailsY);
      doc.font('Helvetica')
         .text(reporter.fullName, valueX, detailsY, { width: cardWidth - valueX - 8 });

      // ID Number
      doc.font('Helvetica-Bold')
         .text('ID Number', labelX, detailsY + lineHeight);
      doc.text(':', valueX - 8, detailsY + lineHeight);
      doc.font('Helvetica')
         .text(reporter.cardNumber, valueX, detailsY + lineHeight);

      // Designation
      doc.font('Helvetica-Bold')
         .text('Desig', labelX, detailsY + lineHeight * 2);
      doc.text(':', valueX - 8, detailsY + lineHeight * 2);
      doc.font('Helvetica')
         .text(reporter.designation, valueX, detailsY + lineHeight * 2);

      // Work Place
      doc.font('Helvetica-Bold')
         .text('Work Place', labelX, detailsY + lineHeight * 3);
      doc.text(':', valueX - 8, detailsY + lineHeight * 3);
      doc.font('Helvetica')
         .text(reporter.workplaceLocation || '-', valueX, detailsY + lineHeight * 3, { width: cardWidth - valueX - 8 });

      // Phone
      doc.font('Helvetica-Bold')
         .text('Phone', labelX, detailsY + lineHeight * 4);
      doc.text(':', valueX - 8, detailsY + lineHeight * 4);
      doc.font('Helvetica')
         .text(reporter.mobileNumber, valueX, detailsY + lineHeight * 4);

      // Valid
      doc.font('Helvetica-Bold')
         .text('Valid', labelX, detailsY + lineHeight * 5);
      doc.text(':', valueX - 8, detailsY + lineHeight * 5);
      doc.font('Helvetica')
         .text(new Date(reporter.expiresAt).toLocaleDateString('en-IN'), valueX, detailsY + lineHeight * 5);

      // Blue footer banner with PRGI number
      const footerY = 210;
      doc.rect(0, footerY, cardWidth, 18).fill('#1E40AF');
      doc.fill('#FFFFFF')
         .fontSize(8)
         .font('Helvetica-Bold')
         .text(`PRGI No : ${reporter.cardNumber}`, 0, footerY + 5, { align: 'center', width: cardWidth });

      // ===== BACK SIDE =====
      doc.addPage({ size: [153, 243], margins: { top: 0, bottom: 0, left: 0, right: 0 } });

      // White background
      doc.rect(0, 0, cardWidth, cardHeight).fill('#FFFFFF');

      // Blue header "PRESS REPORTER ID CARD"
      doc.rect(0, 8, cardWidth, 28).fill('#1E40AF');
      doc.fill('#FFFFFF')
         .fontSize(13)
         .font('Helvetica-Bold')
         .text('PRESS', 0, 12, { align: 'center', width: cardWidth });
      doc.fontSize(10)
         .text('REPORTER ID CARD', 0, 26, { align: 'center', width: cardWidth });

      // QR Code in center
      const backQrY = 45;
      const backQrSize = 55;
      const backQrX = (cardWidth - backQrSize) / 2;
      
      try {
        const qrData = `ID:${reporter.cardNumber}\nName:${reporter.fullName}\nDesig:${reporter.designation}\nPhone:${reporter.mobileNumber}\nValid:${new Date(reporter.expiresAt).toLocaleDateString('en-IN')}`;
        const qrBuffer = await generateQRCode(qrData);
        doc.image(qrBuffer, backQrX, backQrY, { width: backQrSize, height: backQrSize });
      } catch (e) {
        console.log('[ID Card PDF] Back QR code failed');
      }

      // ADDRESS section
      const addressY = 110;
      doc.fill('#000000')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('ADDRESS', 0, addressY, { align: 'center', width: cardWidth });

      // Address details
      doc.fontSize(6)
         .font('Helvetica')
         .text(
           reporter.workplaceLocation || 'Not specified',
           10,
           addressY + 12,
           { align: 'center', width: cardWidth - 20, lineGap: 1 }
         );

      doc.text(
        `Contact No: ${reporter.mobileNumber}`,
        10,
        addressY + 30,
        { align: 'center', width: cardWidth - 20 }
      );

      // Blue footer with PRGI number
      const backFooterY = 148;
      doc.rect(0, backFooterY, cardWidth, 14).fill('#1E40AF');
      doc.fill('#FFFFFF')
         .fontSize(7)
         .font('Helvetica-Bold')
         .text(`PRGI No : ${reporter.cardNumber}`, 0, backFooterY + 3, { align: 'center', width: cardWidth });

      // Terms & Conditions section
      const termsY = backFooterY + 16;
      doc.fill('#000000')
         .fontSize(7)
         .font('Helvetica-Bold')
         .text('Terms & Conditions', 0, termsY, { align: 'center', width: cardWidth });

      // Terms text (small font)
      const termsText = settings.customBackContent || 
        '• This Reyuthu is to be used for the proper purpose of Newspaper representatives for gathering the latest news.\n' +
        '• Identity card should be Produced wherever required.\n' +
        '• The card holder shall not provide any wrong information for the sake of money.\n' +
        '• This card is valid only till the date mentioned on it and after that, the member shall return the card.\n' +
        '• It always is to be used for the public purpose only, not for private purpose and subject to central and state government rules.';

      doc.fontSize(5)
         .font('Helvetica')
         .text(termsText, 10, termsY + 8, { 
           width: cardWidth - 20, 
           lineGap: 0.5,
           align: 'left'
         });

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
