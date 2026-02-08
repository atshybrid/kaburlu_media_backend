import { Router } from 'express';
import prisma from '../../lib/prisma';
import axios from 'axios';
import fs from 'fs';
import { generateIdCardPdfBuffer } from '../../lib/idCardPdf';

const router = Router();

type CardData = {
  tenant: {
    name?: string;
    frontLogoUrl?: string | null;
    roundStampUrl?: string | null;
    signUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    officeAddress?: string | null;
    helpLine1?: string | null;
    helpLine2?: string | null;
    terms?: string[] | null;
    prgiNumber?: string | null;
  };
  reporter: {
    id: string;
    fullName?: string | null;
    designation?: string | null;
    placeOfWork?: string | null;
    mobile?: string | null;
    photoUrl?: string | null;
    cardNumber: string;
    issuedAt: string;
    expiresAt: string;
    validityLabel: string;
    qrCodeUrl?: string | null;
  };
};

function formatIdCardNumber(cardNumber: string, issuedAt: Date): string {
  const raw = String(cardNumber || '').trim();
  if (!raw) return raw;

  // Split into leading non-digits + the rest starting with the first digit.
  const m = raw.match(/^([^0-9]*)([0-9].*)$/);
  if (!m) return raw;
  const prefix = m[1] || '';
  const rest = m[2] || '';

  const y = issuedAt.getUTCFullYear();
  const mo = String(issuedAt.getUTCMonth() + 1).padStart(2, '0');
  const yyyymm = `${y}${mo}`;

  // If already has YYYYMM right after prefix, do not re-insert.
  if (rest.startsWith(yyyymm)) return `${prefix}${rest}`;

  // Also avoid inserting if it already looks like it has a YYYYMM (any month) prefix.
  if (/^20\d{2}(0[1-9]|1[0-2])/.test(rest)) return `${prefix}${rest}`;

  return `${prefix}${yyyymm}${rest}`;
}

async function resolveReporterByQuery(q: { reporterId?: string; mobile?: string; fullName?: string }) {
  if (q.reporterId) {
    const r = await (prisma as any).reporter.findUnique({ where: { id: q.reporterId } });
    if (r) return r;
  }
  if (q.mobile) {
    const u = await (prisma as any).user.findFirst({ where: { mobileNumber: q.mobile } });
    if (u) {
      const r = await (prisma as any).reporter.findFirst({ where: { userId: u.id } });
      if (r) return r;
    }
  }
  if (q.fullName) {
    const p = await (prisma as any).userProfile.findFirst({ where: { fullName: { equals: String(q.fullName), mode: 'insensitive' } } });
    if (p) {
      const r = await (prisma as any).reporter.findFirst({ where: { userId: p.userId } });
      if (r) return r;
    }
  }
  return null;
}

async function buildIdCardData(reporterId: string): Promise<CardData | null> {
  const reporter = await (prisma as any).reporter.findUnique({
    where: { id: reporterId },
    include: {
      idCard: true,
      designation: true,
      user: true,
      state: true,
      district: { include: { state: true } },
      mandal: { include: { district: { include: { state: true } } } },
      assemblyConstituency: { include: { district: { include: { state: true } } } },
    }
  });
  if (!reporter || !reporter.idCard) return null;

  const tenant = await (prisma as any).tenant.findUnique({ where: { id: reporter.tenantId }, include: { state: true } });
  const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId: reporter.tenantId } });
  const entity = await (prisma as any).tenantEntity.findUnique({ where: { tenantId: reporter.tenantId } }).catch(() => null);
  const primaryDomainRec = await (prisma as any).domain.findFirst({ where: { tenantId: reporter.tenantId, status: 'ACTIVE', isPrimary: true } }).catch(()=>null);
  const anyDomainRec = primaryDomainRec || await (prisma as any).domain.findFirst({ where: { tenantId: reporter.tenantId, status: 'ACTIVE' } }).catch(()=>null);
  const domainBase = anyDomainRec?.domain ? `https://${anyDomainRec.domain}` : null;

  // Resolve place of work based on selected location.
  // Rule (aligned with locked PDF):
  // - MANDAL level: Mandal, District, State
  // - CONSTITUENCY level: resolve `constituencyId` and show its location name (+ district/state when applicable)
  // - ASSEMBLY level: Assembly, District, State
  // - Others: District, State
  const reporterLevel = String((reporter as any).level || '').toUpperCase();
  const includeMandalInWorkPlace = reporterLevel === 'MANDAL';

  const derivedDistrict =
    (reporter as any).district ||
    (reporter as any).mandal?.district ||
    (reporter as any).assemblyConstituency?.district ||
    null;

  // Only Publisher designation uses tenant's state (other STATE level designations are manually assigned)
  const designationName = (reporter as any).designation?.name || '';
  const isPublisher = designationName.toLowerCase() === 'publisher' || designationName.toLowerCase() === 'ప్రచురణకర్త';
  const derivedState = isPublisher && tenant?.state
    ? tenant.state
    : ((reporter as any).state ||
      (derivedDistrict as any)?.state ||
      (reporter as any).mandal?.district?.state ||
      (reporter as any).assemblyConstituency?.district?.state ||
      null);

  async function resolveLocationPartsFromFlexibleId(flexibleId: string): Promise<string[]> {
    const id = String(flexibleId || '').trim();
    if (!id) return [];

    const mandal = await (prisma as any).mandal
      .findUnique({ where: { id }, include: { district: { include: { state: true } } } })
      .catch(() => null);
    if (mandal?.name) {
      if (reporterLevel === 'CONSTITUENCY') return [mandal.name];

      const parts: string[] = [];
      if (includeMandalInWorkPlace) parts.push(mandal.name);
      if (mandal.district?.name) parts.push(mandal.district.name);
      if (mandal.district?.state?.name) parts.push(mandal.district.state.name);
      return parts;
    }

    const assembly = await (prisma as any).assemblyConstituency
      .findUnique({ where: { id }, include: { district: { include: { state: true } } } })
      .catch(() => null);
    if (assembly?.name) {
      if (reporterLevel === 'CONSTITUENCY') return [assembly.name];

      const parts: string[] = [];
      if (reporterLevel === 'ASSEMBLY') parts.push(assembly.name);
      if (assembly.district?.name) parts.push(assembly.district.name);
      if (assembly.district?.state?.name) parts.push(assembly.district.state.name);
      return parts;
    }

    const district = await (prisma as any).district
      .findUnique({ where: { id }, include: { state: true } })
      .catch(() => null);
    if (district?.name) {
      if (reporterLevel === 'CONSTITUENCY') return [district.name];

      const parts = [district.name];
      if (district.state?.name) parts.push(district.state.name);
      return parts;
    }

    const state = await (prisma as any).state.findUnique({ where: { id } }).catch(() => null);
    if (state?.name) return [state.name];

    return [];
  }

  const parts: string[] = [];
  if (reporterLevel === 'CONSTITUENCY' && (reporter as any).constituencyId) {
    const resolved = await resolveLocationPartsFromFlexibleId(String((reporter as any).constituencyId));
    if (resolved.length) parts.push(...resolved);
  } else if (reporterLevel === 'ASSEMBLY' && (reporter as any).assemblyConstituency?.name) {
    parts.push((reporter as any).assemblyConstituency.name);
    if (derivedDistrict?.name) parts.push(derivedDistrict.name);
    if (derivedState?.name) parts.push(derivedState.name);
  } else if (includeMandalInWorkPlace && (reporter as any).mandal?.name) {
    parts.push((reporter as any).mandal.name);
    if (derivedDistrict?.name) parts.push(derivedDistrict.name);
    if (derivedState?.name) parts.push(derivedState.name);
  } else if (derivedDistrict?.name) {
    parts.push(derivedDistrict.name);
    if (derivedState?.name) parts.push(derivedState.name);
  } else if (derivedState?.name) {
    parts.push(derivedState.name);
  }

  let placeOfWork: string | null = parts.join(', ').replace(/\s+/g, ' ').trim() || null;

  // Fallback for newer hierarchy fields that may contain IDs of Mandal/Assembly/District/State
  // even if legacy relations are empty.
  if (!placeOfWork) {
    const fallbackIds = [(reporter as any).divisionId].filter(Boolean);
    for (const fid of fallbackIds) {
      const resolvedParts = await resolveLocationPartsFromFlexibleId(String(fid));
      if (resolvedParts.length) {
        placeOfWork = resolvedParts.join(', ').replace(/\s+/g, ' ').trim() || null;
        break;
      }
    }
  }

  // Prefer reporter.profilePhotoUrl; else try UserProfile.profilePhotoUrl
  let photoUrl: string | null = reporter.profilePhotoUrl || null;
  if (!photoUrl && reporter.userId) {
    const profile = await (prisma as any).userProfile.findUnique({ where: { userId: reporter.userId } }).catch(() => null);
    photoUrl = profile?.profilePhotoUrl || null;
  }

  const issuedAtIso: string = new Date(reporter.idCard.issuedAt).toISOString();
  const expiresAtIso: string = new Date(reporter.idCard.expiresAt).toISOString();
  const issuedAtDate = new Date(reporter.idCard.issuedAt);
  const expires = new Date(reporter.idCard.expiresAt);
  const validityLabel = `Valid up to ${String(expires.getUTCDate()).padStart(2, '0')}-${String(expires.getUTCMonth() + 1).padStart(2, '0')}-${expires.getUTCFullYear()}`;

  const data: CardData = {
    tenant: {
      name: tenant?.name,
      frontLogoUrl: settings?.frontLogoUrl || null,
      roundStampUrl: settings?.roundStampUrl || null,
      signUrl: settings?.signUrl || null,
      primaryColor: settings?.primaryColor || null,
      secondaryColor: settings?.secondaryColor || null,
      officeAddress: settings?.officeAddress || null,
      helpLine1: settings?.helpLine1 || null,
      helpLine2: settings?.helpLine2 || null,
      terms: (settings?.termsJson as string[] | null) || null,
      prgiNumber: entity?.prgiNumber || tenant?.prgiNumber || null
    },
    reporter: {
      id: reporter.id,
      fullName: await (async () => {
        if (reporter.userId) {
          const p = await (prisma as any).userProfile.findUnique({ where: { userId: reporter.userId } }).catch(() => null);
          return p?.fullName || null;
        }
        return null;
      })(),
      designation: reporter.designation?.name || null,
      placeOfWork,
      mobile: reporter.user?.mobileNumber || null,
      photoUrl,
      cardNumber: formatIdCardNumber(reporter.idCard.cardNumber, issuedAtDate),
      issuedAt: issuedAtIso,
      expiresAt: expiresAtIso,
      validityLabel,
      qrCodeUrl: domainBase ? `${domainBase}/api/public/idcard?reporterId=${encodeURIComponent(reporter.id)}` : null
    }
  };
  return data;
}

async function toDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15_000,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
      validateStatus: (s) => s >= 200 && s < 300
    });
    const ct = (res.headers && (res.headers['content-type'] as string)) || 'image/png';
    const base64 = Buffer.from(res.data).toString('base64');
    return `data:${ct};base64,${base64}`;
  } catch {
    return null;
  }
}

function normalizeHttpUrl(url?: string | null): string {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.startsWith('data:')) return s;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('//')) return `https:${s}`;
  // If it's a bare domain/path like "example.com/x", assume https.
  if (/^[^\s/]+\.[^\s]+/.test(s)) return `https://${s}`;
  return s;
}

function resolveChromeExecutablePath(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN;
  // Only use envPath if it's actually present; otherwise allow Puppeteer
  // to fall back to its bundled/browser-cache executable.
  const candidates = [
    // Env override (only if it exists)
    envPath,
    // Common Linux paths
    process.platform === 'linux' ? '/usr/bin/chromium' : undefined,
    process.platform === 'linux' ? '/usr/bin/chromium-browser' : undefined,
    process.platform === 'linux' ? '/usr/bin/google-chrome-stable' : undefined,
    process.platform === 'linux' ? '/usr/bin/google-chrome' : undefined
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }

  // Important: Puppeteer also reads executablePath from environment variables.
  // If a service accidentally sets PUPPETEER_EXECUTABLE_PATH/CHROME_BIN to a
  // non-existent path (common on Render native), Puppeteer will keep failing
  // even if we don't pass executablePath. So we defensively unset them.
  if (envPath) {
    try {
      const exists = fs.existsSync(envPath);
      if (!exists) {
        delete process.env.PUPPETEER_EXECUTABLE_PATH;
        delete process.env.CHROME_BIN;
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

async function resolvePuppeteerLaunchOptions(puppeteer: any): Promise<{ args: string[]; headless: any; defaultViewport?: any; executablePath?: string }> {
  // Prefer an explicit, existing system chrome path if provided.
  const systemExecutablePath = resolveChromeExecutablePath();

  // If we're using full Puppeteer (not core), prefer its bundled executable.
  // This is especially important on macOS/Windows where @sparticuz/chromium is not applicable.
  const puppeteerBundledPath = (() => {
    try {
      const p = typeof puppeteer?.executablePath === 'function' ? String(puppeteer.executablePath()) : undefined;
      if (p && fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
    return undefined;
  })();

  // If no system/bundled path exists, try @sparticuz/chromium (Linux/serverless only).
  let chromium: any;
  try {
    chromium = process.platform === 'linux' ? require('@sparticuz/chromium') : undefined;
  } catch {
    chromium = undefined;
  }

  const baseArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

  if (systemExecutablePath) {
    return {
      args: baseArgs,
      headless: 'new',
      executablePath: systemExecutablePath
    };
  }

  if (puppeteerBundledPath) {
    return {
      args: baseArgs,
      headless: 'new',
      executablePath: puppeteerBundledPath
    };
  }

  if (chromium) {
    const chromiumExecPath = await chromium.executablePath();
    const args = Array.from(new Set([...(chromium.args || []), ...baseArgs]));
    return {
      args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
      executablePath: chromiumExecPath
    };
  }

  // Last resort: rely on Puppeteer defaults.
  return {
    args: baseArgs,
    headless: 'new'
  };
}

async function inlineAssetsForPdf(data: CardData): Promise<CardData & { __inline?: { logo?: string | null; photo?: string | null; stamp?: string | null; sign?: string | null; qrImg?: string | null } }> {
  const qrTarget = (data as any).qrTargetUrl || data.reporter.qrCodeUrl || '';
  const qrImgUrl = qrTarget ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTarget)}` : '';
  const [logo, photo, stamp, sign, qrImg] = await Promise.all([
    toDataUrl(normalizeHttpUrl((data as any).frontLogoUrl || data.tenant.frontLogoUrl || '')),
    toDataUrl(normalizeHttpUrl(data.reporter.photoUrl || '')),
    toDataUrl(normalizeHttpUrl(data.tenant.roundStampUrl || '')),
    toDataUrl(normalizeHttpUrl(data.tenant.signUrl || '')),
    toDataUrl(normalizeHttpUrl(qrImgUrl || ''))
  ]);
  return Object.assign({}, data, { __inline: { logo, photo, stamp, sign, qrImg } });
}

function buildIdCardHtml(data: CardData, opts?: { print?: boolean }): string {
  const primary = data.tenant.primaryColor || '#153e82'; // dynamic blue
  const fixedRed = '#d71f1f'; // fixed red
  const secondary = data.tenant.secondaryColor || fixedRed;
  const inline = (data as any).__inline || {};
  const isPdfStrict = !!(opts && opts.print) && !!(data as any).__pdfNoExternalAssets;
  const logo = isPdfStrict ? (inline.logo || '') : (inline.logo ?? normalizeHttpUrl(((data as any).frontLogoUrl || data.tenant.frontLogoUrl || '')));
  const sign = isPdfStrict ? (inline.sign || '') : (inline.sign ?? normalizeHttpUrl((data.tenant.signUrl || '')));
  const stamp = isPdfStrict ? (inline.stamp || '') : (inline.stamp ?? normalizeHttpUrl((data.tenant.roundStampUrl || '')));
  const photo = isPdfStrict ? (inline.photo || '') : (inline.photo ?? normalizeHttpUrl((data.reporter.photoUrl || '')));
  const office = data.tenant.officeAddress || '';
  const help1 = data.tenant.helpLine1 || '';
  const help2 = data.tenant.helpLine2 || '';
  const prgi = data.tenant.prgiNumber || '';
  const qrTarget = (data as any).qrTargetUrl || data.reporter.qrCodeUrl || '';
  const qrImg = isPdfStrict
    ? (inline.qrImg || '')
    : (inline.qrImg ?? (qrTarget ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTarget)}` : ''));
  const validDate = (() => {
    const d = data.reporter.expiresAt ? new Date(data.reporter.expiresAt) : null;
    if (!d || isNaN(d.getTime())) return '-';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yy = d.getUTCFullYear();
    return `${dd}-${mm}-${yy}`;
  })();

  const print = !!(opts && opts.print);

  if (print) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Press ID Card — Print</title>
  <style>
    @page { size: 54mm 85.6mm; margin: 0; }
    :root{--card-w:54mm;--card-h:85.6mm}
    html,body{height:100%;margin:0;background:#fff;font-family:Inter, Arial, sans-serif}
    .card{width:var(--card-w);height:var(--card-h);background:#fff;position:relative;overflow:hidden}
    .page-break{page-break-after: always;}
    /* FRONT */
    .front .top-logo{width:100%;padding-top:2mm;display:flex;justify-content:center;align-items:center}
    .front .top-logo img{max-width:40mm;max-height:8mm}
    .front .press-bar{margin-top:3mm;width:100%;background:${secondary};height:8mm;display:flex;justify-content:center;align-items:center}
    .front .press-bar h1{margin:0;color:#fff;font-size:5mm;font-weight:700;font-family:'Archivo Black', sans-serif}
    .front .main{padding:3mm 3mm}
    .front .photo-qr{display:flex;gap:3mm}
    .front .photo{position:relative;width:20mm;height:25mm;border-radius:3px;overflow:visible;background:#f2f2f2}
    .front .photo img{width:100%;height:100%;object-fit:cover;object-position:center}
    .front .qr{width:20mm;height:20mm;background:#fff}
    .front .qr img{width:100%;height:100%;object-fit:contain}
    .front .details{margin-top:4mm;font-size:2.2mm}
    .front .details table{width:100%;border-collapse:collapse}
    .front .details td{padding:0.2mm 0;line-height:1.5}
    .front .details .label{width:15mm;font-weight:700}
    .front .details .colon{width:2mm;text-align:center}
    .front .details .value{width:auto}
    .front .signature{position:absolute;right:2mm;bottom:9mm;width:18mm;z-index:2;text-align:center}
    .front .signature img{width:100%;display:block}
    .front .signature .sig-line{height:0.35mm;background:rgba(0,0,0,0.35);margin:4.2mm auto 0 auto;width:16mm}
    .front .signature .sig-label{margin-top:0.8mm;font-size:1.6mm;font-weight:800;color:#111;letter-spacing:0.2px}
    .front .photo .stamp{position:absolute;right:-1mm;bottom:-1mm;width:11mm;height:11mm;pointer-events:none;opacity:0.95}
    .front .photo .stamp img{width:100%;height:100%;object-fit:contain}
    .front .footer{position:absolute;left:0;right:0;bottom:0;background:${primary};height:7mm;color:#fff;display:flex;justify-content:center;align-items:center;font-size:2.5mm;font-weight:700;z-index:1}
    /* BACK */
    .back .header{height:12mm;background:${primary};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 3mm;box-sizing:border-box}
    .back .header h1{font-family:'Archivo Black',sans-serif;font-size:6.5mm;margin:0;line-height:1}
    .back .header p{margin:2px 0 0;font-size:2.6mm;letter-spacing:1px;font-weight:700;line-height:1}
    .back .body{padding:4mm 4mm 0 4mm;box-sizing:border-box;text-align:center;display:flex;flex-direction:column;align-items:center}
    .back .qr-box{width:20mm;height:20mm;margin:1.5mm auto 2mm;background:#f3f3f3;padding:1px;display:flex;align-items:center;justify-content:center;border-radius:2px}
    .back .qr-box img{width:100%;height:100%;object-fit:contain;display:block}
    .back .address{color:#000;font-size:3.2mm;line-height:1.15;margin-top:2mm;text-align:center}
    .back .address .heading{font-weight:700;font-size:3mm;margin-bottom:1.5px}
    .back .address .lines{white-space:pre-line;font-size:2mm;line-height:1.05}
    .back .contact{margin-top:1.5px;font-size:2mm}
    .back .prgi{position:absolute;left:0;right:0;bottom:22mm;color:#000;font-weight:700;font-size:3.4mm;text-align:center}
    .back .footer{position:absolute;left:0;right:0;bottom:0;height:22mm;background:${primary};color:#fff;padding:4px 3mm;box-sizing:border-box;font-size:1mm}
    .back .footer strong{display:block;text-align:center;margin-bottom:3px;font-size:2.6mm}
    .back .footer ol{margin:0;padding-left:0;padding-right:0;text-align:justify;line-height:1.05}
    .back .footer li{margin-bottom:3px}
  </style>
</head>
<body>
  <!-- FRONT PAGE -->
  <div class="card front">
    <div class="top-logo">${logo ? `<img src="${logo}" alt="logo" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}</div>
    <div class="press-bar"><h1>PRINT MEDIA</h1></div>
    <div class="main">
      <div class="photo-qr">
        <div class="photo">${photo ? `<img src="${photo}" alt="photo" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}
        ${stamp ? `<div class="stamp"><img src="${stamp}" alt="stamp" crossorigin="anonymous" referrerpolicy="no-referrer"/></div>` : ''}
        </div>
        <div class="qr">${qrImg ? `<img src="${qrImg}" alt="qr" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}</div>
      </div>
      <div class="details">
        <table>
          <tr><td class="label">Name</td><td class="colon">:</td><td class="value">${data.reporter.fullName || '-'}</td></tr>
          <tr><td class="label">ID Number</td><td class="colon">:</td><td class="value">${(data.reporter.cardNumber || '').toUpperCase() || '-'}</td></tr>
          <tr><td class="label">Desig</td><td class="colon">:</td><td class="value">${data.reporter.designation || '-'}</td></tr>
          <tr><td class="label">Work Place</td><td class="colon">:</td><td class="value">${data.reporter.placeOfWork || '-'}</td></tr>
          <tr><td class="label">Phone</td><td class="colon">:</td><td class="value">${data.reporter.mobile || '-'}</td></tr>
          <tr><td class="label">Valid</td><td class="colon">:</td><td class="value">${validDate}</td></tr>
        </table>
      </div>
    </div>
    <div class="signature">
      ${sign ? `<img src="${sign}" alt="signature" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : `<div class="sig-line"></div>`}
      <div class="sig-label">Authorized Signature</div>
    </div>
    <div class="footer">PRGI No : ${prgi || '-'}</div>
  </div>
  <div class="page-break"></div>
  <!-- BACK PAGE -->
  <div class="card back">
    <div class="header"><h1>PRESS</h1><p>REPORTER ID CARD</p></div>
    <div class="body">
      <div class="qr-box">${qrImg ? `<img src="${qrImg}" alt="qr" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}</div>
      ${office ? `<div class="address"><div class="heading">ADDRESS</div><div class="lines">${office}</div>${(help1||help2||data.reporter.mobile) ? `<div class="contact">Contact No: <span>${[data.reporter.mobile, help1, help2].filter(Boolean)[0] || ''}</span></div>` : ''}</div>` : ''}
      ${prgi ? `<div class="prgi">PRGI No : ${prgi}</div>` : ''}
    </div>
    <div class="footer">
      <strong>Terms & Conditions</strong>
      <ol>
        <li>Non-Transferable: The card is strictly for the named individual and must not be loaned, shared, or transferred to any other person.</li>
        <li>Valid for Professional Use Only: It must be used solely for legitimate journalistic activities, news gathering, or official media representation.</li>
        <li>Immediate Surrender Upon Request/Termination: The card must be immediately returned to the issuing organization upon expiration, termination of employment/affiliation, or if explicitly requested.</li>
        <li>Adherence to Law and Ethics: The cardholder must comply with all applicable local, state, and federal laws, as well as established journalistic ethics, while using the card.</li>
        <li>Subject to Verification: The card's validity and the holder's identity are subject to random verification by authorities or the issuing body at any time.</li>
      </ol>
    </div>
  </div>
</body>
</html>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Press ID Card — Style 1</title>
  <style>
    :root{--card-w:54mm;--card-h:85.6mm}
    html,body{height:100%;margin:0;background:#f2f4f7;font-family:Inter, Arial, sans-serif}
    .page{display:flex;gap:12mm;justify-content:center;align-items:flex-start;padding:10mm}
    .card{width:var(--card-w);height:var(--card-h);background:#fff;box-shadow:0 6px 18px rgba(0,0,0,0.10);position:relative;overflow:hidden;border-radius:2mm}
    /* FRONT */
    .front .top-logo{width:100%;padding-top:2mm;display:flex;justify-content:center;align-items:center}
    .front .top-logo img{max-width:40mm;max-height:8mm}
    .front .press-bar{margin-top:3mm;width:100%;background:${secondary};height:8mm;display:flex;justify-content:center;align-items:center}
    .front .press-bar h1{margin:0;color:#fff;font-size:5mm;font-weight:700;font-family:'Archivo Black', sans-serif}
    .front .main{padding:3mm 3mm}
    .front .photo-qr{display:flex;gap:3mm}
    .front .photo{position:relative;width:20mm;height:25mm;border-radius:3px;overflow:visible;background:#f2f2f2}
    .front .photo img{width:100%;height:100%;object-fit:cover;object-position:center}
    .front .qr{width:20mm;height:20mm;background:#fff}
    .front .qr img{width:100%;height:100%;object-fit:contain}
    .front .details{margin-top:4mm;font-size:2.2mm}
    .front .details table{width:100%;border-collapse:collapse}
    .front .details td{padding:0.2mm 0;line-height:1.5}
    .front .details .label{width:15mm;font-weight:700}
    .front .details .colon{width:2mm;text-align:center}
    .front .details .value{width:auto}
    .front .signature{position:absolute;right:2mm;bottom:9mm;width:18mm;z-index:2;text-align:center}
    .front .signature img{width:100%;display:block}
    .front .signature .sig-line{height:0.35mm;background:rgba(0,0,0,0.35);margin:4.2mm auto 0 auto;width:16mm}
    .front .signature .sig-label{margin-top:0.8mm;font-size:1.6mm;font-weight:800;color:#111;letter-spacing:0.2px}
    /* Stamp overlay anchored to photo bottom-right */
    .front .photo .stamp{position:absolute;right:-1mm;bottom:-1mm;width:11mm;height:11mm;pointer-events:none;opacity:0.95}
    .front .photo .stamp img{width:100%;height:100%;object-fit:contain}
    .front .footer{position:absolute;left:0;right:0;bottom:0;background:${primary};height:7mm;color:#fff;display:flex;justify-content:center;align-items:center;font-size:2.5mm;font-weight:700;z-index:1}
    /* BACK */
    .back .header{height:12mm;background:${primary};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 3mm;box-sizing:border-box}
    .back .header h1{font-family:'Archivo Black',sans-serif;font-size:6.5mm;margin:0;line-height:1}
    .back .header p{margin:2px 0 0;font-size:2.6mm;letter-spacing:1px;font-weight:700;line-height:1}
    .back .body{padding:4mm 4mm 0 4mm;box-sizing:border-box;text-align:center;display:flex;flex-direction:column;align-items:center}
    .back .qr-box{width:20mm;height:20mm;margin:1.5mm auto 2mm;background:#f3f3f3;padding:1px;display:flex;align-items:center;justify-content:center;border-radius:2px}
    .back .qr-box img{width:100%;height:100%;object-fit:contain;display:block}
    .back .address{color:#000;font-size:3.2mm;line-height:1.15;margin-top:2mm;text-align:center}
    .back .address .heading{font-weight:700;font-size:3mm;margin-bottom:1.5px}
    .back .address .lines{white-space:pre-line;font-size:2mm;line-height:1.05}
    .back .contact{margin-top:1.5px;font-size:2mm}
    .back .prgi{position:absolute;left:0;right:0;bottom:22mm;color:#000;font-weight:700;font-size:3.4mm;text-align:center}
    .back .footer{position:absolute;left:0;right:0;bottom:0;height:22mm;background:${primary};color:#fff;padding:4px 3mm;box-sizing:border-box;font-size:1mm}
    .back .footer strong{display:block;text-align:center;margin-bottom:3px;font-size:2.6mm}
    .back .footer ol{margin:0;padding-left:0;padding-right:0;text-align:justify;line-height:1.05}
    .back .footer li{margin-bottom:3px}
  </style>
</head>
<body>
  <div class="page">
    <!-- FRONT -->
    <div class="card front">
      <div class="top-logo">${logo ? `<img src="${logo}" alt="logo" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}</div>
      <div class="press-bar"><h1>PRINT MEDIA</h1></div>
      <div class="main">
        <div class="photo-qr">
          <div class="photo">${photo ? `<img src="${photo}" alt="photo" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}
          ${stamp ? `<div class="stamp"><img src="${stamp}" alt="stamp" crossorigin="anonymous" referrerpolicy="no-referrer"/></div>` : ''}
          </div>
          <div class="qr">${qrImg ? `<img src="${qrImg}" alt="qr" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}</div>
        </div>
        <div class="details">
          <table>
            <tr><td class="label">Name</td><td class="colon">:</td><td class="value">${data.reporter.fullName || '-'}</td></tr>
            <tr><td class="label">ID Number</td><td class="colon">:</td><td class="value">${(data.reporter.cardNumber || '').toUpperCase() || '-'}</td></tr>
            <tr><td class="label">Desig</td><td class="colon">:</td><td class="value">${data.reporter.designation || '-'}</td></tr>
            <tr><td class="label">Work Place</td><td class="colon">:</td><td class="value">${data.reporter.placeOfWork || '-'}</td></tr>
            <tr><td class="label">Phone</td><td class="colon">:</td><td class="value">${data.reporter.mobile || '-'}</td></tr>
            <tr><td class="label">Valid</td><td class="colon">:</td><td class="value">${validDate}</td></tr>
          </table>
        </div>
      </div>
      <div class="signature">
        ${sign ? `<img src="${sign}" alt="signature" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : `<div class="sig-line"></div>`}
        <div class="sig-label">Authorized Signature</div>
      </div>
      <div class="footer">PRGI No : ${prgi || '-'}</div>
    </div>

    <!-- BACK -->
    <div class="card back">
      <div class="header"><h1>PRESS</h1><p>REPORTER ID CARD</p></div>
      <div class="body">
        <div class="qr-box">${qrImg ? `<img src="${qrImg}" alt="qr" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}</div>
        ${office ? `<div class="address"><div class="heading">ADDRESS</div><div class="lines">${office}</div>${(help1||help2||data.reporter.mobile) ? `<div class="contact">Contact No: <span>${[data.reporter.mobile, help1, help2].filter(Boolean)[0] || ''}</span></div>` : ''}</div>` : ''}
        ${prgi ? `<div class="prgi">PRGI No : ${prgi}</div>` : ''}
      </div>
      <div class="footer">
        <strong>Terms & Conditions</strong>
        <ol>
          <li>Non-Transferable: The card is strictly for the named individual and must not be loaned, shared, or transferred to any other person.</li>
          <li>Valid for Professional Use Only: It must be used solely for legitimate journalistic activities, news gathering, or official media representation.</li>
          <li>Immediate Surrender Upon Request/Termination: The card must be immediately returned to the issuing organization upon expiration, termination of employment/affiliation, or if explicitly requested.</li>
          <li>Adherence to Law and Ethics: The cardholder must comply with all applicable local, state, and federal laws, as well as established journalistic ethics, while using the card.</li>
          <li>Subject to Verification: The card's validity and the holder's identity are subject to random verification by authorities or the issuing body at any time.</li>
        </ol>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * @swagger
 * /id-cards/json:
 *   get:
 *     summary: Public - Get ID card JSON data
 *     description: Fetch reporter ID card data by reporterId OR mobile OR fullName. One of these query params is required.
 *     tags: [ID Cards]
 *     parameters:
 *       - in: query
 *         name: reporterId
 *         schema: { type: string }
 *       - in: query
 *         name: mobile
 *         schema: { type: string }
 *       - in: query
 *         name: fullName
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Card JSON data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tenant: { type: object }
 *                 reporter: { type: object }
 *       400: { description: Validation error }
 *       404: { description: Reporter or ID card not found }
 */
router.get('/json', async (req, res) => {
  try {
    const reporterId = req.query.reporterId ? String(req.query.reporterId) : undefined;
    const mobile = req.query.mobile ? String(req.query.mobile) : undefined;
    const fullName = req.query.fullName ? String(req.query.fullName) : undefined;
    const debug = ['1', 'true', 'yes'].includes(String(req.query.debug || '').toLowerCase());
    if (!reporterId && !mobile && !fullName) {
      return res.status(400).json({ error: 'Provide reporterId or mobile or fullName' });
    }
    const reporter = await resolveReporterByQuery({ reporterId, mobile, fullName });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });
    const data = await buildIdCardData(reporter.id);
    if (!data) return res.status(404).json({ error: 'ID card not found for reporter' });
    // convenience top-level fields expected by Style1 template
    const qrTargetUrl = data.reporter.qrCodeUrl || null;
    const qrCodeUrl = qrTargetUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTargetUrl)}` : null;
    const out = {
      ...data,
      officeAddress: data.tenant.officeAddress || null,
      prgiNumber: data.tenant.prgiNumber || null,
      primaryColor: data.tenant.primaryColor || '#153e82',
      frontLogoUrl: data.tenant.frontLogoUrl || null,
      qrTargetUrl,
      qrCodeUrl,
      ...(debug
        ? {
            debugReporter: {
              id: reporter.id,
              level: (reporter as any).level || null,
              tenantId: (reporter as any).tenantId || null,
              stateId: (reporter as any).stateId || null,
              districtId: (reporter as any).districtId || null,
              mandalId: (reporter as any).mandalId || null,
              assemblyConstituencyId: (reporter as any).assemblyConstituencyId || null,
              constituencyId: (reporter as any).constituencyId || null,
              divisionId: (reporter as any).divisionId || null,
            }
          }
        : null)
    };
    res.json(out);
  } catch (e) {
    console.error('id-cards/json error', e);
    res.status(500).json({ error: 'Failed to fetch ID card JSON' });
  }
});

/**
 * @swagger
 * /id-cards/html:
 *   get:
 *     summary: Public - Get ID card HTML view (Style 1)
 *     description: Fetch reporter ID card HTML by reporterId OR mobile OR fullName. One of these query params is required.
 *     tags: [ID Cards]
 *     parameters:
 *       - in: query
 *         name: reporterId
 *         schema: { type: string }
 *       - in: query
 *         name: mobile
 *         schema: { type: string }
 *       - in: query
 *         name: fullName
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: HTML view
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       400: { description: Validation error }
 *       404: { description: Reporter or ID card not found }
 */
router.get('/html', async (req, res) => {
  try {
    const reporterId = req.query.reporterId ? String(req.query.reporterId) : undefined;
    const mobile = req.query.mobile ? String(req.query.mobile) : undefined;
    const fullName = req.query.fullName ? String(req.query.fullName) : undefined;
    if (!reporterId && !mobile && !fullName) {
      return res.status(400).send('Provide reporterId or mobile or fullName');
    }
    const reporter = await resolveReporterByQuery({ reporterId, mobile, fullName });
    if (!reporter) return res.status(404).send('Reporter not found');
    const data = await buildIdCardData(reporter.id);
    if (!data) return res.status(404).send('ID card not found for reporter');
    const printMode = ['1','true','yes','print'].includes(String((req.query.print || req.query.mode || '')).toLowerCase());
    const html = buildIdCardHtml(data, { print: printMode });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Allow cross-origin images (logo, stamp, sign, QR) to load in browser
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(html);
  } catch (e) {
    console.error('id-cards/html error', e);
    res.status(500).send('Failed to fetch ID card HTML');
  }
});

/**
 * @swagger
 * /id-cards/pdf:
 *   get:
 *     summary: Public - Download ID card PDF
 *     description: Fetch reporter ID card PDF by reporterId OR mobile OR fullName. One of these query params is required. Set `print=true` (or `mode=print`) to get a print-ready PDF with two pages (front/back), each sized to the card (54mm x 85.6mm).
 *     tags: [ID Cards]
 *     parameters:
 *       - in: query
 *         name: reporterId
 *         schema: { type: string }
 *       - in: query
 *         name: mobile
 *         schema: { type: string }
 *       - in: query
 *         name: fullName
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400: { description: Validation error }
 *       404: { description: Reporter or ID card not found }
 */
router.get('/pdf', async (req, res) => {
  try {
    const reporterId = req.query.reporterId ? String(req.query.reporterId) : undefined;
    const mobile = req.query.mobile ? String(req.query.mobile) : undefined;
    const fullName = req.query.fullName ? String(req.query.fullName) : undefined;
    const forceRender = String(req.query.forceRender || '').toLowerCase() === 'true';
    if (!reporterId && !mobile && !fullName) {
      return res.status(400).json({ error: 'Provide reporterId or mobile or fullName' });
    }
    const reporter = await resolveReporterByQuery({ reporterId, mobile, fullName });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    // 1) Preferred path: if a PDF was already generated and stored (Bunny URL), serve that.
    // This matches the WhatsApp-sent PDF and avoids layout mismatches.
    if (!forceRender) {
      try {
        const rec = await (prisma as any).reporterIDCard.findUnique({
          where: { reporterId: reporter.id },
          select: { pdfUrl: true, cardNumber: true }
        });
        const storedUrl = rec?.pdfUrl ? String(rec.pdfUrl) : '';
        if (storedUrl) {
          const fileName = `ID_CARD_${rec?.cardNumber || reporter.id}.pdf`;
          const resp = await axios.get(storedUrl, { responseType: 'arraybuffer', timeout: 30_000 });
          const pdfBuffer = Buffer.from(resp.data);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Length', pdfBuffer.length.toString());
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          return res.status(200).end(pdfBuffer);
        }
      } catch (e) {
        console.error('id-cards/pdf fetch stored pdfUrl failed', {
          reporterId: reporter.id,
          err: (e as any)?.stack || (e as any)?.message || e
        });
      }
    }

    // 2) Fallback: generate on the fly using the locked Puppeteer template
    const result = await generateIdCardPdfBuffer(reporter.id);
    if (!result.ok || !result.pdfBuffer) {
      return res.status(500).json({ error: result.error || 'Failed to generate PDF' });
    }

    const pdfBuffer = result.pdfBuffer;
    const fileName = `ID_CARD_${result.cardNumber || reporter.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).end(pdfBuffer);
  } catch (e) {
    console.error('id-cards/pdf error', {
      reporterId: req.query.reporterId,
      mobile: req.query.mobile,
      fullName: req.query.fullName,
      err: (e as any)?.stack || (e as any)?.message || e
    });
    res.status(500).json({ error: 'Failed to generate ID card PDF' });
  }
});

export default router;
