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

/**
 * Generate Telugu news website SEO using Aksharam-style Telugu news language.
 * SuperAdmin API - takes tenantId, fetches tenant info, generates SEO.
 */
export async function generateTeluguNewsSeo(tenantId: string): Promise<{
  success: boolean;
  seo?: any;
  error?: string;
}> {
  try {
    // Fetch tenant with related data
    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: tenantId },
      include: {
        state: true,
        domains: {
          where: { kind: 'NEWS' },
          take: 1,
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    // Get tenant entity for language
    const tenantEntity = await (prisma as any).tenantEntity?.findUnique?.({
      where: { tenantId },
      include: { language: true },
    }).catch(() => null);

    // Get categories for tenant
    const categories = await (prisma as any).category.findMany({
      where: { tenantId, isActive: true, isDeleted: false },
      take: 10,
      orderBy: { displayOrder: 'asc' },
      include: {
        translations: {
          where: { language: 'te' },
          take: 1,
        },
      },
    }).catch(() => []);

    const websiteName = String(tenant.name || tenant.slug || 'News');
    const stateName = tenant.state?.name || 'Telangana';
    const langCode = String(tenantEntity?.language?.code || 'te');

    // Build category names for prompt
    const categoryNames = categories
      .map((c: any) => c.translations?.[0]?.name || c.name)
      .filter(Boolean)
      .join(', ') || 'వార్తలు, రాజకీయాలు, వ్యాపారం, క్రీడలు';

    // Your custom Telugu SEO prompt
    const prompt = `You are a senior Telugu news SEO editor.

VOICE & LANGUAGE:
- Use Aksharam-style Telugu news language.
- Clear, formal, neutral, and trustworthy tone.
- Pure Telugu (no slang, no poetic or sensational words).

TASK:
Generate SEO metadata for a Telugu news website focused on ${stateName}.

INPUT:
- Website Name (English): ${websiteName}
- Primary Categories: ${categoryNames}
- Coverage Area: ${stateName}

SEO RULES:
1. WEBSITE TITLE must be MIXED:
   - Telugu primary SEO phrase first
   - English website name after a pipe ( | )
   - Format: "<Telugu SEO Phrase> | <Website Name>"
2. Website title must be under 60 characters.
3. Meta description must be in Telugu only and under 160 characters.
4. Meta description must clearly state:
   - Type of news
   - ${stateName} focus
5. Keywords must be relevant, natural, 5–10 items.
   - Telugu preferred
   - English brand name allowed.

OPEN GRAPH RULES:
1. OG title must match or closely align with website title.
2. OG description must be in Telugu only.
3. OG type must be "website".

OUTPUT FORMAT (STRICT JSON ONLY):

{
  "website_seo": {
    "title": "",
    "meta_description": "",
    "keywords": []
  },
  "open_graph": {
    "og_title": "",
    "og_description": "",
    "og_type": "website"
  }
}

IMPORTANT:
- Do not add explanations.
- Do not use markdown.
- Output valid JSON only.`;

    const aiResponse = await aiGenerateText({ prompt, purpose: 'seo' });
    const parsed = tryParseJson(aiResponse?.text || '');

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'AI did not return valid JSON' };
    }

    // Extract and normalize the SEO data
    const websiteSeo = pickObject(parsed.website_seo);
    const openGraph = pickObject(parsed.open_graph);

    const seoResult = {
      defaultMetaTitle: websiteSeo.title || '',
      defaultMetaDescription: websiteSeo.meta_description || '',
      keywords: Array.isArray(websiteSeo.keywords) 
        ? websiteSeo.keywords.join(', ') 
        : String(websiteSeo.keywords || ''),
      ogTitle: openGraph.og_title || websiteSeo.title || '',
      ogDescription: openGraph.og_description || websiteSeo.meta_description || '',
      ogType: openGraph.og_type || 'website',
      generatedBy: 'ai-telugu-seo',
      generatedAt: new Date().toISOString(),
    };

    // Find NEWS domain for tenant
    const newsDomain = tenant.domains?.[0];
    if (!newsDomain) {
      // Return generated SEO without saving (no NEWS domain)
      return { success: true, seo: seoResult };
    }

    // Update domain settings with generated SEO
    const domainId = newsDomain.id;
    const existing = await (prisma as any).domainSettings?.findUnique?.({ where: { domainId } }).catch(() => null);
    const existingData = pickObject(existing?.data);
    const existingSeo = pickObject(existingData.seo);

    // Generate robots.txt content for news website
    const domainUrl = `https://${newsDomain.domain}`;
    const robotsTxt = `# robots.txt for ${websiteName}
# Generated: ${new Date().toISOString()}

User-agent: *
Allow: /

# Allow all major search engines
User-agent: Googlebot
Allow: /

User-agent: Googlebot-News
Allow: /

User-agent: Bingbot
Allow: /

# Disallow admin and API routes
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard/
Disallow: /_next/
Disallow: /auth/

# Disallow search and filter pages to avoid duplicate content
Disallow: /*?*
Allow: /*?page=

# Sitemap location
Sitemap: ${domainUrl}/sitemap.xml
Sitemap: ${domainUrl}/sitemap-news.xml

# Crawl-delay for polite crawling (optional)
Crawl-delay: 1
`;

    // Merge - don't overwrite existing values
    const mergedSeo = {
      ...existingSeo,
      canonicalBaseUrl: existingSeo.canonicalBaseUrl || domainUrl,
      defaultMetaTitle: existingSeo.defaultMetaTitle || seoResult.defaultMetaTitle,
      defaultMetaDescription: existingSeo.defaultMetaDescription || seoResult.defaultMetaDescription,
      keywords: existingSeo.keywords || seoResult.keywords,
      ogTitle: existingSeo.ogTitle || seoResult.ogTitle,
      ogDescription: existingSeo.ogDescription || seoResult.ogDescription,
      ogType: existingSeo.ogType || seoResult.ogType,
      robots: existingSeo.robots || 'index,follow,max-image-preview:large',
      robotsTxt: existingSeo.robotsTxt || robotsTxt,
      sitemapEnabled: existingSeo.sitemapEnabled !== undefined ? existingSeo.sitemapEnabled : true,
      generatedBy: seoResult.generatedBy,
      generatedAt: seoResult.generatedAt,
    };

    const updatedData = mergeSettings(existingData, { seo: mergedSeo });

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

    console.log(`[newsDomainSettings] Telugu SEO generated for tenant ${tenantId}`);
    return { success: true, seo: mergedSeo };
  } catch (e: any) {
    console.error('[newsDomainSettings] Telugu SEO generation failed:', e.message);
    return { success: false, error: e.message };
  }
}
