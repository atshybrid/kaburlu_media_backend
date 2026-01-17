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

function pickObject(v: any): Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function mergeSettings(base: any, override: any) {
  return { ...(pickObject(base) as any), ...(pickObject(override) as any) };
}

export type EnsureNewsDomainSettingsOptions = {
  forceSeo?: boolean;
};

/**
 * Auto-generate missing SEO fields for NEWS domains using AI.
 * Similar to ensureEpaperDomainSettings but for NEWS domains.
 */
export async function ensureNewsDomainSettings(
  tenantId: string,
  domainId: string,
  options: EnsureNewsDomainSettingsOptions = {}
): Promise<void> {
  const domain = await (prisma as any).domain.findUnique({ where: { id: domainId } }).catch(() => null);
  if (!domain) return;
  if (String((domain as any).tenantId) !== String(tenantId)) return;

  const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } }).catch(() => null);
  if (!tenant) return;

  const existing = await (prisma as any).domainSettings.findUnique({ where: { domainId } }).catch(() => null);
  const existingData = pickObject(existing?.data);
  const existingSeo = pickObject((existingData as any).seo);

  // Check if we need to generate SEO
  const needsSeo =
    options.forceSeo ||
    !existingSeo.defaultMetaTitle ||
    !existingSeo.defaultMetaDescription ||
    !existingSeo.keywords ||
    !existingSeo.homepageH1 ||
    !existingSeo.tagline;

  if (!needsSeo) return;

  // Generate SEO using AI
  const domainName = String((domain as any).domain || '');
  const siteName = (existingData as any)?.branding?.siteName || (tenant as any)?.displayName || (tenant as any)?.name || domainName;
  const canonicalBaseUrl = existingSeo.canonicalBaseUrl || `https://${domainName}`;

  const prompt = `You are an expert SEO specialist. Generate comprehensive SEO metadata for a NEWS website.

Website Details:
- Site Name: ${siteName}
- Domain: ${domainName}
- Canonical URL: ${canonicalBaseUrl}
- Type: News website (breaking news, politics, business, sports, local news)

Generate ONLY a valid JSON object with these fields (no markdown, no explanation):
{
  "defaultMetaTitle": "50-60 characters, include brand name and value proposition",
  "defaultMetaDescription": "150-160 characters, compelling description with keywords",
  "keywords": "comma-separated relevant keywords (10-15 keywords)",
  "ogTitle": "engaging social media title (max 60 chars)",
  "ogDescription": "compelling social description (max 160 chars)",
  "homepageH1": "powerful H1 headline for homepage (include brand)",
  "tagline": "catchy tagline/slogan (3-6 words)",
  "robots": "index,follow,max-image-preview:large"
}

Important:
- Use power words and emotional triggers
- Focus on news, breaking updates, credibility, local coverage
- Include location if relevant
- Make it compelling and SEO-friendly
- Ensure all character limits are strictly followed`;

  try {
    const aiResponse = await aiGenerateText({ prompt, purpose: 'seo' });
    const seoData = tryParseJson(aiResponse?.text || '');

    if (!seoData || typeof seoData !== 'object') {
      console.warn('[newsDomainSettings] AI did not return valid SEO JSON');
      return;
    }

    // Merge generated SEO with existing (don't overwrite user-provided values)
    const updatedSeo = {
      canonicalBaseUrl: existingSeo.canonicalBaseUrl || canonicalBaseUrl,
      defaultMetaTitle: existingSeo.defaultMetaTitle || seoData.defaultMetaTitle || '',
      defaultMetaDescription: existingSeo.defaultMetaDescription || seoData.defaultMetaDescription || '',
      keywords: existingSeo.keywords || seoData.keywords || '',
      ogImageUrl: existingSeo.ogImageUrl || null,
      ogTitle: existingSeo.ogTitle || seoData.ogTitle || seoData.defaultMetaTitle || '',
      ogDescription: existingSeo.ogDescription || seoData.ogDescription || seoData.defaultMetaDescription || '',
      homepageH1: existingSeo.homepageH1 || seoData.homepageH1 || '',
      tagline: existingSeo.tagline || seoData.tagline || '',
      robots: existingSeo.robots || seoData.robots || 'index,follow,max-image-preview:large',
      sitemapEnabled: existingSeo.sitemapEnabled !== undefined ? existingSeo.sitemapEnabled : true,
      organization: existingSeo.organization || null,
      socialLinks: existingSeo.socialLinks || null,
      robotsTxt: existingSeo.robotsTxt || null,
    };

    const updatedData = mergeSettings(existingData, { seo: updatedSeo });

    if (existing) {
      await (prisma as any).domainSettings.update({
        where: { id: existing.id },
        data: { data: updatedData },
      });
    } else {
      await (prisma as any).domainSettings.create({
        data: { tenantId, domainId, data: updatedData },
      });
    }

    console.log(`[newsDomainSettings] Auto-generated SEO for domain ${domainId}`);
  } catch (e: any) {
    console.error('[newsDomainSettings] AI SEO generation failed:', e.message);
  }
}
