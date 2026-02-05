/**
 * ID Card PDF Generation + Bunny CDN Upload
 *
 * STYLE LOCK: Approved layout locked on 2026-02-04.
 * If you need to change design, update snapshot in tmp/style-lock/ first.
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

  // Build "Work Place" string based on selected location (mandal/assembly/district/state).
  // This is intentionally tolerant: some records have mismatched/missing `level`, but still have a location selected.
  const locationParts: string[] = [];
  const designationName = reporter.designation?.name || 'Reporter';
  const designationNativeName = reporter.designation?.nativeName || null;

  if (reporter.mandal?.name) {
    locationParts.push(reporter.mandal.name);
    if (reporter.district?.name) locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (reporter.assemblyConstituency?.name) {
    locationParts.push(reporter.assemblyConstituency.name);
    if (reporter.district?.name) locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (reporter.district?.name) {
    locationParts.push(reporter.district.name);
    if (reporter.state?.name) locationParts.push(reporter.state.name);
  } else if (reporter.state?.name) {
    locationParts.push(reporter.state.name);
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
      nativeName: reporter.tenant?.nativeName || null,
      logoUrl: entity?.logoUrl || settings?.frontLogoUrl || null,
      tagline: entity?.tagline || '',
      domain: reporter.tenant?.domain || 'kaburlu.com',
    },
    settings: {
      templateStyle: settings?.templateStyle || 'modern',
      primaryColor: settings?.primaryColor || '#1E40AF',
      secondaryColor: settings?.secondaryColor || '#FFFFFF',
      showQrCode: settings?.showQrCode !== false,
      showBloodGroup: settings?.showBloodGroup !== false,
      showAddress: settings?.showAddress !== false,
      customBackContent: settings?.customBackContent || null,
      frontLogoUrl: settings?.frontLogoUrl || null,
      roundStampUrl: settings?.roundStampUrl || null,
      signUrl: settings?.signUrl || null,
      overlayImageUrl: (settings as any)?.overlayImageUrl || null,
      officeAddress: settings?.officeAddress || null,
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

  // Inline front logo
  if (cloned.settings?.frontLogoUrl) {
    const inlined = await urlToBase64(cloned.settings.frontLogoUrl);
    if (inlined) cloned.settings.frontLogoUrl = inlined;
  }

  // Inline round stamp
  if (cloned.settings?.roundStampUrl) {
    const inlined = await urlToBase64(cloned.settings.roundStampUrl);
    if (inlined) cloned.settings.roundStampUrl = inlined;
  }

  // Inline signature
  if (cloned.settings?.signUrl) {
    const inlined = await urlToBase64(cloned.settings.signUrl);
    if (inlined) cloned.settings.signUrl = inlined;
  }

  // Inline overlay image (top-right of photo)
  if (cloned.settings?.overlayImageUrl) {
    const inlined = await urlToBase64(cloned.settings.overlayImageUrl);
    if (inlined) cloned.settings.overlayImageUrl = inlined;
  }

  // Generate QR codes locally (avoids external network failures in Puppeteer)
  if (cloned.settings?.showQrCode !== false) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const QRCode = require('qrcode');

      const frontQrData = `ID:${cloned.reporter?.cardNumber}\nName:${cloned.reporter?.fullName}\nDesig:${cloned.reporter?.designation}\nPhone:${cloned.reporter?.mobileNumber}\nValid:${new Date(cloned.reporter?.expiresAt).toLocaleDateString('en-IN')}`;
      const backQrData = `${cloned.tenant?.domain || 'kaburlu.com'}/reporter/${cloned.reporter?.id}`;

      cloned.frontQrDataUrl = await QRCode.toDataURL(frontQrData, {
        margin: 0,
        width: 260,
        errorCorrectionLevel: 'M',
      });

      cloned.backQrDataUrl = await QRCode.toDataURL(backQrData, {
        margin: 0,
        width: 320,
        errorCorrectionLevel: 'M',
      });
    } catch (e) {
      console.error('[ID Card PDF] QR generation failed:', e);
    }
  }

  return cloned;
}

/**
 * Build HTML for ID card - RED/BLUE BANNER DESIGN (matches reference image)
 */
function buildIdCardHtml(data: any): string {
  const { reporter, tenant, settings } = data;

  const baseFontStack =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif';

  const debugGridEnabled = process.env.ID_CARD_DEBUG_GRID === 'true';

  const escapeHtml = (input: string): string =>
    String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // Full-bleed helpers: Puppeteer/PDF rounding can leave 1-2px white line.
  const bleedTotalMm = 1.2; // total extra width (reduce PDF hairline gaps)
  const bleedLeftMm = -(bleedTotalMm / 2);
  const fullBleedWidthMm = 54 + bleedTotalMm;

  const officeAddressText =
    settings.officeAddress ||
    reporter.workplaceLocation ||
    'VBR ENCLAVE, 401, Street Number 11, HMT colony, adagutta society, Kukatpally, Hyderabad, Telangana 500085';

  const normalizedOfficeAddressText = String(officeAddressText || '')
    .replace(/\s+/g, ' ')
    .trim();

  const explicitLineCount = Math.min(
    4,
    String(officeAddressText || '')
      .split(/\r\n|\r|\n/)
      .filter((s) => s.trim().length > 0).length || 1,
  );

  // Dynamic QR sizing (back): address can be 1–3 lines; QR should shrink to make space.
  // Rule of thumb: start ~20mm and shrink aggressively as address grows.
  const computedBackQrSizeMm = (() => {
    const len = normalizedOfficeAddressText.length;
    const linePenalty = explicitLineCount >= 3 ? 2 : explicitLineCount === 2 ? 1 : 0;
    const over = Math.max(0, len - 60);
    const shrink = Math.ceil(over / 20) + linePenalty;
    return Math.max(13, Math.min(20, 20 - shrink));
  })();

  // Address font slightly shrinks when very long (keeps PRGI always visible).
  const backAddressFontPt = normalizedOfficeAddressText.length > 130 ? 6.0 : 6.4;

  const frontPhotoWmm = 22.5;
  const frontPhotoHmm = 27;
  const frontQrSizeMm = 22;
  const frontStampSizeMm = 10;
  const frontFooterReserveMm = 11;
  
  // Front QR: Basic ID info
  const frontQrData = `ID:${reporter.cardNumber}\nName:${reporter.fullName}\nDesig:${reporter.designation}\nPhone:${reporter.mobileNumber}\nValid:${new Date(reporter.expiresAt).toLocaleDateString('en-IN')}`;
  const frontQrUrl = data.frontQrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(frontQrData)}`;
  
  // Back QR: Domain URL - domainname.com/reporter/reporterid
  const backQrData = `${tenant.domain || 'kaburlu.com'}/reporter/${reporter.id}`;
  const backQrUrl = data.backQrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(backQrData)}`;

  const debugGridHtml = debugGridEnabled
    ? `
        <div class="debug-grid"></div>
        <div class="debug-badge">54mm × 85.6mm</div>
      `
    : '';

  const frontSignatureHtml = `
      <div style="display: flex; justify-content: flex-end; padding: 0 3mm 1.3mm 3mm;">
        <div style="width: 22mm; text-align: center;">
          ${settings.signUrl
            ? `<img src="${settings.signUrl}" style="width: 16mm; height: 5mm; object-fit: contain; display: block; margin: 0 auto;" />`
            : `<div style="height: 5mm;"></div><div style="height: 0.25mm; background: #111; opacity: 0.35; width: 16mm; margin: 0.2mm auto 0 auto;"></div>`
          }
          <div style="font-size: 5.4pt; font-weight: 900; color: #111; margin-top: 0.35mm; line-height: 1.05; letter-spacing: 0.2px;">Authorized Signature</div>
        </div>
      </div>
    `;
  
  const primaryColor = (settings.primaryColor || '#0033CC').trim();
  const secondaryColor = (settings.secondaryColor || '#FF0000').trim();

  const frontHtml = `
    <div class="card front" style="
      width: 54mm;
      height: 85.6mm;
      background: white;
      font-family: inherit;
      padding: 0;
      margin: 0;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      page-break-after: always;
    ">
      ${debugGridHtml}
      <!-- Logo at top (image not text) -->
      <div style="text-align: center; padding: 2mm 0;">
        ${settings.frontLogoUrl 
          ? `<img src="${settings.frontLogoUrl}" style="max-height: 14mm; max-width: 50mm; object-fit: contain;" />`
          : `<div style="font-size: 14pt; font-weight: bold; color: ${primaryColor};">${tenant.nativeName || tenant.name}</div>`
        }
      </div>
      
      <!-- Red "PRINT MEDIA" banner -->
      <div style="background: ${secondaryColor}; text-align: center; padding: 1.5mm 0; margin: 0; width: ${fullBleedWidthMm}mm; position: relative; left: ${bleedLeftMm}mm; display: block;">
        <div style="font-size: 14pt; font-weight: bold; color: white; letter-spacing: 2px;">PRINT MEDIA</div>
      </div>

      <!-- Body (no overlap with footer) -->
      <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
      
      <!-- Photo and QR code section -->
      <table style="width: 100%; border-collapse: collapse; margin: 1.2mm 0 0 0; padding: 0;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-left: 3mm; padding-right: 1mm; position: relative;">
            ${reporter.profilePhotoUrl 
              ? `<div style="position: relative; display: inline-block;">
                  <img src="${reporter.profilePhotoUrl}" style="width: ${frontPhotoWmm}mm; height: ${frontPhotoHmm}mm; object-fit: cover; display: block; border: 1px solid #ddd;" />
                  ${settings.roundStampUrl 
                    ? `<img src="${settings.roundStampUrl}" style="position: absolute; bottom: -1.5mm; right: -1.5mm; width: ${frontStampSizeMm}mm; height: ${frontStampSizeMm}mm; object-fit: contain; z-index: 10;" />`
                    : ''
                  }
                  ${settings.overlayImageUrl 
                    ? `<img src="${settings.overlayImageUrl}" style="position: absolute; top: 0; right: 0; width: 10mm; height: 10mm; object-fit: contain; z-index: 20;" />`
                    : ''
                  }
                </div>`
              : `<div style="width: ${frontPhotoWmm}mm; height: ${frontPhotoHmm}mm; background: #f0f0f0; border: 1px solid #ddd; display: inline-block; text-align: center; line-height: ${frontPhotoHmm}mm; color: #999; font-size: 7pt;">No Photo</div>`
            }
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; padding-right: 3mm; padding-left: 1mm; padding-top: 1mm;">
            <img src="${frontQrUrl}" style="width: ${frontQrSizeMm}mm; height: ${frontQrSizeMm}mm; display: inline-block; border: 1px solid #eee;" />
          </td>
        </tr>
      </table>
      
      <!-- Details (compact, single-line) -->
      <div style="padding: 0 3mm; margin-top: 1.5mm;">
        <table style="width: 100%; border-collapse: collapse; font-size: 7.1pt; line-height: 1.15; font-weight: 500;">
          <tr>
            <td style="width: 30%; font-weight: bold; padding: 0.15mm 0; white-space: nowrap;">Name</td>
            <td style="width: 5%; text-align: center; white-space: nowrap;">:</td>
            <td style="width: 65%; padding: 0.15mm 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${reporter.fullName}</td>
          </tr>
          <tr>
            <td style="width: 30%; font-weight: bold; padding: 0.15mm 0; white-space: nowrap;">ID Number</td>
            <td style="width: 5%; text-align: center; white-space: nowrap;">:</td>
            <td style="width: 65%; padding: 0.15mm 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${reporter.cardNumber}</td>
          </tr>
          <tr>
            <td style="width: 30%; font-weight: bold; padding: 0.15mm 0; white-space: nowrap;">Desig</td>
            <td style="width: 5%; text-align: center; white-space: nowrap;">:</td>
            <td style="width: 65%; padding: 0.15mm 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${reporter.designation}</td>
          </tr>
          <tr>
            <td style="width: 30%; font-weight: bold; padding: 0.15mm 0; white-space: nowrap;">Work Place</td>
            <td style="width: 5%; text-align: center; white-space: nowrap;">:</td>
            <td style="width: 65%; padding: 0.15mm 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${reporter.workplaceLocation || '-'}</td>
          </tr>
          <tr>
            <td style="width: 30%; font-weight: bold; padding: 0.15mm 0; white-space: nowrap;">Contact No</td>
            <td style="width: 5%; text-align: center; white-space: nowrap;">:</td>
            <td style="width: 65%; padding: 0.15mm 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${reporter.mobileNumber || '-'}</td>
          </tr>
          <tr>
            <td style="width: 30%; font-weight: bold; padding: 0.15mm 0; white-space: nowrap;">Valid</td>
            <td style="width: 5%; text-align: center; white-space: nowrap;">:</td>
            <td style="width: 65%; padding: 0.15mm 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${new Date(reporter.expiresAt).toLocaleDateString('en-IN')}</td>
          </tr>
        </table>
      </div>

      <!-- Signature uses the remaining white space above footer -->
      <div style="margin-top: auto;">
        ${frontSignatureHtml}
      </div>

      </div>
      
      <!-- Blue footer banner -->
      <div style="background: ${primaryColor}; text-align: center; padding: 2mm 0; width: ${fullBleedWidthMm}mm; position: relative; left: ${bleedLeftMm}mm; display: block;">
        <div style="font-size: 8pt; font-weight: bold; color: white; letter-spacing: 0.5px;">PRGI No : ${reporter.cardNumber}</div>
      </div>
    </div>
  `;

  const backHtml = `
    <div class="card back" style="
      width: 54mm;
      height: 85.6mm;
      background: white;
      font-family: inherit;
      padding: 0;
      margin: 0;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    ">
      ${debugGridHtml}
      <!-- Blue header -->
      <div style="background: ${primaryColor}; text-align: center; padding: 3mm 0; width: ${fullBleedWidthMm}mm; position: relative; left: ${bleedLeftMm}mm; display: block;">
        <div style="font-size: 14pt; font-weight: bold; color: white; letter-spacing: 2px;">PRESS</div>
        <div style="font-size: 9pt; font-weight: bold; color: white; letter-spacing: 1px; margin-top: 1mm;">REPORTER ID CARD</div>
      </div>

      <!-- Body -->
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">

        <!-- Top area (flexible): QR + address can shrink/clamp -->
        <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding: 0 3mm;">

          <!-- Center QR code - domain URL -->
          <div style="text-align: center; margin: 2.6mm 0 1.6mm 0; flex: 0 0 auto;">
            <img src="${backQrUrl}" style="width: ${computedBackQrSizeMm}mm; height: ${computedBackQrSizeMm}mm; border: 1px solid #eee;" />
          </div>

          <!-- ADDRESS section -->
          <div style="text-align: center; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
            <div style="font-size: 8pt; font-weight: 800; margin-bottom: 0.7mm; letter-spacing: 0.9px; flex: 0 0 auto;">ADDRESS</div>
            <div style="font-size: ${backAddressFontPt}pt; line-height: 1.25; text-align: center; overflow: hidden; flex: 0 0 auto; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; max-height: 9.4mm;">
              ${officeAddressText}
            </div>
          </div>

        </div>

        <!-- Fixed area (never goes behind footer): Contact + PRGI box -->
        <div style="flex: 0 0 auto; padding: 0 3mm 1.4mm 3mm;">
          <div style="font-size: 7pt; margin-top: 1mm; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center;">
            Contact No: ${reporter.mobileNumber}
          </div>

          <!-- PRGI box (separate, do not mix with footer) -->
          <div style="margin-top: 1.4mm; border: 0.4mm solid ${primaryColor}; border-radius: 1mm; padding: 1.2mm 1mm; text-align: center; background: #fff;">
            <div style="font-size: 8pt; font-weight: 900; color: #111; letter-spacing: 0.4px;">PRGI No : ${reporter.cardNumber}</div>
          </div>
        </div>

      </div>
      
      <!-- Blue footer with numbered Terms & Conditions (5 points, compact height) -->
      <div style="width: ${fullBleedWidthMm}mm; background: ${primaryColor}; padding: 1.3mm 2.4mm 1.4mm 2.4mm; box-sizing: border-box; display: block; height: 19mm; overflow: hidden; position: relative; left: ${bleedLeftMm}mm;">
        <div style="font-size: 5.1pt; font-weight: 900; color: white; text-align: center; margin-bottom: 0.55mm; letter-spacing: 0.35px;">Terms & Conditions</div>
        <ol style="margin: 0; padding-left: 3.0mm; font-size: 3.7pt; line-height: 1.1; color: white; text-align: left;">
          ${(() => {
            const defaultItems = [
              'This card is only for official news gathering.',
              'Produce the ID card wherever required.',
              'Do not misuse this ID for personal benefit.',
              'Valid only till the mentioned date; return after expiry.',
              'Subject to central/state government rules.',
            ];

            const raw = String(settings.customBackContent || '').trim();
            const items = raw
              ? raw
                  .split(/\u2022|•|\r\n|\r|\n|\s*;\s*/)
                  .map((s) => s.replace(/^[-*\d.\s]+/, '').trim())
                  .filter(Boolean)
                  .slice(0, 5)
              : defaultItems;

            return items
              .map((t, idx) => {
                const margin = idx === items.length - 1 ? '0' : '0 0 0.18mm 0';
                return `<li style="margin: ${margin};">${escapeHtml(t)}</li>`;
              })
              .join('');
          })()}
        </ol>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; }
        @page { size: 54mm 85.6mm; margin: 0; }
        body { margin: 0; padding: 0; background: white; font-family: ${baseFontStack}; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
        table { border-collapse: collapse; }

        .debug-grid {
          position: absolute;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          background-image:
            linear-gradient(to right, rgba(0, 0, 0, 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.06) 1px, transparent 1px),
            linear-gradient(to right, rgba(0, 0, 0, 0.18) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.18) 1px, transparent 1px);
          background-size: 1mm 1mm, 1mm 1mm, 5mm 5mm, 5mm 5mm;
          mix-blend-mode: multiply;
        }

        .debug-badge {
          position: absolute;
          top: 0.8mm;
          right: 0.8mm;
          z-index: 10000;
          pointer-events: none;
          font-size: 6px;
          padding: 1px 3px;
          background: rgba(255, 255, 0, 0.6);
          color: #000;
          border: 1px solid rgba(0, 0, 0, 0.3);
          border-radius: 2px;
        }
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

    // 4. Generate PDF with Puppeteer
    const pdfBuffer = await generatePdfWithPuppeteer(html);

    // 5. Upload to Bunny CDN
    const key = `id-cards/${reporterId}_${data.reporter.cardNumber}.pdf`;
    const pdfUrl = await bunnyStoragePutObject({
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

/**
 * Generate ID Card PDF buffer without uploading (for direct streaming)
 */
export async function generateIdCardPdfBuffer(reporterId: string): Promise<{ok: boolean; pdfBuffer?: Buffer; cardNumber?: string; error?: string}> {
  try {
    // 1. Build ID card data
    let data = await buildIdCardData(reporterId);
    if (!data) {
      return { ok: false, error: 'ID card not found for reporter' };
    }

    // 2. Inline assets for PDF
    try {
      data = await inlineAssetsForPdf(data);
    } catch (e) {
      console.error('[ID Card PDF Buffer] Asset inlining failed:', e);
    }

    // 3. Build HTML
    const html = buildIdCardHtml(data);

    // 4. Generate PDF buffer with Puppeteer
    const pdfBuffer = await generatePdfWithPuppeteer(html);

    return {
      ok: true,
      pdfBuffer,
      cardNumber: data.reporter.cardNumber
    };
  } catch (e: any) {
    console.error('[ID Card PDF Buffer] Generation failed:', e);
    return {
      ok: false,
      error: e.message || 'Failed to generate ID card PDF buffer'
    };
  }
}

