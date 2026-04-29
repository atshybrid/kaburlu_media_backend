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
import { putPublicObject } from './objectStorage';
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
  unionName:        string | null;
  unionDisplayName: string | null;
  nativeDisplayName: string | null; // e.g. "డెమోక్రటిక్ జర్నలిస్ట్ ఫెడరేషన్ (వర్కింగ్)"
  abbreviation:     string | null;  // e.g. "DJF(W)"
  sloganText:       string | null;  // e.g. "అక్షర దివిటీలం...ప్రజాస్వామ్య వార్తలు"
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
  forStampImageUrl: string | null; // used as background watermark on card
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
    nativeDisplayName:  settings?.nativeDisplayName ?? null,
    abbreviation:       settings?.abbreviation ?? null,
    sloganText:         settings?.sloganText ?? null,
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

// ─── Abbreviation deriver ─────────────────────────────────────────────────────

function deriveAbbreviation(name: string | null | undefined): string {
  if (!name) return 'UNION';
  const stop = new Set(['the', 'of', 'and', 'for', 'in', 'a', 'an', 'or', 'at']);
  return name.split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => {
      if (w.startsWith('(') && w.endsWith(')') && w.length > 2) return `(${w[1].toUpperCase()})`;
      if (stop.has(w.toLowerCase())) return '';
      return w[0].toUpperCase();
    })
    .filter(Boolean)
    .join('');
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildPressCardHtml(data: PressCardData): string {
  const d         = data.__inline ?? {};
  const logo      = d.logo      ?? null;
  const photo     = d.photo     ?? null;
  const stamp     = d.stamp     ?? null;
  const watermark = d.forStamp  ?? null;
  const sign      = d.signature ?? null;
  const qrF       = d.qrFront   ?? null;
  const qrB       = d.qrBack    ?? null;

  const navy       = '#1a237e';
  const red        = '#c62828';
  const fontLatin  = 'Arial, Helvetica, sans-serif';
  const fontTelugu = "'Noto Sans Telugu', Arial, Helvetica, sans-serif";

  const unionAbbr  = esc(data.abbreviation || deriveAbbreviation(data.unionDisplayName || data.unionName));
  const regNo      = esc(data.registrationNumber || '');
  const nativeName = esc(data.nativeDisplayName || '');
  const slogan     = esc(data.sloganText || '');
  const cardId     = esc(data.pressId || data.cardNumber);
  const signName   = esc(data.signatoryName  || '');
  const signTitle  = esc(data.signatoryTitle || 'Authorized Signatory');
  const unionTitle = esc(data.unionDisplayName || data.unionName || 'Journalist Union');
  const paper      = esc(data.currentNewspaper || data.organization || '');

  // Watermark for back card body (front uses `watermark` directly)
  const wmUrl  = watermark || logo;
  const wmOpac = watermark ? '0.08' : '0.05';

  // Photo placeholder SVG (inline, no external request)
  const photoPlaceholder = `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 160 200">
      <rect fill="#e8eaf6" width="160" height="200"/>
      <circle cx="80" cy="72" r="36" fill="#b0bec5"/>
      <path d="M10 200 Q80 130 150 200" fill="#b0bec5"/>
    </svg>`
  ).toString('base64')}`;

  // ─── FRONT ────────────────────────────────────────────────────────────────
  const frontHtml = `
  <div style="
    width:54mm; height:85.6mm; position:relative; overflow:hidden;
    background:#ffffff; page-break-after:always;
    display:flex; flex-direction:column;
    font-family:${fontLatin}; -webkit-font-smoothing:antialiased;
    box-sizing:border-box;
  ">

    <!-- Watermark -->
    ${wmUrl ? `<img src="${wmUrl}" style="
      position:absolute; top:44%; left:50%; transform:translate(-50%,-50%);
      z-index:0; pointer-events:none;
      width:34mm; height:34mm; object-fit:contain; opacity:0.08;
    "/>` : ''}

    <!-- ① Logo centred — navy lines both sides -->
    <div style="display:flex; align-items:center; flex-shrink:0; padding:2mm 0 0; position:relative; z-index:1;">
      <div style="flex:1; height:0.8mm; background:${navy};"></div>
      <div style="flex-shrink:0; padding:0 3mm;">
        <div style="width:20mm; height:20mm; border-radius:50%; background:${navy}; padding:0.7mm; box-sizing:border-box; display:flex; align-items:center; justify-content:center;">
          <div style="width:100%; height:100%; border-radius:50%; background:#fff; overflow:hidden; display:flex; align-items:center; justify-content:center;">
            ${logo
              ? `<img src="${logo}" style="width:100%; height:100%; object-fit:contain; display:block;"/>`
              : `<div style="width:100%;height:100%;background:${navy};border-radius:50%;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:6pt;font-weight:900;">${unionAbbr}</span></div>`
            }
          </div>
        </div>
      </div>
      <div style="flex:1; height:0.8mm; background:${navy};"></div>
    </div>

    <!-- ② Photo + Details -->
    <div style="display:flex; align-items:flex-start; flex-shrink:0; padding:2mm 3mm 0; gap:2.5mm; position:relative; z-index:1;">
      <!-- Photo -->
      <div style="flex-shrink:0; position:relative; width:17mm;">
        <div style="border:0.5mm solid #bdbdbd; width:17mm; height:22mm; background:#eceff1; overflow:hidden;">
          ${photo
            ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
            : `<img src="${photoPlaceholder}" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
          }
        </div>
        ${stamp ? `<img src="${stamp}" style="position:absolute;bottom:-2mm;right:-2mm;width:9mm;height:9mm;object-fit:contain;opacity:0.9;"/>` : ''}
      </div>
      <!-- Details -->
      <div style="flex:1; min-width:0; padding-top:0.5mm;">
        <div style="margin-bottom:1.4mm;">
          <div style="font-size:3.5pt;font-weight:800;color:#78909c;text-transform:uppercase;letter-spacing:0.2mm;line-height:1;">Name</div>
          <div style="font-size:5pt;font-weight:900;color:${navy};line-height:1.25;word-break:break-word;">${esc(data.memberName)}</div>
        </div>
        <div style="margin-bottom:1.4mm;">
          <div style="font-size:3.5pt;font-weight:800;color:#78909c;text-transform:uppercase;letter-spacing:0.2mm;line-height:1;">Designation</div>
          <div style="font-size:4.2pt;font-weight:600;color:#37474f;line-height:1.25;word-break:break-word;">${esc(data.designation)}</div>
        </div>
        ${data.unionPost ? `<div style="margin-bottom:1.4mm;background:rgba(26,35,126,0.07);border-left:0.8mm solid ${navy};padding:0.8mm 1.5mm;border-radius:0 0.5mm 0.5mm 0;">
          <div style="font-size:3.5pt;font-weight:800;color:#78909c;text-transform:uppercase;letter-spacing:0.2mm;line-height:1;">Post</div>
          <div style="font-size:4.2pt;font-weight:700;color:${navy};line-height:1.25;word-break:break-word;">${esc(data.unionPost)}</div>
        </div>` : ''}
        ${paper ? `<div style="margin-bottom:1.4mm;">
          <div style="font-size:3.5pt;font-weight:800;color:#78909c;text-transform:uppercase;letter-spacing:0.2mm;line-height:1;">Publication</div>
          <div style="font-size:4.2pt;font-weight:600;color:#37474f;line-height:1.25;word-break:break-word;">${paper}</div>
        </div>` : ''}
        <div>
          <div style="font-size:3.5pt;font-weight:800;color:#78909c;text-transform:uppercase;letter-spacing:0.2mm;line-height:1;">Member ID</div>
          <div style="font-size:4.8pt;font-weight:900;color:${navy};line-height:1.25;">${cardId}</div>
        </div>
      </div>
    </div>

    <!-- ③④⑤ DJF(W) + Merged red+blue band -->
    <div style="flex:1;position:relative;z-index:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;margin-top:1mm;">
      <div style="text-align:center;padding:0.8mm 3mm 1mm;">
        <div style="font-size:13pt;font-weight:700;color:${navy};letter-spacing:1.5mm;font-family:${fontLatin};line-height:1.1;">${unionAbbr}</div>
        ${regNo ? `<div style="font-size:4pt;font-weight:700;color:${navy};letter-spacing:0.5mm;margin-top:0.3mm;font-family:${fontLatin};">REG NO: ${regNo}</div>` : ''}
      </div>
      <div style="background:${red};padding:1.5mm 2mm;text-align:center;">
        <span style="color:#fff;font-size:6.8pt;font-weight:800;font-family:${fontTelugu};line-height:1.3;display:block;">${nativeName || unionTitle}</span>
      </div>
      ${slogan ? `<div style="background:${navy};padding:1.5mm 2mm;text-align:center;">
        <div style="font-size:6.2pt;font-weight:700;color:#fff;font-family:${fontTelugu};line-height:1.3;word-break:break-word;">${slogan}</div>
      </div>` : ''}
    </div>

    <!-- ⑥ Footer: fully white, professional union card style -->
    <div style="
      flex-shrink:0; position:relative; z-index:1;
      background:#fff; padding:1.8mm 3mm;
      display:flex; align-items:flex-end; justify-content:space-between;
    ">
      <!-- Left: VALID TILL -->
      <div style="display:flex;flex-direction:column;justify-content:flex-end;gap:0.5mm;">
        <span style="font-size:3.5pt;font-weight:700;color:#90a4ae;text-transform:uppercase;letter-spacing:0.2mm;line-height:1;">Valid Till</span>
        <span style="font-size:6pt;font-weight:900;color:${navy};line-height:1;">${fmt(data.expiryDate)}</span>
      </div>
      <!-- Right: signature + line + label (all white bg, natural colors) -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:0.5mm;">
        ${sign
          ? `<img src="${sign}" style="height:6.5mm;max-width:16mm;object-fit:contain;display:block;"/>`
          : `<div style="height:6.5mm;width:16mm;"></div>`
        }
        <div style="width:16mm;height:0.4mm;background:${navy};opacity:0.4;"></div>
        <span style="font-size:3.5pt;font-weight:700;color:#546e7a;text-transform:uppercase;letter-spacing:0.2mm;line-height:1;">Authorized Signature</span>
      </div>
    </div>

  </div>`;

  // ─── BACK ─────────────────────────────────────────────────────────────────
  const backHtml = `
  <div style="
    width:54mm; height:85.6mm; position:relative; overflow:hidden;
    background:#ffffff; display:flex; flex-direction:column;
    font-family:${fontLatin}; -webkit-font-smoothing:antialiased;
    box-sizing:border-box;
  ">

    <!-- Background fist watermark -->
    ${wmUrl ? `<img src="${wmUrl}" style="
      position:absolute; bottom:12mm; right:0; z-index:0; pointer-events:none;
      width:32mm; height:32mm; object-fit:contain; opacity:0.08;
    "/>` : ''}

    <!-- ① Header: logo + lines + union title -->
    <div style="
      display:flex; align-items:center; gap:0; flex-shrink:0;
      padding:1.5mm 2mm 0; position:relative; z-index:1;
    ">
      <div style="flex:1; height:0.6mm; background:${navy};"></div>
      <div style="flex-shrink:0; padding:0 1.5mm;">
        ${logo
          ? `<img src="${logo}" style="width:10mm; height:10mm; object-fit:contain; display:block; border-radius:50%;"/>`
          : `<div style="width:10mm; height:10mm; border-radius:50%; background:${navy};
              display:flex; align-items:center; justify-content:center;">
              <span style="color:#fff; font-size:4.5pt; font-weight:900;">${unionAbbr}</span>
             </div>`
        }
      </div>
      <div style="flex:1; height:0.6mm; background:${navy};"></div>
    </div>

    <!-- ② Red band: Telugu name -->
    <div style="
      background:${red}; padding:0.7mm 2mm; text-align:center;
      flex-shrink:0; position:relative; z-index:1; margin-top:0.8mm;
    ">
      <span style="color:#fff; font-size:5pt; font-weight:700; font-family:${fontTelugu}; line-height:1.25; display:block;">${nativeName || unionTitle}</span>
    </div>

    <!-- ③ Navy strip: card type -->
    <div style="
      background:${navy}; padding:0.7mm 0; text-align:center;
      flex-shrink:0; position:relative; z-index:1;
    ">
      <span style="color:#c5cae9; font-size:5pt; font-weight:700; letter-spacing:1mm; text-transform:uppercase; font-family:${fontLatin};">JOURNALIST IDENTITY CARD</span>
    </div>

    <!-- ④ Certification text -->
    <div style="padding:1.5mm 2.5mm 0; flex-shrink:0; position:relative; z-index:1;">
      <div style="font-size:4.8pt; font-weight:800; color:${navy}; text-transform:uppercase; letter-spacing:0.2mm; margin-bottom:0.5mm; font-family:${fontLatin};">TERMS AND CONDITIONS</div>
      <p style="font-size:4.5pt; line-height:1.55; color:#212121; margin:0; text-align:justify; font-family:${fontLatin};">
        This is to certify that the bearer of this card is a bona fide, authorized member of
        <strong style="color:${navy};">${unionTitle}</strong> and not permitted to organizations components to
        confirmed non-journalist formulation.
      </p>
      <p style="font-size:4.5pt; line-height:1.55; color:#212121; margin:0.8mm 0 0; text-align:justify; font-family:${fontLatin};">
        In any receive agents information organizations and federation persons. If found, contact the union federation.
      </p>
    </div>

    <!-- ⑤ Emergency / contact box -->
    ${data.phone ? `
    <div style="
      margin:1.2mm 2.5mm 0; padding:0.7mm 1.5mm;
      border:0.3mm solid #ef9a9a; background:#fff8f8;
      flex-shrink:0; position:relative; z-index:1;
    ">
      <div style="font-size:4.3pt; font-weight:800; color:${red}; text-transform:uppercase; margin-bottom:0.3mm; font-family:${fontLatin}; letter-spacing:0.15mm;">EMERGENCY CONTACT</div>
      <div style="font-size:4.5pt; color:#37474f; font-family:${fontLatin}; font-weight:600;">&#9990; ${esc(data.phone)}</div>
      ${data.address ? `<div style="font-size:3.8pt; color:#78909c; margin-top:0.2mm; line-height:1.3;">${esc(data.address)}</div>` : ''}
    </div>` : ''}

    <!-- ⑥ Member highlight -->
    <div style="
      margin:1mm 2.5mm 0; padding:0.7mm 1.5mm;
      background:#e8eaf6; border-left:0.8mm solid ${navy};
      flex-shrink:0; position:relative; z-index:1;
    ">
      <div style="font-size:5pt; font-weight:900; color:${navy}; text-transform:uppercase; font-family:${fontLatin};">${esc(data.memberName)}</div>
      <div style="font-size:4pt; color:#5c6bc0; margin-top:0.2mm; font-family:${fontLatin}; font-weight:700;">ID: ${cardId}&nbsp;&nbsp;·&nbsp;&nbsp;Valid: ${fmt(data.expiryDate)}</div>
    </div>

    <!-- ⑦ Signature · Stamp · QR -->
    <div style="
      display:flex; align-items:flex-end; justify-content:space-between;
      padding:1.2mm 2.5mm 0; margin-top:auto; flex-shrink:0;
      border-top:0.3mm solid #e8eaf6; position:relative; z-index:1;
    ">
      <!-- State President Signature -->
      <div style="text-align:center; min-width:16mm;">
        ${sign
          ? `<img src="${sign}" style="height:8mm; max-width:16mm; object-fit:contain; display:block; margin:0 auto;"/>`
          : `<div style="height:8mm; width:16mm; border-bottom:0.4mm solid #90a4ae; display:flex; align-items:flex-end; justify-content:center; padding-bottom:0.2mm;">
              <span style="font-size:3.2pt; color:#cfd8dc; font-style:italic;">Signature</span>
             </div>`
        }
        ${signName ? `<div style="font-size:3.8pt; font-weight:700; color:${navy}; margin-top:0.4mm; font-family:${fontLatin}; line-height:1.2;">${signName}</div>` : ''}
        <div style="font-size:3.4pt; color:#546e7a; margin-top:0.1mm; font-family:${fontLatin}; line-height:1.2;">${signTitle}</div>
      </div>

      <!-- Round Stamp (center) -->
      <div style="text-align:center; flex-shrink:0; padding-bottom:0.5mm;">
        ${stamp
          ? `<img src="${stamp}" style="width:12mm; height:12mm; object-fit:contain; opacity:0.88; display:block; margin:0 auto;"/>`
          : `<div style="
              width:12mm; height:12mm; border-radius:50%;
              border:0.5mm solid ${red};
              display:flex; align-items:center; justify-content:center;
              background:radial-gradient(circle, #ffebee 0%, #fff 100%);
            ">
              <span style="font-size:3pt; color:${red}; font-weight:800; text-align:center; line-height:1.3; font-family:${fontLatin}; text-transform:uppercase;">OFFICIAL<br/>SEAL</span>
            </div>`
        }
      </div>

      <!-- QR Code (right) -->
      <div style="text-align:center; flex-shrink:0; min-width:12mm;">
        ${qrB ? `<img src="${qrB}" style="width:12mm; height:12mm; display:block; border:0.3mm solid #c5cae9;"/>` : ''}
        <div style="font-size:3pt; color:#78909c; margin-top:0.3mm; font-family:${fontLatin}; text-transform:uppercase;">Scan Verify</div>
      </div>
    </div>

    <!-- ⑧ Footer bar -->
    <div style="
      background:${navy}; padding:1mm 2.5mm 1.2mm;
      flex-shrink:0; margin-top:auto; position:relative; z-index:1;
    ">
      <div style="font-size:4pt; font-weight:800; color:#fff; text-align:center; letter-spacing:0.3mm; margin-bottom:0.3mm; font-family:${fontLatin}; text-transform:uppercase;">Terms &amp; Conditions</div>
      <div style="font-size:3.3pt; color:#c5cae9; line-height:1.45; font-family:${fontLatin}; text-align:justify;">
        Property of the union. Valid only with seal &amp; authorized signature. Must be produced on demand. Renew annually. Misuse is punishable under law.
      </div>
    </div>

  </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;700;900&display=swap" rel="stylesheet"/>
  <style>
    *,*::before,*::after{box-sizing:border-box;}
    @page{size:54mm 85.6mm;margin:0;}
    html,body{margin:0;padding:0;background:#fff;}
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
    unionName:      'Democratic Journalist Federation (Working)',
    unionDisplayName: 'Democratic Journalist Federation (Working)',
    nativeDisplayName: 'డెమోక్రటిక్ జర్నలిస్ట్ ఫెడరేషన్ (వర్కింగ్)',
    abbreviation:   'DJF(W)',
    sloganText:     'అక్షర దివిటీలం...ప్రజాస్వామ్య వార్తలు',
    registrationNumber: '343/2025',
    address:        'H.No 4-5-678, Press Colony, Vijayawada – 520 001',
    phone:          '+91 866 2478900',
    email:          'contact@djfw.org',
    websiteUrl:     'https://djfw.org',
    signatoryName:  'T. Arunkumar',
    signatoryTitle: 'Founder & National President',
    photoUrl:       null,
    unionLogoUrl:   'https://kaburlu-news.b-cdn.net/journalist-union/democratic_journalist_federation__working_/assets/logo.png',
    stampImageUrl:  'https://kaburlu-news.b-cdn.net/journalist-union/democratic_journalist_federation__working_/assets/stamp.png',
    forStampImageUrl: 'https://kaburlu-news.b-cdn.net/journalist-union/democratic_journalist_federation__working_/assets/watermark.png',
    presidentSignatureUrl: 'https://kaburlu-news.b-cdn.net/journalist-union/democratic_journalist_federation__working_/states/andhra_pradesh/presidentSignature.png',
  };

  const verifyUrl = 'https://api.kaburlumedia.com/api/v1/journalist/press-card/pdf?cardNumber=DJFW%2FAP%2F2025%2F00142';
  const [qrFront, qrBack] = await Promise.all([
    QRCode.toDataURL(verifyUrl, { margin: 0, width: 280, errorCorrectionLevel: 'M' }),
    QRCode.toDataURL(verifyUrl, { margin: 0, width: 320, errorCorrectionLevel: 'M' }),
  ]);

  // Inline real assets for the sample preview
  const [logo, stamp, signature, watermarkInline] = await Promise.all([
    toDataUri(sampleData.unionLogoUrl),
    toDataUri(sampleData.stampImageUrl),
    toDataUri(sampleData.presidentSignatureUrl),
    toDataUri(sampleData.forStampImageUrl),
  ]);

  const enriched: PressCardData = {
    ...sampleData,
    __inline: { logo, photo: null, stamp, forStamp: watermarkInline, signature, qrFront, qrBack },
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

    data = await inlineAssets(data);
    const html = buildPressCardHtml(data);
    const pdfBuffer = await renderToPdf(html);

    const key = `journalist-union/press-cards/${profileId}/${data.cardNumber}_${Date.now()}.pdf`;
    const { publicUrl: pdfUrl } = await putPublicObject({ key, body: pdfBuffer, contentType: 'application/pdf' });

    await (prisma as any).journalistCard.update({ where: { profileId }, data: { pdfUrl } });
    return { ok: true, pdfUrl, cardNumber: data.cardNumber };
  } catch (e: any) {
    console.error('[PressCard PDF] upload failed:', e);
    return { ok: false, error: e.message || 'Failed to generate/upload press card PDF' };
  }
}
