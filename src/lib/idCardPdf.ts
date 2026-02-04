/**
 * ID Card PDF Generation + Bunny CDN Upload
 * 
 * Generates ID card PDF using Puppeteer and uploads to Bunny CDN.
 * Returns the public URL of the uploaded PDF.
 */

import prisma from './prisma';
import { bunnyStoragePutObject, isBunnyStorageConfigured } from './bunnyStorage';

export interface IdCardPdfResult {
  ok: boolean;
  pdfUrl?: string;
  cardNumber?: string;
  error?: string;
}

/**
 * Check if Bunny CDN is configured
 */
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

  // Build location string based on level and designation
  const locationParts: string[] = [];
  const level = reporter.level;
  const designationName = reporter.designation?.name || 'Reporter';
  const designationNativeName = reporter.designation?.nativeName || null;

  // Build hierarchical location display based on level
  if (level === 'STATE') {
    // STATE level: Show only state
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'DISTRICT') {
    // DISTRICT level: Show district, state
    if (reporter.district?.name) locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'DIVISION') {
    // DIVISION level: Show district or mandal (whichever is available), state
    if (reporter.district?.name) {
      locationParts.push(`${reporter.district.name} Division`);
    } else if (reporter.mandal?.name) {
      locationParts.push(`${reporter.mandal.name} Division`);
    }
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'CONSTITUENCY') {
    // CONSTITUENCY level: Show constituency info
    if (reporter.assemblyConstituency?.name) {
      locationParts.push(`${reporter.assemblyConstituency.name} Constituency`);
    } else if (reporter.district?.name) {
      locationParts.push(`${reporter.district.name} Constituency`);
    } else if (reporter.mandal?.name) {
      locationParts.push(`${reporter.mandal.name} Constituency`);
    }
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'ASSEMBLY') {
    // ASSEMBLY level: Show assembly constituency, district, state
    if (reporter.assemblyConstituency?.name) locationParts.push(reporter.assemblyConstituency.name);
    if (reporter.district?.name) locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (level === 'MANDAL') {
    // MANDAL level: Show mandal, district, state
    if (reporter.mandal?.name) locationParts.push(reporter.mandal.name);
    if (reporter.district?.name) locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else {
    // Fallback: Show all available location info
    if (reporter.mandal?.name) locationParts.push(reporter.mandal.name);
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
      designation: designationName,
      designationNativeName: designationNativeName,
      level: reporter.level,
      workplaceLocation: workplaceLocation,
      state: reporter.state?.name,
      district: reporter.district?.name,
      mandal: reporter.mandal?.name,
      assemblyConstituency: reporter.assemblyConstituency?.name,
    },
    tenant: {
      name: reporter.tenant?.name || 'Kaburlu Media',
      logoUrl: entity?.logoUrl || settings?.logoUrl || null,
      tagline: entity?.tagline || '',
    },
    settings: {
      templateStyle: settings?.templateStyle || 'modern',
      primaryColor: settings?.primaryColor || '#1E40AF',
      secondaryColor: settings?.secondaryColor || '#FFFFFF',
      showQrCode: settings?.showQrCode !== false,
      showBloodGroup: settings?.showBloodGroup !== false,
      showAddress: settings?.showAddress !== false,
      customBackContent: settings?.customBackContent || null,
    }
  };
}

/**
 * Inline external assets as base64 data URIs for PDF rendering
 */
async function inlineAssetsForPdf(data: any): Promise<any> {
  const cloned = JSON.parse(JSON.stringify(data));
  
  // Helper to fetch and convert URL to base64
  async function urlToBase64(url: string): Promise<string | null> {
    if (!url || url.startsWith('data:')) return url;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return `data:${contentType};base64,${base64}`;
    } catch (e) {
      console.error('[ID Card PDF] Failed to inline asset:', url, e);
      return null;
    }
  }

  // Inline reporter photo
  if (cloned.reporter?.profilePhotoUrl) {
    const inlined = await urlToBase64(cloned.reporter.profilePhotoUrl);
    if (inlined) cloned.reporter.profilePhotoUrl = inlined;
  }

  // Inline tenant logo
  if (cloned.tenant?.logoUrl) {
    const inlined = await urlToBase64(cloned.tenant.logoUrl);
    if (inlined) cloned.tenant.logoUrl = inlined;
  }

  return cloned;
}

/**
 * Build HTML for ID card - RED/BLUE BANNER DESIGN (matches reference image)
 */
function buildIdCardHtml(data: any): string {
  const { reporter, tenant, settings } = data;
  
  // Generate QR code data URL
  const qrData = `ID:${reporter.cardNumber}\nName:${reporter.fullName}\nDesig:${reporter.designation}\nPhone:${reporter.mobileNumber}\nValid:${new Date(reporter.expiresAt).toLocaleDateString('en-IN')}`;
  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
  
  const frontHtml = `
    <div class="card front" style="
      width: 54mm;
      height: 85.6mm;
      background: white;
      font-family: Arial, sans-serif;
      box-sizing: border-box;
      position: relative;
      page-break-after: always;
    ">
      <!-- Telugu newspaper name -->
      <div style="text-align: center; padding: 2mm 0; font-size: 12pt; font-weight: bold; color: #1E40AF;">
        ${tenant.nativeName || tenant.name}
      </div>
      
      <!-- Red "PRINT MEDIA" banner -->
      <div style="background: #FF0000; text-align: center; padding: 2mm 0; margin-bottom: 2mm;">
        <div style="font-size: 12pt; font-weight: bold; color: white;">PRINT MEDIA</div>
      </div>
      
      <!-- Photo and QR code section -->
      <div style="display: flex; padding: 0 2mm; margin-bottom: 2mm;">
        <!-- Photo LEFT -->
        <div style="width: 18mm; height: 23mm; background: #f0f0f0; margin-right: 2mm; flex-shrink: 0;">
          ${reporter.profilePhotoUrl 
            ? `<img src="${reporter.profilePhotoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 7pt;">No Photo</div>`
          }
        </div>
        
        <!-- QR Code RIGHT -->
        <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
          <img src="${qrDataUrl}" style="width: 18mm; height: 18mm;" />
        </div>
      </div>
      
      <!-- Details section -->
      <div style="padding: 0 2mm; font-size: 6.5pt; line-height: 1.4;">
        <div style="margin-bottom: 1mm;">
          <strong>Name</strong> <span style="margin: 0 2mm;">:</span> ${reporter.fullName}
        </div>
        <div style="margin-bottom: 1mm;">
          <strong>ID Number</strong> <span style="margin: 0 2mm;">:</span> ${reporter.cardNumber}
        </div>
        <div style="margin-bottom: 1mm;">
          <strong>Desig</strong> <span style="margin: 0 2mm;">:</span> ${reporter.designation}
        </div>
        <div style="margin-bottom: 1mm;">
          <strong>Work Place</strong> <span style="margin: 0 2mm;">:</span> ${reporter.workplaceLocation || '-'}
        </div>
        <div style="margin-bottom: 1mm;">
          <strong>Phone</strong> <span style="margin: 0 2mm;">:</span> ${reporter.mobileNumber}
        </div>
        <div>
          <strong>Valid</strong> <span style="margin: 0 2mm;">:</span> ${new Date(reporter.expiresAt).toLocaleDateString('en-IN')}
        </div>
      </div>
      
      <!-- Blue footer banner -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; background: #1E40AF; text-align: center; padding: 1.5mm 0;">
        <div style="font-size: 7pt; font-weight: bold; color: white;">PRGI No : ${reporter.cardNumber}</div>
      </div>
    </div>
  `;

  const backHtml = `
    <div class="card back" style="
      width: 54mm;
      height: 85.6mm;
      background: white;
      font-family: Arial, sans-serif;
      box-sizing: border-box;
      position: relative;
    ">
      <!-- Blue header -->
      <div style="background: #1E40AF; text-align: center; padding: 2mm 0; margin-bottom: 2mm;">
        <div style="font-size: 11pt; font-weight: bold; color: white;">PRESS</div>
        <div style="font-size: 8pt; font-weight: bold; color: white;">REPORTER ID CARD</div>
      </div>
      
      <!-- Center QR code -->
      <div style="text-align: center; margin: 3mm 0;">
        <img src="${qrDataUrl}" style="width: 20mm; height: 20mm;" />
      </div>
      
      <!-- ADDRESS section -->
      <div style="text-align: center; margin-bottom: 2mm;">
        <div style="font-size: 8pt; font-weight: bold; margin-bottom: 1mm;">ADDRESS</div>
        <div style="font-size: 6pt; padding: 0 3mm; line-height: 1.3;">
          ${reporter.workplaceLocation || 'Not specified'}
        </div>
        <div style="font-size: 6pt; margin-top: 1mm;">
          Contact No: ${reporter.mobileNumber}
        </div>
      </div>
      
      <!-- Blue footer -->
      <div style="background: #1E40AF; text-align: center; padding: 1mm 0; margin: 2mm 0;">
        <div style="font-size: 6pt; font-weight: bold; color: white;">PRGI No : ${reporter.cardNumber}</div>
      </div>
      
      <!-- Terms & Conditions -->
      <div style="padding: 0 2mm;">
        <div style="font-size: 6pt; font-weight: bold; text-align: center; margin-bottom: 1mm;">Terms & Conditions</div>
        <div style="font-size: 4.5pt; line-height: 1.2;">
          ${settings.customBackContent || 
            '• This Reyuthu is to be used for the proper purpose of Newspaper representatives for gathering the latest news.<br>' +
            '• Identity card should be Produced wherever required.<br>' +
            '• The card holder shall not provide any wrong information for the sake of money.<br>' +
            '• This card is valid only till the date mentioned on it and after that, the member shall return the card.<br>' +
            '• It always is to be used for the public purpose only, not for private purpose and subject to central and state government rules.'
          }
        </div>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: 54mm 85.6mm; margin: 0; }
        body { margin: 0; padding: 0; }
      </style>
    </head>
    <body>
      ${frontHtml}
      ${backHtml}
    </body>
    </html>
  `;
}

/**
 * Get Puppeteer launch options
 */
async function getPuppeteerLaunchOptions(puppeteer: any): Promise<any> {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--single-process',
  ];

  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN;
  
  // Try env path first
  if (envPath) {
    const fs = await import('fs');
    if (fs.existsSync(envPath)) {
      return { headless: 'new', args, executablePath: envPath };
    }
  }

  // Try puppeteer's default
  try {
    const defaultPath = typeof puppeteer?.executablePath === 'function' ? puppeteer.executablePath() : undefined;
    if (defaultPath) {
      const fs = await import('fs');
      if (fs.existsSync(defaultPath)) {
        return { headless: 'new', args, executablePath: defaultPath };
      }
    }
  } catch {}

  // Fallback - let puppeteer find Chrome
  return { headless: 'new', args };
}

/**
 * Generate PDF buffer using Puppeteer
 */
async function generatePdfBuffer(html: string): Promise<Buffer> {
  let puppeteer: any;
  try {
    // Try full puppeteer first (includes Chrome)
    puppeteer = require('puppeteer');
  } catch {
    try {
      // Fallback to puppeteer-core (needs executablePath)
      puppeteer = require('puppeteer-core');
    } catch {
      throw new Error('Puppeteer not installed');
    }
  }

  const launchOpts = await getPuppeteerLaunchOptions(puppeteer);
  const browser = await puppeteer.launch(launchOpts);
  
  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30_000);
    await page.setBypassCSP(true);
    await page.emulateMediaType('screen');
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    
    const pdfBuffer = await page.pdf({
      width: '54mm',
      height: '85.6mm',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Main function: Generate ID Card PDF and upload to Bunny CDN
 */
export async function generateAndUploadIdCardPdf(reporterId: string): Promise<IdCardPdfResult> {
  try {
    console.log(`[ID Card PDF] Starting generation for reporter: ${reporterId}`);
    
    // 1. Build ID card data
    let data = await buildIdCardData(reporterId);
    if (!data) {
      return { ok: false, error: 'ID card not found for reporter' };
    }

    // 2. Inline assets for PDF
    try {
      data = await inlineAssetsForPdf(data);
    } catch (e) {
      console.error('[ID Card PDF] Asset inlining failed:', e);
    }

    // 3. Build HTML
    const html = buildIdCardHtml(data);

    // 4. Generate PDF
    console.log(`[ID Card PDF] Generating PDF...`);
    const pdfBuffer = await generatePdfBuffer(html);
    console.log(`[ID Card PDF] PDF generated, size: ${pdfBuffer.length} bytes`);

    // 5. Upload to Bunny CDN using existing bunnyStorage lib
    const timestamp = Date.now();
    const key = `id-cards/${data.reporter.cardNumber}_${timestamp}.pdf`;
    console.log(`[ID Card PDF] Uploading to Bunny: ${key}`);
    
    const { publicUrl: pdfUrl } = await bunnyStoragePutObject({
      key,
      body: pdfBuffer,
      contentType: 'application/pdf',
    });
    console.log(`[ID Card PDF] Upload success: ${pdfUrl}`);

    // 6. Update database with PDF URL
    await (prisma as any).reporterIDCard.update({
      where: { reporterId },
      data: { pdfUrl }
    });
    console.log(`[ID Card PDF] Database updated with pdfUrl: ${pdfUrl}`);

    return {
      ok: true,
      pdfUrl,
      cardNumber: data.reporter.cardNumber
    };
  } catch (e: any) {
    console.error('[ID Card PDF] Generation failed:', e);
    return {
      ok: false,
      error: e.message || 'Failed to generate ID card PDF'
    };
  }
}
