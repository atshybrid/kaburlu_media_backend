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
      village: true,
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
    if (reporter.village?.name) locationParts.push(reporter.village.name);
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
      village: reporter.village?.name,
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
 * Build HTML for ID card (simplified version for PDF)
 */
function buildIdCardHtml(data: any): string {
  const { reporter, tenant, settings } = data;
  
  const frontHtml = `
    <div class="card front" style="
      width: 54mm;
      height: 85.6mm;
      background: linear-gradient(135deg, ${settings.primaryColor} 0%, #3B82F6 100%);
      color: ${settings.secondaryColor};
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 4mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      page-break-after: always;
    ">
      ${tenant.logoUrl ? `<img src="${tenant.logoUrl}" style="height: 12mm; max-width: 40mm; object-fit: contain; margin-bottom: 2mm;" />` : ''}
      <div style="font-size: 10pt; font-weight: bold; text-align: center;">${tenant.name}</div>
      ${tenant.tagline ? `<div style="font-size: 7pt; opacity: 0.9;">${tenant.tagline}</div>` : ''}
      
      <div style="
        width: 22mm;
        height: 28mm;
        background: white;
        border-radius: 2mm;
        margin: 3mm 0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${reporter.profilePhotoUrl 
          ? `<img src="${reporter.profilePhotoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
          : `<div style="color: #999; font-size: 8pt;">No Photo</div>`
        }
      </div>
      
      <div style="font-size: 11pt; font-weight: bold; text-align: center;">${reporter.fullName}</div>
      <div style="font-size: 8pt; opacity: 0.9;">${reporter.designation}</div>
      <div style="font-size: 8pt; margin-top: 1mm;">${reporter.cardNumber}</div>
      
      ${reporter.workplaceLocation ? `
        <div style="font-size: 7pt; margin-top: 2mm; text-align: center; opacity: 0.9; line-height: 1.3;">
          ${reporter.workplaceLocation}
        </div>
      ` : ''}
    </div>
  `;

  const backHtml = `
    <div class="card back" style="
      width: 54mm;
      height: 85.6mm;
      background: ${settings.secondaryColor};
      color: #333;
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 4mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    ">
      <div style="text-align: center; margin-bottom: 3mm;">
        <div style="font-size: 9pt; font-weight: bold; color: ${settings.primaryColor};">PRESS CARD</div>
      </div>
      
      <div style="font-size: 7pt; line-height: 1.4;">
        <div><strong>Name:</strong> ${reporter.fullName}</div>
        <div><strong>Mobile:</strong> ${reporter.mobileNumber}</div>
        <div><strong>ID:</strong> ${reporter.cardNumber}</div>
        <div><strong>Valid Till:</strong> ${new Date(reporter.expiresAt).toLocaleDateString('en-IN')}</div>
      </div>
      
      ${settings.customBackContent ? `
        <div style="font-size: 6pt; margin-top: 3mm; opacity: 0.8;">
          ${settings.customBackContent}
        </div>
      ` : ''}
      
      <div style="flex: 1;"></div>
      
      <div style="text-align: center; font-size: 6pt; opacity: 0.7;">
        Issued on: ${new Date(reporter.issuedAt).toLocaleDateString('en-IN')}
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
    puppeteer = require('puppeteer-core');
  } catch {
    try {
      puppeteer = require('puppeteer');
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
