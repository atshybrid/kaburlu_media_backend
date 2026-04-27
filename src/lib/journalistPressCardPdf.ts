/**
 * Journalist Union Press Card – PDF Generator
 *
 * Credit-card size: 54 mm × 85.6 mm, two pages (front / back).
 * Designed to match reporter ID card quality:
 *   - All images inlined as base64 data URIs (no CORS during render)
 *   - Full-bleed color bars with 0.6 mm bleed on each side
 *   - pt font units, exact mm margins
 *   - Inline CSS only (no external fonts / sheets)
 *
 * Front: union logo, member photo (with stamp overlay), QR code,
 *        name, press-ID, designation, union post, newspaper,
 *        mandal · district · state, valid-till
 * Back:  union header, state president signature + union stamp,
 *        QR code (verify URL), address/contact, terms & conditions
 */

import axios from 'axios';
import QRCode from 'qrcode';
import prisma from './prisma';
import { r2Client, R2_BUCKET, getPublicUrl } from './r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface PressCardPdfResult {
  ok: boolean;
  pdfUrl?: string;
  cardNumber?: string;
  error?: string;
}

// ─── Internal data type ────────────────────────────────────────────────────────

interface PressCardData {
  profileId:      string;
  memberName:     string;
  pressId:        string | null;
  cardNumber:     string;
  issuedAt:       Date;
  expiryDate:     Date;
  renewalCount:   number;
  // Member details
  designation:    string;
  unionPost:      string | null;  /// Active union post title (e.g. "District President")
  organization:   string;
  currentNewspaper: string | null;
  mandal:         string | null;
  district:       string;
  state:          string | null;
  mobileNumber:   string | null;
  // Union branding
  unionName:      string | null;
  unionDisplayName: string | null;
  registrationNumber: string | null;
  address:        string | null;
  phone:          string | null;
  email:          string | null;
  websiteUrl:     string | null;
  // Signatory (shown on all cards)
  signatoryName:  string | null;  // e.g. "T. Arunkumar"
  signatoryTitle: string | null;  // e.g. "Founder & National President"
  // Asset URLs
  photoUrl:       string | null;
  unionLogoUrl:   string | null;
  stampImageUrl:  string | null;
  forStampImageUrl: string | null;
  presidentSignatureUrl: string | null; // state override → falls back to founderSignatureUrl
  // Inlined data URIs (populated by inlineAssets)
  __inline?: {
    logo?:      string | null;
    photo?:     string | null;
    stamp?:     string | null;
    forStamp?:  string | null;
    signature?: string | null;
    qrFront?:   string;
    qrBack?:    string;
  };
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function esc(v: string | null | undefined): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(d: Date | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Asset fetcher ────────────────────────────────────────────────────────────

async function toDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await axios.get(url, {
      responseType: 'arraybuffer', timeout: 12_000,
      headers: { 'User-Agent': 'KaburluPressCardBot/1.0' },
    });
    const mime = ((r.headers['content-type'] as string) || 'image/png').split(';')[0].trim();
    return `data:${mime};base64,${Buffer.from(r.data).toString('base64')}`;
  } catch {
    return null;
  }
}

// ─── Data loader ──────────────────────────────────────────────────────────────

async function buildPressCardData(profileId: string): Promise<PressCardData | null> {
  const profile = await (prisma as any).journalistProfile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
      card: true,
      // Active post holdings → take the most senior (lowest sortOrder)
      postHoldings: {
        where:   { isActive: true },
        orderBy: { post: { sortOrder: 'asc' } },
        take:    1,
        include: { post: { select: { title: true, nativeTitle: true } } },
      },
    },
  });
  if (!profile || !profile.card) return null;
  const card = profile.card;

  // Load union settings + state overrides
  let settings: any = null;
  let stateSettings: any = null;
  if (profile.unionName) {
    settings = await (prisma as any).journalistUnionSettings.findUnique({
      where: { unionName: profile.unionName },
    }).catch(() => null);
    if (settings) {
      const state = profile.state || settings.primaryState || settings.states?.[0] || null;
      if (state) {
        stateSettings = await (prisma as any).journalistUnionStateSettings.findUnique({
          where: { unionName_state: { unionName: profile.unionName, state } },
        }).catch(() => null);
      }
    }
  }

  const topPost = profile.postHoldings?.[0]?.post ?? null;

  return {
    profileId,
    memberName:         profile.user?.profile?.fullName ?? 'Member',
    pressId:            profile.pressId ?? null,
    cardNumber:         card.cardNumber,
    issuedAt:           card.issuedAt ?? card.createdAt,
    expiryDate:         card.expiryDate,
    renewalCount:       card.renewalCount ?? 0,
    designation:        profile.designation ?? '',
    unionPost:          topPost?.title ?? null,
    organization:       profile.organization ?? '',
    currentNewspaper:   profile.currentNewspaper ?? null,
    mandal:             profile.mandal ?? null,
    district:           profile.district ?? '',
    state:              profile.state ?? null,
    mobileNumber:       profile.user?.mobileNumber ?? null,
    unionName:          profile.unionName ?? null,
    unionDisplayName:   settings?.displayName ?? settings?.unionName ?? null,
    registrationNumber: settings?.registrationNumber ?? null,
    address:            stateSettings?.address ?? settings?.address ?? null,
    phone:              stateSettings?.phone   ?? settings?.phone   ?? null,
    email:              stateSettings?.email   ?? settings?.email   ?? null,
    websiteUrl:         settings?.websiteUrl ?? null,
    signatoryName:          settings?.signatoryName ?? null,
    signatoryTitle:         settings?.signatoryTitle ?? null,
    photoUrl:               profile.photoUrl ?? null,
    unionLogoUrl:           settings?.idCardLogoUrl ?? settings?.logoUrl ?? null,
    stampImageUrl:          settings?.stampImageUrl ?? null,
    forStampImageUrl:       settings?.forStampImageUrl ?? null,
    // State president overrides; falls back to union-wide founder signature
    presidentSignatureUrl:  stateSettings?.presidentSignatureUrl ?? settings?.founderSignatureUrl ?? null,
  };
}

// ─── Asset inlining ───────────────────────────────────────────────────────────

async function inlineAssets(data: PressCardData): Promise<PressCardData> {
  const verifyUrl =
    `${process.env.API_BASE_URL || 'https://api.kaburlumedia.com'}/api/v1/journalist/press-card/pdf?cardNumber=${encodeURIComponent(data.cardNumber)}`;

  const [logo, photo, stamp, forStamp, signature, qrFront, qrBack] = await Promise.all([
    toDataUri(data.unionLogoUrl),
    toDataUri(data.photoUrl),
    toDataUri(data.stampImageUrl),
    toDataUri(data.forStampImageUrl),
    toDataUri(data.presidentSignatureUrl),
    QRCode.toDataURL(verifyUrl, { margin: 0, width: 260, errorCorrectionLevel: 'M' }),
    QRCode.toDataURL(verifyUrl, { margin: 0, width: 320, errorCorrectionLevel: 'M' }),
  ]);

  return { ...data, __inline: { logo, photo, stamp, forStamp, signature, qrFront, qrBack } };
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildPressCardHtml(data: PressCardData): string {
  const d    = data.__inline ?? {};
  const logo = d.logo      ?? null;
  const photo= d.photo     ?? null;
  const stamp= d.stamp     ?? null;
  const sign = d.signature ?? null;
  const qrF  = d.qrFront   ?? null;
  const qrB  = d.qrBack    ?? null;

  const navy   = '#1a237e';
  const navyM  = '#283593';   // mid navy for gradients
  const navyLt = '#e8eaf6';   // very light navy bg
  const gold   = '#c8962a';   // gold accent
  const font   = 'Arial, Helvetica, sans-serif';

  const bleedMm = 0.6;
  const fullW   = 54 + bleedMm * 2;
  const leftOff = -bleedMm;

  const paper      = esc(data.currentNewspaper || data.organization);
  const cardId     = esc(data.pressId || data.cardNumber);
  const areaLine   = [data.mandal, data.district, data.state].filter(Boolean).map(esc).join(', ');
  const unionTitle = esc(data.unionDisplayName || data.unionName || 'Journalist Union');
  const signName   = esc(data.signatoryName  || '');
  const signTitle  = esc(data.signatoryTitle || 'Authorized Signatory');

  // Subtle diagonal micro-pattern for card body (professional texture)
  const microBg = `
    repeating-linear-gradient(
      -45deg,
      transparent 0, transparent 3mm,
      rgba(26,35,126,0.025) 3mm, rgba(26,35,126,0.025) 3.3mm
    )`;

  // Indian flag tricolor stripe (saffron / white / green) — 1mm total
  const tricolor = `linear-gradient(to right,
    #ff9933 0%, #ff9933 33.3%,
    #fff    33.3%, #fff 66.6%,
    #138808 66.6%, #138808 100%)`;

  // ─── FRONT ────────────────────────────────────────────────────────────────
  const frontHtml = `
  <div style="
    width:54mm; height:85.6mm; position:relative;
    overflow:hidden; display:flex; flex-direction:column;
    font-family:${font}; -webkit-font-smoothing:antialiased;
    background:#fff; border:0.35mm solid #9fa8da;
    page-break-after:always;
  ">

    <!-- ①  HEADER: logo left + union name right, white bg -->
    <div style="
      background:#fff;
      display:flex; align-items:center; gap:1.5mm;
      padding:1.8mm 2mm 1.4mm 2mm;
      border-bottom:0.5mm solid ${navy};
      flex-shrink:0;
    ">
      ${logo
        ? `<img src="${logo}" style="height:8.5mm; width:8.5mm; object-fit:contain; flex-shrink:0; border-radius:0.5mm;"/>`
        : `<div style="
            width:8.5mm; height:8.5mm; border-radius:0.8mm;
            background:${navy}; flex-shrink:0;
            display:flex; align-items:center; justify-content:center;
           "><span style="color:#fff; font-size:6.5pt; font-weight:900; font-family:${font};">J</span></div>`
      }
      <div style="flex:1; min-width:0;">
        <div style="
          font-size:6pt; font-weight:900; color:${navy};
          text-transform:uppercase; letter-spacing:0.1mm; line-height:1.22;
          font-family:${font}; word-break:break-word;
        ">${unionTitle}</div>
        ${data.registrationNumber
          ? `<div style="font-size:3.8pt; color:#78909c; margin-top:0.2mm; font-family:${font}; letter-spacing:0.1mm;">Regd. No: ${esc(data.registrationNumber)}</div>`
          : ''}
      </div>
    </div>

    <!-- ②  TRICOLOR STRIPE 1mm -->
    <div style="height:1mm; background:${tricolor}; flex-shrink:0; width:${fullW}mm; position:relative; left:${leftOff}mm;"></div>

    <!-- ③  NAVY CARD TYPE STRIP -->
    <div style="
      background:${navy}; flex-shrink:0;
      width:${fullW}mm; position:relative; left:${leftOff}mm;
      padding:1mm 0; text-align:center;
    ">
      <span style="
        color:#fff; font-size:6.8pt; font-weight:800;
        letter-spacing:1.4mm; text-transform:uppercase; font-family:${font};
      ">JOURNALIST IDENTITY CARD</span>
    </div>

    <!-- ④  BODY: photo left + details right, subtle texture -->
    <div style="
      flex:1; min-height:0; display:flex;
      padding:2mm 2mm 0 2mm; gap:2mm;
      background:${microBg}, #fff;
    ">

      <!-- Photo column -->
      <div style="flex-shrink:0; display:flex; flex-direction:column; align-items:center;">
        <!-- Photo frame: outer navy, inner white 0.5mm padding = double border effect -->
        <div style="
          background:${navy}; padding:0.4mm;
          display:inline-block; line-height:0;
        ">
          <div style="background:#fff; padding:0.3mm; display:inline-block; line-height:0;">
            ${photo
              ? `<img src="${photo}" style="
                  width:19mm; height:24mm; object-fit:cover; display:block;
                "/>`
              : `<div style="
                  width:19mm; height:24mm;
                  background:${navyLt};
                  display:flex; flex-direction:column;
                  align-items:center; justify-content:center; gap:0.8mm;
                ">
                  <div style="
                    width:7.5mm; height:7.5mm; background:#90a4ae;
                    border-radius:50%;
                  "></div>
                  <div style="
                    width:12mm; height:5mm; background:#b0bec5;
                    border-radius:0.5mm 0.5mm 0 0;
                  "></div>
                  <div style="font-size:3.5pt; color:#90a4ae; font-weight:700; font-family:${font}; letter-spacing:0.3mm;">AFFIX<br/>PHOTO</div>
                </div>`
            }
          </div>
        </div>
        <!-- PRESS badge -->
        <div style="
          background:${navy}; width:21mm; margin-top:0.8mm;
          padding:0.6mm 0; text-align:center; flex-shrink:0;
        ">
          <span style="color:#fff; font-size:5.2pt; font-weight:800; letter-spacing:1.4mm; font-family:${font};">PRESS</span>
        </div>
        ${stamp ? `<img src="${stamp}" style="width:8mm; height:8mm; object-fit:contain; margin-top:0.5mm; opacity:0.85;"/>` : ''}
      </div>

      <!-- Details column -->
      <div style="flex:1; min-width:0; display:flex; flex-direction:column;">

        <!-- Member name — prominent -->
        <div style="
          font-size:7.5pt; font-weight:900; color:${navy};
          text-transform:uppercase; line-height:1.2;
          border-bottom:0.25mm solid ${navyLt};
          padding-bottom:0.8mm; margin-bottom:0.6mm;
          font-family:${font}; word-break:break-word;
          letter-spacing:0.05mm;
        ">${esc(data.memberName)}</div>

        ${data.unionPost
          ? `<div style="
              display:inline-flex; align-items:center; gap:0.5mm;
              background:${gold}18; border-left:0.7mm solid ${gold};
              padding:0.3mm 1mm; margin-bottom:0.7mm; max-width:100%;
            ">
              <span style="
                font-size:4.6pt; font-weight:700; color:${gold};
                font-family:${font}; line-height:1.2; word-break:break-word;
              ">${esc(data.unionPost)}</span>
            </div>`
          : ''}

        <!-- Key-value fields -->
        <table style="width:100%; font-size:5pt; font-family:${font}; border-collapse:collapse; line-height:1.38;">
          <tr>
            <td style="font-weight:700; color:#546e7a; width:36%; vertical-align:top; padding:0.08mm 0.5mm 0.08mm 0; white-space:nowrap;">Designation</td>
            <td style="color:#1a1a2e; vertical-align:top; padding:0.08mm 0; word-break:break-word; font-size:5pt;">${esc(data.designation)}</td>
          </tr>
          <tr>
            <td style="font-weight:700; color:#546e7a; vertical-align:top; padding:0.08mm 0.5mm 0.08mm 0; white-space:nowrap;">Newspaper</td>
            <td style="color:#1a1a2e; vertical-align:top; padding:0.08mm 0; word-break:break-word;">${paper}</td>
          </tr>
          ${areaLine ? `<tr>
            <td style="font-weight:700; color:#546e7a; vertical-align:top; padding:0.08mm 0.5mm 0.08mm 0; white-space:nowrap;">Area</td>
            <td style="color:#1a1a2e; vertical-align:top; padding:0.08mm 0; word-break:break-word;">${areaLine}</td>
          </tr>` : ''}
          <tr>
            <td style="font-weight:700; color:#546e7a; vertical-align:top; padding:0.08mm 0.5mm 0.08mm 0; white-space:nowrap;">Press ID</td>
            <td style="color:${navy}; font-weight:900; vertical-align:top; padding:0.08mm 0; font-size:5.2pt;">${cardId}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- ⑤  VALIDITY + QR BAND -->
    <div style="
      display:flex; align-items:center; gap:1.8mm;
      margin:1.5mm 2mm 6.5mm 2mm; padding:1.2mm 1.5mm;
      background:${navyLt}; border-left:0.7mm solid ${navy};
      flex-shrink:0;
    ">
      ${qrF
        ? `<div style="flex-shrink:0; text-align:center;">
            <img src="${qrF}" style="
              width:14mm; height:14mm; display:block;
              border:0.3mm solid #9fa8da;
            "/>
            <div style="font-size:3.4pt; color:#5c6bc0; margin-top:0.4mm; font-family:${font}; letter-spacing:0.2mm; text-align:center;">SCAN TO VERIFY</div>
          </div>`
        : ''}
      <div style="flex:1; display:flex; flex-direction:column; gap:0.8mm;">
        <div style="font-size:4.5pt; color:#546e7a; font-family:${font}; line-height:1.2;">
          <span style="font-weight:700; color:${navyM};">Issued&nbsp;:</span> ${fmt(data.issuedAt)}
        </div>
        <div style="font-size:5.2pt; font-weight:900; color:${navy}; font-family:${font}; line-height:1.2;">
          Valid Till: ${fmt(data.expiryDate)}
        </div>
        ${data.mobileNumber ? `<div style="font-size:4pt; color:#78909c; font-family:${font};">&#9990; ${esc(data.mobileNumber)}</div>` : ''}
      </div>
    </div>

    <!-- ⑥  FOOTER: navy bar -->
    <div style="
      position:absolute; bottom:0; left:${leftOff}mm;
      width:${fullW}mm; height:6.5mm; background:${navy};
      display:flex; align-items:center;
      justify-content:space-between; padding:0 2.5mm; box-sizing:border-box;
    ">
      <span style="color:#e8eaf6; font-size:4.8pt; font-weight:700; letter-spacing:0.3mm; font-family:${font};">${esc(data.cardNumber)}</span>
      <span style="color:#5c6bc0; font-size:3.8pt; font-family:${font}; letter-spacing:0.25mm; text-transform:uppercase;">Journalist Union</span>
    </div>

  </div>`;

  // ─── BACK ─────────────────────────────────────────────────────────────────
  const backHtml = `
  <div style="
    width:54mm; height:85.6mm; position:relative;
    overflow:hidden; display:flex; flex-direction:column;
    font-family:${font}; -webkit-font-smoothing:antialiased;
    background:#fff; border:0.35mm solid #9fa8da;
  ">

    <!-- ①  HEADER: same as front -->
    <div style="
      background:#fff;
      display:flex; align-items:center; gap:1.5mm;
      padding:1.5mm 2mm 1.2mm 2mm;
      border-bottom:0.5mm solid ${navy};
      flex-shrink:0;
    ">
      ${logo
        ? `<img src="${logo}" style="height:7.5mm; width:7.5mm; object-fit:contain; flex-shrink:0; border-radius:0.5mm;"/>`
        : `<div style="width:7.5mm; height:7.5mm; border-radius:0.8mm; background:${navy}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <span style="color:#fff; font-size:5.5pt; font-weight:900; font-family:${font};">J</span></div>`
      }
      <div style="flex:1; min-width:0;">
        <div style="font-size:5.5pt; font-weight:900; color:${navy}; text-transform:uppercase; letter-spacing:0.1mm; line-height:1.2; word-break:break-word; font-family:${font};">${unionTitle}</div>
        ${data.phone ? `<div style="font-size:3.8pt; color:#546e7a; margin-top:0.2mm; font-family:${font};">&#9990; ${esc(data.phone)}&nbsp;&nbsp;${data.email ? `✉ ${esc(data.email)}` : ''}</div>` : ''}
      </div>
    </div>

    <!-- ②  TRICOLOR -->
    <div style="height:1mm; background:${tricolor}; flex-shrink:0; width:${fullW}mm; position:relative; left:${leftOff}mm;"></div>

    <!-- ③  NAVY STRIP -->
    <div style="
      background:${navy}; flex-shrink:0;
      width:${fullW}mm; position:relative; left:${leftOff}mm;
      padding:0.8mm 0; text-align:center;
    ">
      <span style="color:#c5cae9; font-size:5.5pt; font-weight:700; letter-spacing:1mm; text-transform:uppercase; font-family:${font};">JOURNALIST IDENTITY CARD</span>
    </div>

    <!-- ④  CERTIFICATION (texture bg) -->
    <div style="
      padding:1.8mm 2.5mm 0 2.5mm; flex-shrink:0;
      background:${microBg}, #fff;
    ">
      <p style="
        font-size:5.2pt; line-height:1.58; color:#212121; margin:0;
        text-align:justify; font-family:${font};
      ">This is to certify that the bearer of this card is a bona fide, authorized member of <strong style="color:${navy};">${unionTitle}</strong> and is entitled to all privileges of press membership.</p>
    </div>

    <!-- ⑤  MEMBER HIGHLIGHT BOX -->
    <div style="
      margin:1.5mm 2.5mm 0 2.5mm; padding:0.8mm 1.5mm;
      background:${navyLt}; border-left:0.8mm solid ${navy};
      flex-shrink:0;
    ">
      <div style="font-size:5.5pt; font-weight:900; color:${navy}; text-transform:uppercase; font-family:${font}; letter-spacing:0.1mm;">${esc(data.memberName)}</div>
      <div style="font-size:4.3pt; color:#5c6bc0; margin-top:0.2mm; font-family:${font}; font-weight:700;">ID: ${cardId}&nbsp;&nbsp;·&nbsp;&nbsp;Valid: ${fmt(data.expiryDate)}</div>
    </div>

    <!-- ⑥  IF FOUND -->
    ${data.phone || data.address ? `
    <div style="
      margin:1mm 2.5mm 0 2.5mm; padding:0.7mm 1.5mm;
      border:0.3mm solid #c5cae9; flex-shrink:0;
      background:#fafafa;
    ">
      <div style="font-size:4.3pt; font-weight:800; color:${navy}; text-transform:uppercase; margin-bottom:0.3mm; font-family:${font}; letter-spacing:0.2mm;">If Found, Please Contact:</div>
      ${data.phone   ? `<div style="font-size:4.5pt; color:#37474f; font-family:${font}; font-weight:600;">&#9990; ${esc(data.phone)}</div>` : ''}
      ${data.address ? `<div style="font-size:4pt; color:#78909c; margin-top:0.2mm; font-family:${font}; line-height:1.3;">${esc(data.address)}</div>` : ''}
    </div>` : ''}

    <!-- ⑦  SIGNATURE · SEAL · QR -->
    <div style="
      display:flex; align-items:flex-end; justify-content:space-between;
      padding:1.5mm 2.5mm 0 2.5mm; margin-top:auto; flex-shrink:0;
      border-top:0.3mm solid ${navyLt};
    ">
      <!-- Signature (left) -->
      <div style="text-align:center; min-width:18mm;">
        ${sign
          ? `<img src="${sign}" style="height:9mm; max-width:18mm; object-fit:contain; display:block; margin:0 auto;"/>`
          : `<div style="
              height:9mm; width:18mm; display:flex; align-items:flex-end;
              justify-content:center; padding-bottom:0.3mm;
              border-bottom:0.4mm solid #90a4ae;
            "><span style="font-size:3.4pt; color:#cfd8dc; font-family:${font}; font-style:italic;">Signature</span></div>`
        }
        ${signName ? `<div style="font-size:4.3pt; font-weight:700; color:${navy}; margin-top:0.5mm; font-family:${font}; line-height:1.2;">${signName}</div>` : ''}
        <div style="font-size:3.6pt; color:#546e7a; margin-top:0.1mm; font-family:${font}; line-height:1.3;">${signTitle}</div>
      </div>

      <!-- Seal (center) -->
      <div style="text-align:center; flex-shrink:0; padding-bottom:0.5mm;">
        ${stamp
          ? `<img src="${stamp}" style="width:13mm; height:13mm; object-fit:contain; opacity:0.88; display:block; margin:0 auto;"/>`
          : `<div style="
              width:13mm; height:13mm; border-radius:50%;
              border:0.5mm solid ${navy}; position:relative;
              display:flex; align-items:center; justify-content:center;
              background: radial-gradient(circle at 50% 50%, ${navyLt} 0%, #fff 100%);
            ">
              <div style="
                width:11mm; height:11mm; border-radius:50%;
                border:0.3mm solid ${navyM};
                display:flex; align-items:center; justify-content:center;
              ">
                <span style="font-size:3.2pt; color:${navy}; font-weight:800; text-align:center; line-height:1.3; font-family:${font}; text-transform:uppercase; letter-spacing:0.1mm;">OFFICIAL<br/>SEAL</span>
              </div>
            </div>`
        }
      </div>

      <!-- QR (right) -->
      <div style="text-align:center; flex-shrink:0; min-width:13mm;">
        ${qrB
          ? `<img src="${qrB}" style="width:13mm; height:13mm; display:block; border:0.3mm solid #c5cae9;"/>`
          : ''}
        <div style="font-size:3.3pt; color:#78909c; margin-top:0.3mm; font-family:${font}; letter-spacing:0.1mm; text-transform:uppercase;">Scan to Verify</div>
      </div>
    </div>

    <!-- ⑧  FOOTER -->
    <div style="
      width:${fullW}mm; position:relative; left:${leftOff}mm;
      background:${navy}; padding:1.1mm 2.5mm 1.3mm 2.5mm;
      box-sizing:border-box; flex-shrink:0; margin-top:auto;
    ">
      <div style="font-size:4.2pt; font-weight:800; color:#fff; text-align:center; letter-spacing:0.4mm; margin-bottom:0.3mm; font-family:${font}; text-transform:uppercase;">Terms &amp; Conditions</div>
      <div style="font-size:3.5pt; color:#c5cae9; line-height:1.45; font-family:${font}; text-align:justify;">
        Property of the union. Valid only with seal &amp; authorized signature. Must be produced on demand.
        Renew annually before expiry. Misuse is punishable under applicable law.
      </div>
    </div>

  </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    *,*::before,*::after{box-sizing:border-box;}
    @page{size:54mm 85.6mm;margin:0;}
    html,body{margin:0;padding:0;background:#fff;}
    table{border-collapse:collapse;}
  </style>
</head>
<body>
${frontHtml}
${backHtml}
</body>
</html>`;
}
async function renderToPdf(html: string): Promise<Buffer> {
  let puppeteer: any;
  try { puppeteer = require('puppeteer-core'); }
  catch { puppeteer = require('puppeteer'); }

  const args = [
    '--no-sandbox', '--disable-setuid-sandbox',
    '--disable-dev-shm-usage', '--disable-gpu',
    '--disable-software-rasterizer', '--single-process',
  ];

  const fs = await import('fs');
  let launchOpts: any = { headless: true, args };

  // Env override always wins
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN;
  if (envPath && fs.existsSync(envPath)) {
    launchOpts.executablePath = envPath;
  }

  // @sparticuz/chromium — Linux/serverless only (binary is Linux x86_64)
  if (!launchOpts.executablePath && process.platform === 'linux') {
    try {
      const chromium = require('@sparticuz/chromium');
      const execPath = await chromium.executablePath();
      if (execPath && fs.existsSync(execPath)) {
        launchOpts = { headless: chromium.headless, args: [...args, ...chromium.args], executablePath: execPath };
      }
    } catch { /* not present */ }
  }

  // Linux system Chromium candidates (DigitalOcean Ubuntu)
  if (!launchOpts.executablePath && process.platform === 'linux') {
    const linuxCandidates = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
    for (const p of linuxCandidates) {
      if (fs.existsSync(p)) { launchOpts.executablePath = p; break; }
    }
  }

  // macOS local Chrome/Chromium candidates
  if (!launchOpts.executablePath && process.platform === 'darwin') {
    const macCandidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ];
    for (const p of macCandidates) {
      if (fs.existsSync(p)) { launchOpts.executablePath = p; break; }
    }
  }

  const browser = await puppeteer.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30_000);
    await page.setBypassCSP(true);
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const buf = await page.pdf({
      width: '54mm', height: '85.6mm',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return buf as Buffer;
  } finally {
    await browser.close();
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Generate a press card PDF using sample/mock data — useful for design preview. */
export async function generateSamplePressCardBuffer(): Promise<Buffer> {
  const sampleData: PressCardData = {
    profileId:      'sample-profile-001',
    memberName:     'Venkata Ramana Reddy',
    pressId:        'DJFW-AP-00142',
    cardNumber:     'DJFW/AP/2025/00142',
    issuedAt:       new Date('2025-01-01'),
    expiryDate:     new Date('2026-01-01'),
    renewalCount:   0,
    designation:    'Senior Reporter',
    unionPost:      'District Vice President',
    organization:   'Eenadu',
    currentNewspaper: 'Eenadu',
    mandal:         'Narasaraopet',
    district:       'Palnadu',
    state:          'Andhra Pradesh',
    mobileNumber:   '+91 98765 43210',
    unionName:      'DJFW',
    unionDisplayName: 'Democratic Journalist Federation (Working)',
    registrationNumber: 'AP/SOC/2003/00019',
    address:        'H.No 4-5-678, Press Colony, Vijayawada – 520 001',
    phone:          '+91 866 2478900',
    email:          'contact@djfw.org',
    websiteUrl:     'https://djfw.org',
    signatoryName:  'T. Arunkumar',
    signatoryTitle: 'Founder & National President',
    photoUrl:       null,
    unionLogoUrl:   null,
    stampImageUrl:  null,
    forStampImageUrl: null,
    presidentSignatureUrl: null,
  };

  const verifyUrl = 'https://api.kaburlumedia.com/api/v1/journalist/press-card/pdf?cardNumber=DJFW%2FAP%2F2025%2F00142';
  const [qrFront, qrBack] = await Promise.all([
    QRCode.toDataURL(verifyUrl, { margin: 0, width: 280, errorCorrectionLevel: 'M' }),
    QRCode.toDataURL(verifyUrl, { margin: 0, width: 320, errorCorrectionLevel: 'M' }),
  ]);

  const enriched: PressCardData = {
    ...sampleData,
    __inline: { logo: null, photo: null, stamp: null, forStamp: null, signature: null, qrFront, qrBack },
  };

  const html = buildPressCardHtml(enriched);
  return renderToPdf(html);
}

/** Stream a press card PDF buffer directly (no R2 upload). */
export async function generatePressCardBuffer(profileId: string): Promise<{
  ok: boolean; pdfBuffer?: Buffer; cardNumber?: string; error?: string;
}> {
  try {
    let data = await buildPressCardData(profileId);
    if (!data) return { ok: false, error: 'Press card not found for this profile. Generate card first via admin.' };
    data = await inlineAssets(data);
    const html = buildPressCardHtml(data);
    const pdfBuffer = await renderToPdf(html);
    return { ok: true, pdfBuffer, cardNumber: data.cardNumber };
  } catch (e: any) {
    console.error('[PressCard PDF] buffer generation failed:', e);
    return { ok: false, error: e.message || 'Failed to generate press card PDF' };
  }
}

/** Generate press card PDF, upload to R2, persist pdfUrl on JournalistCard. */
export async function generateAndUploadPressCardPdf(profileId: string): Promise<PressCardPdfResult> {
  try {
    let data = await buildPressCardData(profileId);
    if (!data) return { ok: false, error: 'Press card not found for this profile.' };
    if (!R2_BUCKET) return { ok: false, error: 'R2_BUCKET not configured' };

    data = await inlineAssets(data);
    const html = buildPressCardHtml(data);
    const pdfBuffer = await renderToPdf(html);

    const r2Key = `journalist-union/press-cards/${profileId}/${data.cardNumber}_${Date.now()}.pdf`;
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET, Key: r2Key, Body: pdfBuffer,
      ContentType: 'application/pdf', CacheControl: 'private, max-age=3600',
    }));
    const pdfUrl = getPublicUrl(r2Key);

    await (prisma as any).journalistCard.update({ where: { profileId }, data: { pdfUrl } });
    return { ok: true, pdfUrl, cardNumber: data.cardNumber };
  } catch (e: any) {
    console.error('[PressCard PDF] upload failed:', e);
    return { ok: false, error: e.message || 'Failed to generate/upload press card PDF' };
  }
}
