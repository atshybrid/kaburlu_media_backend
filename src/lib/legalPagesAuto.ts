/**
 * Auto-generate legal/static pages (Privacy Policy, Terms, Disclaimer, etc.)
 * when domain is created using AI with tenant context
 */

import prisma from './prisma';
import { aiGenerateText } from './aiProvider';

interface GenerateLegalPagesOptions {
  force?: boolean; // Regenerate even if pages exist
  pages?: ('privacy-policy' | 'terms' | 'disclaimer' | 'about-us' | 'contact-us' | 'editorial-policy')[];
}

/**
 * Auto-generate comprehensive legal pages for a tenant using AI.
 * Collects data from TenantEntity and DomainSettings to personalize content.
 */
export async function autoGenerateLegalPages(
  tenantId: string,
  domainId: string,
  options: GenerateLegalPagesOptions = {}
): Promise<void> {
  const force = options.force ?? false;
  const pagesToGenerate = options.pages ?? ['privacy-policy', 'terms', 'disclaimer', 'about-us', 'contact-us', 'editorial-policy'];

  // Gather tenant context
  const tenant = await (prisma as any).tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, name: true, createdAt: true }
  });

  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const domain = await (prisma as any).domain.findUnique({
    where: { id: domainId },
    select: { id: true, domain: true, kind: true }
  });

  if (!domain) throw new Error(`Domain ${domainId} not found`);

  const tenantEntity = await (prisma as any).tenantEntity.findUnique({
    where: { tenantId },
    select: {
      prgiNumber: true,
      registrationTitle: true,
      nativeName: true,
      periodicity: true,
      registrationDate: true,
      ownerName: true,
      publisherName: true,
      editorName: true,
      address: true,
      publicationCountry: true,
      publicationState: true,
      publicationDistrict: true,
      publicationMandal: true,
    }
  });

  const domainSettings = await (prisma as any).domainSettings.findUnique({
    where: { domainId },
    select: { data: true }
  });

  const settingsData = (domainSettings?.data || {}) as any;
  const branding = settingsData.branding || {};
  const seo = settingsData.seo || {};
  const contact = settingsData.contact || {};

  // Build context for AI
  const siteName = branding.siteName || tenant.name;
  const domainName = domain.domain;
  const canonicalUrl = seo.canonicalBaseUrl || `https://${domainName}`;
  const publisherName = tenantEntity?.publisherName || siteName;
  const editorName = tenantEntity?.editorName || 'Editorial Team';
  const ownerName = tenantEntity?.ownerName || publisherName;
  const address = tenantEntity?.address || contact.officeAddress || 'Not specified';
  const email = contact.email || `contact@${domainName}`;
  const phone = contact.phone || contact.helpLine1 || 'Not specified';
  const registrationNumber = tenantEntity?.prgiNumber || 'Not specified';
  const language = settingsData.language || 'en';

  // Check existing pages
  const existing = await (prisma as any).tenantStaticPage.findMany({
    where: {
      tenantId,
      slug: { in: pagesToGenerate }
    },
    select: { slug: true, id: true }
  });

  const existingSlugs = new Set(existing.map((p: any) => p.slug));

  for (const pageSlug of pagesToGenerate) {
    if (!force && existingSlugs.has(pageSlug)) {
      console.log(`[LegalPagesAuto] Page ${pageSlug} already exists for tenant ${tenantId}, skipping`);
      continue;
    }

    console.log(`[LegalPagesAuto] Generating ${pageSlug} for ${siteName} (${domainName})...`);

    try {
      const content = await generatePageContent(pageSlug, {
        siteName,
        domainName,
        canonicalUrl,
        publisherName,
        editorName,
        ownerName,
        address,
        email,
        phone,
        registrationNumber,
        language,
        tenantEntity,
        domainKind: domain.kind,
      });

      if (!content) {
        console.warn(`[LegalPagesAuto] Failed to generate content for ${pageSlug}`);
        continue;
      }

      const title = content.title || toTitleCase(pageSlug);

      // Upsert page
      await (prisma as any).tenantStaticPage.upsert({
        where: {
          tenantId_slug: { tenantId, slug: pageSlug }
        },
        create: {
          tenantId,
          slug: pageSlug,
          title,
          contentHtml: content.html,
          meta: content.meta || {},
          published: true
        },
        update: {
          title,
          contentHtml: content.html,
          meta: content.meta || {},
          published: true
        }
      });

      console.log(`[LegalPagesAuto] ✓ Generated ${pageSlug}`);
    } catch (error) {
      console.error(`[LegalPagesAuto] Error generating ${pageSlug}:`, error);
    }
  }
}

interface PageContext {
  siteName: string;
  domainName: string;
  canonicalUrl: string;
  publisherName: string;
  editorName: string;
  ownerName: string;
  address: string;
  email: string;
  phone: string;
  registrationNumber: string;
  language: string;
  tenantEntity: any;
  domainKind: string;
}

async function generatePageContent(
  slug: string,
  context: PageContext
): Promise<{ title: string; html: string; meta?: any } | null> {
  const prompt = buildPromptForPage(slug, context);
  if (!prompt) return null;

  try {
    const response = await aiGenerateText({
      prompt,
      purpose: 'seo'
    });

    const text = response?.text || '';
    if (!text) return null;

    // Parse JSON response
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const data = JSON.parse(cleaned);

    return {
      title: data.title || toTitleCase(slug),
      html: data.html || data.content || '',
      meta: data.meta || {}
    };
  } catch (error) {
    console.error(`[LegalPagesAuto] AI generation failed for ${slug}:`, error);
    return null;
  }
}

function buildPromptForPage(slug: string, ctx: PageContext): string | null {
  const currentYear = new Date().getFullYear();
  const isDomestic = ctx.tenantEntity?.publicationCountry === 'India' || !ctx.tenantEntity?.publicationCountry;
  const isNews = ctx.domainKind === 'NEWS';
  const isEpaper = ctx.domainKind === 'EPAPER';

  const baseInstructions = `You are an expert legal content writer specializing in digital media. 
Generate a comprehensive, legally sound ${toTitleCase(slug)} page in ${ctx.language === 'te' ? 'Telugu and English (bilingual)' : 'English'}.

Website Details:
- Site Name: ${ctx.siteName}
- Domain: ${ctx.domainName}
- Type: ${isNews ? 'News Website' : isEpaper ? 'ePaper Platform' : 'Media Platform'}
- Publisher: ${ctx.publisherName}
- Editor: ${ctx.editorName}
- Owner: ${ctx.ownerName}
- Address: ${ctx.address}
- Email: ${ctx.email}
- Phone: ${ctx.phone}
- Registration: ${ctx.registrationNumber}
${isDomestic ? `- Country: India (follow Indian IT Act, Press Council guidelines)` : ''}

CRITICAL OUTPUT FORMAT:
Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Page title (50-70 characters)",
  "html": "Complete HTML content using semantic tags: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>",
  "meta": {
    "description": "SEO description (150-160 characters)",
    "keywords": "comma-separated keywords"
  }
}

CONTENT REQUIREMENTS:
`;

  switch (slug) {
    case 'privacy-policy':
      return baseInstructions + `
Create a comprehensive Privacy Policy covering:
1. **Information Collection**: What data we collect (personal info, cookies, analytics, reading preferences)
2. **Use of Information**: How we use collected data
3. **Data Sharing**: Third-party sharing policies (ad networks, analytics)
4. **Cookies**: Cookie usage and user control
5. **User Rights**: Access, correction, deletion rights ${isDomestic ? '(GDPR/DPDP Act compliance)' : ''}
6. **Security**: Data protection measures
7. **Children's Privacy**: Policy for users under 18
8. **Changes**: How policy updates are communicated
9. **Contact**: Privacy inquiries contact (${ctx.email})
10. **Effective Date**: ${currentYear}
${isNews ? '\n11. **News Content**: User-generated content, comments policy\n12. **Location Data**: How we use location for local news' : ''}
${isEpaper ? '\n11. **Subscription Data**: How subscription info is stored\n12. **Download Tracking**: ePaper download analytics' : ''}

Make it professional, clear, and legally compliant. Use clear section headings.`;

    case 'terms':
      return baseInstructions + `
Create comprehensive Terms of Service covering:
1. **Acceptance**: Agreement to terms by using the site
2. **Services**: Description of ${isNews ? 'news content' : isEpaper ? 'ePaper access' : 'services'} provided
3. **User Accounts**: Registration, account security, responsibilities
4. **Intellectual Property**: Copyright ownership (© ${currentYear} ${ctx.publisherName})
5. **User Conduct**: Prohibited activities, content guidelines
6. **Content Accuracy**: Disclaimer about ${isNews ? 'news accuracy' : 'information accuracy'}
7. **Links**: Third-party links disclaimer
8. **Limitation of Liability**: Legal limitations
9. **Termination**: Account termination policies
10. **Governing Law**: ${isDomestic ? 'Indian jurisdiction' : 'Applicable jurisdiction'}
11. **Contact**: Legal inquiries (${ctx.email})
12. **Effective Date**: ${currentYear}
${isNews ? '\n13. **Comments**: User-generated content moderation\n14. **Breaking News**: Accuracy disclaimers' : ''}
${isEpaper ? '\n13. **Subscriptions**: Payment terms, refund policy\n14. **Access**: ePaper download limits, DRM' : ''}

Professional legal tone, clear structure with numbered sections.`;

    case 'disclaimer':
      return baseInstructions + `
Create a comprehensive Disclaimer covering:
1. **General Information**: ${isNews ? 'News content' : 'Content'} is for informational purposes only
2. **Accuracy**: We strive for accuracy but don't guarantee completeness
3. **Professional Advice**: Not a substitute for professional ${isNews ? 'advice' : 'consultation'}
4. **External Links**: No responsibility for third-party content
5. **Changes**: Content may be updated without notice
6. **Errors**: Report errors to ${ctx.email}
7. **Opinions**: Views expressed may not reflect ${ctx.publisherName}'s position
8. **Liability**: No liability for decisions made based on content
9. **Copyright**: © ${currentYear} ${ctx.publisherName} - All rights reserved
${isDomestic ? '\n10. **Press Council**: Adheres to Press Council of India guidelines' : ''}
${isNews ? '\n11. **Breaking News**: Developing stories may contain preliminary information\n12. **Corrections**: How we handle corrections and updates' : ''}

Clear, concise legal disclaimers with proper structure.`;

    case 'about-us':
      return baseInstructions + `
Create an engaging About Us page covering:
1. **Introduction**: Who we are (${ctx.siteName})
2. **Mission**: Our commitment to ${isNews ? 'quality journalism' : 'serving readers'}
3. **History**: ${ctx.tenantEntity?.registrationDate ? `Established ${new Date(ctx.tenantEntity.registrationDate).getFullYear()}` : 'Our journey'}
4. **Team**: Led by Editor ${ctx.editorName}, Publisher ${ctx.publisherName}
5. **Coverage**: ${isNews ? 'News categories we cover (local, politics, sports, etc.)' : isEpaper ? 'Digital ePaper editions' : 'Our content'}
6. **Values**: Integrity, accuracy, independence
7. **Registration**: ${ctx.registrationNumber !== 'Not specified' ? `RNI: ${ctx.registrationNumber}` : 'Registered media organization'}
8. **Contact**: Reach us at ${ctx.email} or ${ctx.phone}
9. **Location**: ${ctx.address}
${isDomestic ? '\n10. **Compliance**: Following Indian media guidelines and ethics' : ''}

Warm, professional tone. Make it engaging and trustworthy.`;

    case 'contact-us':
      return baseInstructions + `
Create a comprehensive Contact Us page:
1. **Introduction**: Get in touch with ${ctx.siteName}
2. **General Inquiries**: ${ctx.email}
3. **Phone**: ${ctx.phone}
4. **Editorial Team**: How to reach the newsroom
5. **Advertising**: advertising@${ctx.domainName}
6. **Technical Support**: support@${ctx.domainName}
7. **Office Address**: ${ctx.address}
8. **Business Hours**: Mention typical hours or "24/7 newsroom"
9. **Social Media**: Placeholder for social links
10. **Feedback**: How to provide feedback or report issues
${isNews ? '\n11. **News Tips**: tips@' + ctx.domainName + ' - Share story tips\n12. **Press Releases**: media@' + ctx.domainName : ''}

Friendly, accessible tone. Include clear contact methods.`;

    case 'editorial-policy':
      return baseInstructions + `
Create a professional Editorial Policy covering:
1. **Mission**: Commitment to ${isNews ? 'quality journalism' : 'quality content'}
2. **Principles**: Accuracy, fairness, independence, accountability
3. **Editorial Independence**: Free from political/commercial influence
4. **Fact-Checking**: Verification processes before publication
5. **Sources**: How we verify sources and quotes
6. **Corrections**: Transparent correction policy (contact: ${ctx.email})
7. **Conflicts of Interest**: How we handle potential conflicts
8. **Opinion vs News**: Clear separation of news and opinion
9. **Diversity**: Commitment to diverse perspectives
10. **Ethics**: ${isDomestic ? 'Press Council of India norms' : 'Professional journalism ethics'}
${isNews ? '\n11. **Breaking News**: How we handle developing stories\n12. **User Content**: Moderation of comments and submissions' : ''}

Professional, authoritative tone. Clear commitment to journalistic integrity.`;

    default:
      return null;
  }
}

function toTitleCase(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
