import { Router } from 'express';
import prisma from '../../lib/prisma';
import axios from 'axios';
import fs from 'fs';

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
      user: true
    }
  });
  if (!reporter || !reporter.idCard) return null;

  const tenant = await (prisma as any).tenant.findUnique({ where: { id: reporter.tenantId } });
  const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId: reporter.tenantId } });
  const entity = await (prisma as any).tenantEntity.findUnique({ where: { tenantId: reporter.tenantId } }).catch(() => null);
  const primaryDomainRec = await (prisma as any).domain.findFirst({ where: { tenantId: reporter.tenantId, status: 'ACTIVE', isPrimary: true } }).catch(()=>null);
  const anyDomainRec = primaryDomainRec || await (prisma as any).domain.findFirst({ where: { tenantId: reporter.tenantId, status: 'ACTIVE' } }).catch(()=>null);
  const domainBase = anyDomainRec?.domain ? `https://${anyDomainRec.domain}` : null;

  // Resolve place of work names (state/district/mandal)
  let placeOfWork: string | null = null;
  const parts: string[] = [];
  if (reporter.stateId) {
    const s = await (prisma as any).state.findUnique({ where: { id: reporter.stateId } }).catch(() => null);
    if (s?.name) parts.push(s.name);
  }
  if (reporter.districtId) {
    const d = await (prisma as any).district.findUnique({ where: { id: reporter.districtId } }).catch(() => null);
    if (d?.name) parts.push(d.name);
  }
  if (reporter.mandalId) {
    const m = await (prisma as any).mandal.findUnique({ where: { id: reporter.mandalId } }).catch(() => null);
    if (m?.name) parts.push(m.name);
  }
  placeOfWork = parts.length ? parts.join(', ') : null;

  // Prefer reporter.profilePhotoUrl; else try UserProfile.profilePhotoUrl
  let photoUrl: string | null = reporter.profilePhotoUrl || null;
  if (!photoUrl && reporter.userId) {
    const profile = await (prisma as any).userProfile.findUnique({ where: { userId: reporter.userId } }).catch(() => null);
    photoUrl = profile?.profilePhotoUrl || null;
  }

  const issuedAtIso: string = new Date(reporter.idCard.issuedAt).toISOString();
  const expiresAtIso: string = new Date(reporter.idCard.expiresAt).toISOString();
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
      cardNumber: reporter.idCard.cardNumber,
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
  return undefined;
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
    .front .signature{position:absolute;right:2mm;bottom:5mm;width:15mm}
    .front .signature img{width:100%}
    .front .photo .stamp{position:absolute;right:-1mm;bottom:-1mm;width:11mm;height:11mm;pointer-events:none;opacity:0.95}
    .front .photo .stamp img{width:100%;height:100%;object-fit:contain}
    .front .footer{position:absolute;left:0;right:0;bottom:0;background:${primary};height:7mm;color:#fff;display:flex;justify-content:center;align-items:center;font-size:2.5mm;font-weight:700}
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
    <div class="signature">${sign ? `<img src="${sign}" alt="signature" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}</div>
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
    .front .signature{position:absolute;right:2mm;bottom:5mm;width:15mm}
    .front .signature img{width:100%}
    /* Stamp overlay anchored to photo bottom-right */
    .front .photo .stamp{position:absolute;right:-1mm;bottom:-1mm;width:11mm;height:11mm;pointer-events:none;opacity:0.95}
    .front .photo .stamp img{width:100%;height:100%;object-fit:contain}
    .front .footer{position:absolute;left:0;right:0;bottom:0;background:${primary};height:7mm;color:#fff;display:flex;justify-content:center;align-items:center;font-size:2.5mm;font-weight:700}
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
      <div class="signature">${sign ? `<img src="${sign}" alt="signature" crossorigin="anonymous" referrerpolicy="no-referrer"/>` : ''}</div>
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
      qrCodeUrl
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
    if (!reporterId && !mobile && !fullName) {
      return res.status(400).json({ error: 'Provide reporterId or mobile or fullName' });
    }
    const reporter = await resolveReporterByQuery({ reporterId, mobile, fullName });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });
    let data = await buildIdCardData(reporter.id);
    if (!data) return res.status(404).json({ error: 'ID card not found for reporter' });
    // Inline external images as data URIs to ensure Puppeteer loads them
    try {
      data = await inlineAssetsForPdf(data);
    } catch (e) {
      console.error('id-cards/pdf asset inlining failed', {
        reporterId: reporter.id,
        err: (e as any)?.stack || (e as any)?.message || e
      });
    }

    // For PDF rendering, avoid external network fetches inside Chromium.
    (data as any).__pdfNoExternalAssets = true;

    const html = buildIdCardHtml(data, { print: true });
    let puppeteer: any;
    try {
      puppeteer = require('puppeteer');
    } catch (_e) {
      return res.status(500).json({ error: 'PDF rendering library not installed (puppeteer)' });
    }

    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    const executablePath = resolveChromeExecutablePath();

    let browser: any;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: launchArgs,
        executablePath
      });
    } catch (e) {
      console.error('id-cards/pdf puppeteer.launch failed', {
        reporterId: reporter.id,
        nodeEnv: process.env.NODE_ENV,
        executablePath,
        executablePathExists: executablePath ? (() => { try { return fs.existsSync(executablePath); } catch { return false; } })() : false,
        err: (e as any)?.stack || (e as any)?.message || e
      });
      return res.status(500).json({ error: 'Failed to start PDF renderer' });
    }
    const page = await browser.newPage();
    try { await page.setDefaultNavigationTimeout(30_000); } catch {}
    try { await page.setBypassCSP(true); } catch {}
    try { await page.emulateMediaType('screen'); } catch {}
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (e) {
      console.error('id-cards/pdf page.setContent failed', {
        reporterId: reporter.id,
        err: (e as any)?.stack || (e as any)?.message || e
      });
      await browser.close();
      return res.status(500).json({ error: 'Failed to prepare PDF content' });
    }
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await page.pdf({ width: '54mm', height: '85.6mm', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    } catch (e) {
      console.error('Puppeteer pdf() failed', e);
      await browser.close();
      return res.status(500).json({ error: 'Failed to render PDF' });
    }
    await browser.close();

    const fileName = `ID_CARD_${data.reporter.cardNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    // Force download instead of inline preview
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
