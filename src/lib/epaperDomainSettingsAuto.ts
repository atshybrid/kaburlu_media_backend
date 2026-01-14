import prisma from './prisma';
import { aiGenerateText } from './aiProvider';

function parseBool(v: string | undefined, def = true): boolean {
  if (typeof v === 'undefined') return def;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on';
}

function stripCodeFences(text: string): string {
  const t = String(text || '');
  return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

function tryParseJson(text: string): any | null {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // try slice largest JSON object
    const s2 = cleaned.indexOf('{');
    const e2 = cleaned.lastIndexOf('}');
    if (s2 >= 0 && e2 > s2) {
      try {
        return JSON.parse(cleaned.slice(s2, e2 + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function languageNameFromCode(code: string): string {
  const map: Record<string, string> = {
    te: 'Telugu',
    hi: 'Hindi',
    kn: 'Kannada',
    ta: 'Tamil',
    mr: 'Marathi',
    bn: 'Bengali',
    ur: 'Urdu',
    gu: 'Gujarati',
    ml: 'Malayalam',
    pa: 'Punjabi',
    or: 'Odia',
    as: 'Assamese',
    en: 'English',
  };
  return map[String(code || '').toLowerCase()] || code;
}

function defaultRegionForLanguage(code: string): string {
  const c = String(code || '').toLowerCase();
  if (c === 'te') return 'Andhra Pradesh & Telangana people';
  if (c === 'kn') return 'Karnataka people';
  if (c === 'ta') return 'Tamil Nadu people';
  if (c === 'mr') return 'Maharashtra people';
  if (c === 'bn') return 'West Bengal people';
  if (c === 'ml') return 'Kerala people';
  if (c === 'gu') return 'Gujarat people';
  if (c === 'pa') return 'Punjab people';
  if (c === 'or') return 'Odisha people';
  if (c === 'as') return 'Assam people';
  if (c === 'hi') return 'India (Hindi-speaking audience)';
  return 'India';
}

function pickObject(v: any): Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function pickBrandingThemeSeo(sourceData: any): any {
  const src = pickObject(sourceData);
  const branding = pickObject((src as any).branding);
  const theme = pickObject((src as any).theme);
  const seo = pickObject((src as any).seo);
  const themeStyle = (src as any).themeStyle;

  const out: any = {};
  if (Object.keys(branding).length) out.branding = branding;
  if (Object.keys(theme).length) out.theme = theme;
  if (Object.keys(seo).length) out.seo = seo;
  if (typeof themeStyle === 'string' && themeStyle.trim()) out.themeStyle = themeStyle;
  return out;
}

function mergeSettings(base: any, override: any) {
  return { ...(pickObject(base) as any), ...(pickObject(override) as any) };
}

export type EnsureEpaperDomainSettingsOptions = {
  forceFill?: boolean;
  forceSeo?: boolean;
};

export async function ensureEpaperDomainSettings(
  tenantId: string,
  domainId: string,
  options: EnsureEpaperDomainSettingsOptions = {}
): Promise<void> {
  const AUTO_FILL = options.forceFill ? true : parseBool(process.env.EPAPER_AUTO_DOMAIN_SETTINGS, true);
  const AUTO_SEO = options.forceSeo ? true : parseBool(process.env.EPAPER_AUTO_SEO, true);
  if (!AUTO_FILL && !AUTO_SEO) return;

  const domain = await (prisma as any).domain.findUnique({ where: { id: domainId } }).catch(() => null);
  if (!domain) return;
  if (String(domain.kind || '').toUpperCase() !== 'EPAPER') return;

  const [tenant, tenantTheme, tenantEntity] = await Promise.all([
    (prisma as any).tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true, stateId: true } }).catch(() => null),
    (prisma as any).tenantTheme?.findUnique?.({ where: { tenantId } }).catch(() => null),
    (prisma as any).tenantEntity?.findUnique?.({ where: { tenantId }, include: { language: true } }).catch(() => null),
  ]);

  const existing = await (prisma as any).domainSettings?.findUnique?.({ where: { domainId } }).catch(() => null);
  const existingData = existing?.data;

  // Step 1: Ensure domainSettings exists and has branding/theme seeded
  if (AUTO_FILL) {
    const alreadyHasBranding = !!pickObject((existingData as any)?.branding).logoUrl || Object.keys(pickObject((existingData as any)?.branding)).length > 0;
    const alreadyHasTheme = Object.keys(pickObject((existingData as any)?.theme)).length > 0;

    if (!existing || (!alreadyHasBranding && !alreadyHasTheme)) {
      // Try to inherit from tenant's primary NEWS domain settings
      const primaryDomain = await (prisma as any).domain.findFirst({
        where: { tenantId, isPrimary: true },
        orderBy: [{ createdAt: 'desc' }],
        select: { id: true },
      }).catch(() => null);

      const primarySettings = primaryDomain?.id
        ? await (prisma as any).domainSettings?.findUnique?.({ where: { domainId: primaryDomain.id } }).catch(() => null)
        : null;

      let seed = pickBrandingThemeSeo(primarySettings?.data);

      // Fallback to tenantTheme if primary domain settings missing
      if (!Object.keys(seed).length && tenantTheme) {
        seed = {
          branding: {
            logoUrl: tenantTheme.logoUrl || null,
            faviconUrl: tenantTheme.faviconUrl || null,
          },
          theme: {
            colors: {
              primary: tenantTheme.primaryColor || null,
              secondary: tenantTheme.secondaryColor || null,
              headerBgColor: tenantTheme.headerBgColor || null,
              footerBgColor: tenantTheme.footerBgColor || null,
            },
            typography: {
              fontFamily: tenantTheme.fontFamily || null,
            },
          },
        };
      }

      // Ensure canonicalBaseUrl points to epaper domain
      const epaperBase = `https://${domain.domain}`;
      const nextSeo = mergeSettings((seed as any).seo, { canonicalBaseUrl: epaperBase });
      const nextData = { ...seed, seo: nextSeo };

      if (!existing) {
        await (prisma as any).domainSettings.create({ data: { tenantId, domainId, data: nextData } });
      } else {
        const merged = mergeSettings(existingData, nextData);
        await (prisma as any).domainSettings.update({ where: { id: existing.id }, data: { data: merged } });
      }
    }
  }

  // Step 2: Generate SEO via AI if missing
  if (AUTO_SEO) {
    const latest = await (prisma as any).domainSettings?.findUnique?.({ where: { domainId } }).catch(() => null);
    const latestData = latest?.data;
    const seo = pickObject((latestData as any)?.seo);

    const hasSeo = Boolean(seo.defaultMetaTitle || seo.defaultMetaDescription || seo.metaTitle || seo.metaDescription);
    if (hasSeo) return;

    const langCode = String(tenantEntity?.language?.code || 'te');
    const langName = languageNameFromCode(langCode);
    const region = defaultRegionForLanguage(langCode);

    const websiteName = String(tenant?.name || tenant?.slug || 'News');

    const prompt = `You are an SEO expert.

My website details:
- Domain name: ${domain.domain}
- Website name: ${websiteName}
- Website type: ${langName} Epaper & News Website
- Language: ${langName}
- Target audience: ${region}
- Focus: Local news, breaking news, politics, agriculture, jobs

Generate:
1. Best SEO title (under 60 characters)
2. Meta description (under 160 characters)
3. SEO keywords (comma separated)
4. Homepage H1 tag
5. Short SEO friendly tagline

Return ONLY valid JSON in this exact format:
{
  "title": "...",
  "description": "...",
  "keywords": "...",
  "h1": "...",
  "tagline": "..."
}`;

    const r = await aiGenerateText({ prompt, purpose: 'seo' });
    const parsed = tryParseJson(r.text || '');
    if (!parsed) return;

    const title = String(parsed.title || '').trim();
    const description = String(parsed.description || '').trim();
    const keywords = String(parsed.keywords || '').trim();
    const h1 = String(parsed.h1 || '').trim();
    const tagline = String(parsed.tagline || '').trim();

    const canonicalBaseUrl = `https://${domain.domain}`;

    const nextSeo: any = {
      canonicalBaseUrl,
      defaultMetaTitle: title || undefined,
      defaultMetaDescription: description || undefined,
      keywords: keywords || undefined,
      homepageH1: h1 || undefined,
      tagline: tagline || undefined,
      generatedBy: 'ai',
      generatedAt: new Date().toISOString(),
    };

    const updated = mergeSettings(latestData, { seo: mergeSettings((latestData as any)?.seo, nextSeo) });
    await (prisma as any).domainSettings.update({ where: { id: latest.id }, data: { data: updated } });
  }
}
