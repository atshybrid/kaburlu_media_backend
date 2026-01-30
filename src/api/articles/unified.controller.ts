import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { sanitizeHtmlAllowlist, slugFromAnyLanguage, trimWords } from '../../lib/sanitize';
import { buildNewsArticleJsonLd } from '../../lib/seo';
import { notifyArticleStatusChange } from '../../lib/articleNotifications';

/**
 * UNIFIED ARTICLE CONTROLLER
 * 
 * Creates all 3 article types in ONE atomic transaction:
 * 1. NewspaperArticle (print/ePaper)
 * 2. TenantWebArticle (web CMS)
 * 3. ShortNews (mobile app)
 * 
 * Status Logic:
 * - REPORTER + autoPublish=true + publishReady=true → PUBLISHED
 * - REPORTER + autoPublish=true + publishReady=false → PENDING
 * - REPORTER + autoPublish=false → PENDING
 * - ADMIN/EDITOR → PUBLISHED
 */

function nowIsoIST(): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().replace('Z', '+05:30');
}

function wordCount(text: string): number {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function isHttpUrl(u: any): boolean {
  const s = String(u || '').trim();
  return Boolean(s) && /^https?:\/\//i.test(s);
}

function generateExternalArticleId(seq: number): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const n = String(seq).padStart(4, '0');
  return `ART${yyyy}${mm}${dd}${n}`;
}

async function getReporterAutoPublish(userId: string): Promise<boolean> {
  try {
    const reporter = await (prisma as any).reporter.findFirst({
      where: { userId },
      select: { kycData: true }
    });
    if (!reporter?.kycData) return false;
    const kycData = reporter.kycData;
    if (kycData.autoPublish === true) return true;
    if (kycData?.settings?.autoPublish === true) return true;
    return false;
  } catch {
    return false;
  }
}

async function resolveTenantId(req: Request): Promise<{ tenantId: string | null; error?: string }> {
  const user: any = (req as any).user;
  if (!user) return { tenantId: null, error: 'Unauthorized' };

  const roleName = String(user?.role?.name || '').toUpperCase();
  
  // SUPER_ADMIN: Must provide tenantId in payload
  if (roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN') {
    const tenantId = req.body?.tenantId || req.body?.baseArticle?.publisher?.tenantId;
    if (!tenantId) {
      return { tenantId: null, error: 'SUPER_ADMIN must provide tenantId in payload' };
    }
    return { tenantId: String(tenantId) };
  }

  // TENANT_ADMIN: Get from user's tenantAdmins or payload
  if (roleName === 'TENANT_ADMIN') {
    // First check payload
    const payloadTenantId = req.body?.tenantId || req.body?.baseArticle?.publisher?.tenantId;
    if (payloadTenantId) {
      // Verify user has access to this tenant
      const hasAccess = await (prisma as any).tenantAdmin.findFirst({
        where: { userId: user.id, tenantId: payloadTenantId }
      }).catch(() => null);
      if (hasAccess) {
        return { tenantId: String(payloadTenantId) };
      }
    }
    
    // Fallback: Get user's primary tenant
    const tenantAdmin = await (prisma as any).tenantAdmin.findFirst({
      where: { userId: user.id },
      select: { tenantId: true }
    }).catch(() => null);
    
    if (tenantAdmin?.tenantId) {
      return { tenantId: tenantAdmin.tenantId };
    }
    
    return { tenantId: null, error: 'TENANT_ADMIN not assigned to any tenant' };
  }

  // REPORTER and other roles: Get from reporter profile
  const reporter = await (prisma as any).reporter.findFirst({
    where: { userId: user.id },
    select: { tenantId: true }
  }).catch(() => null);

  return { tenantId: reporter?.tenantId || null };
}

async function resolveDomainId(tenantId: string, payloadDomainId?: string): Promise<{ domainId: string | null; domainName: string | null }> {
  // If domainId provided in payload, use it
  if (payloadDomainId) {
    const domain = await prisma.domain.findFirst({
      where: { id: payloadDomainId, tenantId },
      select: { id: true, domain: true }
    }).catch(() => null);
    
    if (domain) {
      return { domainId: domain.id, domainName: domain.domain };
    }
  }
  
  // Fallback: Get primary/active domain
  const domain = await prisma.domain.findFirst({
    where: { tenantId, status: 'ACTIVE' as any },
    orderBy: [{ isPrimary: 'desc' as any }, { createdAt: 'desc' as any }],
    select: { id: true, domain: true }
  }).catch(() => null);

  return { domainId: domain?.id || null, domainName: domain?.domain || null };
}

// Build web article HTML content
function buildWebContentHtml(webArticle: any): string {
  const parts: string[] = [];
  
  if (webArticle.headline) {
    parts.push(`<h1>${webArticle.headline}</h1>`);
  }
  
  if (webArticle.lead) {
    parts.push(`<p class="lead">${webArticle.lead}</p>`);
  }
  
  if (Array.isArray(webArticle.sections)) {
    for (const section of webArticle.sections) {
      if (section.subhead) {
        parts.push(`<h2>${section.subhead}</h2>`);
      }
      if (Array.isArray(section.paragraphs)) {
        for (const p of section.paragraphs) {
          parts.push(`<p>${p}</p>`);
        }
      }
    }
  } else if (Array.isArray(webArticle.body)) {
    for (const p of webArticle.body) {
      parts.push(`<p>${p}</p>`);
    }
  }
  
  return sanitizeHtmlAllowlist(parts.join(''));
}

function buildPlainText(webArticle: any): string {
  const parts: string[] = [];
  
  if (webArticle.headline) parts.push(webArticle.headline);
  if (webArticle.lead) parts.push(webArticle.lead);
  
  if (Array.isArray(webArticle.sections)) {
    for (const section of webArticle.sections) {
      if (section.subhead) parts.push(section.subhead);
      if (Array.isArray(section.paragraphs)) {
        parts.push(...section.paragraphs);
      }
    }
  } else if (Array.isArray(webArticle.body)) {
    parts.push(...webArticle.body);
  }
  
  return parts.filter(Boolean).join('\n');
}

/**
 * @swagger
 * /articles/unified:
 *   post:
 *     summary: Create all 3 article types in one atomic transaction
 *     description: |
 *       **UNIFIED ARTICLE CREATION**
 *       
 *       Creates NewspaperArticle + TenantWebArticle + ShortNews in ONE call.
 *       
 *       **Status Logic:**
 *       - REPORTER + autoPublish=true + publishReady=true → PUBLISHED
 *       - REPORTER + autoPublish=true + publishReady=false → PENDING
 *       - REPORTER + autoPublish=false → PENDING
 *       - ADMIN/EDITOR → PUBLISHED
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [baseArticle, location, printArticle]
 *     responses:
 *       201:
 *         description: All 3 articles created successfully
 */
export const createUnifiedArticle = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    
    // ========== VALIDATION ==========
    if (!payload.baseArticle) {
      return res.status(400).json({ error: 'baseArticle is required' });
    }
    
    if (!payload.location) {
      return res.status(400).json({ error: 'location is required' });
    }
    
    if (!payload.printArticle) {
      return res.status(400).json({ error: 'printArticle is required' });
    }
    
    if (!payload.printArticle.headline) {
      return res.status(400).json({ error: 'printArticle.headline is required' });
    }

    // ========== USER & TENANT ==========
    const user: any = (req as any).user;
    const authorId = user.id;
    const roleName = String(user?.role?.name || '').toUpperCase();
    
    const { tenantId, error: tenantError } = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: tenantError || 'Could not determine tenant' });
    }

    // ========== STATUS LOGIC ==========
    const publishReady = payload.publishControl?.publishReady === true;
    let reporterAutoPublish = false;
    
    if (roleName === 'REPORTER') {
      reporterAutoPublish = await getReporterAutoPublish(authorId);
    }
    
    // Status determination:
    // - REPORTER: autoPublish=true AND publishReady=true → PUBLISHED
    // - REPORTER: autoPublish=true BUT publishReady=false → PENDING
    // - REPORTER: autoPublish=false → PENDING
    // - ADMIN/EDITOR/SUPER_ADMIN → PUBLISHED
    let effectiveStatus: string;
    
    if (roleName === 'REPORTER') {
      if (reporterAutoPublish && publishReady) {
        effectiveStatus = 'PUBLISHED';
      } else {
        effectiveStatus = 'PENDING';
      }
    } else {
      // Admin, Editor, Super Admin
      effectiveStatus = 'PUBLISHED';
    }
    
    console.log(`[UnifiedArticle] Role: ${roleName}, autoPublish: ${reporterAutoPublish}, publishReady: ${publishReady}, status: ${effectiveStatus}`);

    // ========== EXTRACT DATA ==========
    const baseArticle = payload.baseArticle;
    const location = payload.location;
    const printArticle = payload.printArticle;
    const webArticle = payload.webArticle || {};
    const shortNews = payload.shortNews || {};
    const media = payload.media || {};
    
    const languageCode = String(baseArticle.languageCode || 'te').trim();
    const categoryId = baseArticle.category?.categoryId || null;
    
    // Location IDs
    const stateId = location.resolved?.state?.id || null;
    const districtId = location.resolved?.district?.id || null;
    const mandalId = location.resolved?.mandal?.id || null;
    const villageId = location.resolved?.village?.id || null;
    
    // Dateline
    const datelineFormatted = location.dateline?.formatted || '';
    const placeName = location.dateline?.placeName || location.resolved?.district?.name || '';
    
    // Print article data
    const headline = String(printArticle.headline || '').trim();
    const subtitle = printArticle.subtitle ? String(printArticle.subtitle).trim() : null;
    const bodyParagraphs = Array.isArray(printArticle.body) ? printArticle.body : [];
    const highlights = Array.isArray(printArticle.highlights) ? printArticle.highlights : [];
    const responses = Array.isArray(printArticle.responses) ? printArticle.responses : [];
    
    // Media
    const images = Array.isArray(media.images) ? media.images : [];
    const coverImageUrl = images[0]?.url || null;
    
    // Web SEO
    const seoSlug = webArticle.seo?.slug || slugFromAnyLanguage(headline, 120);
    const seoMetaTitle = webArticle.seo?.metaTitle || headline.slice(0, 60);
    const seoMetaDescription = webArticle.seo?.metaDescription || trimWords(bodyParagraphs.join(' '), 24).slice(0, 160);
    const seoKeywords = Array.isArray(webArticle.seo?.keywords) ? webArticle.seo.keywords : [];

    // ========== DOMAIN ==========
    const payloadDomainId = payload.domainId || payload.baseArticle?.publisher?.domainId;
    const { domainId, domainName } = await resolveDomainId(tenantId, payloadDomainId);

    // ========== RESOLVE LANGUAGE ID ==========
    let languageId: string | null = null;
    if (languageCode) {
      const lang = await prisma.language.findFirst({
        where: { code: languageCode },
        select: { id: true }
      });
      languageId = lang?.id || null;
    }

    // ========== RESOLVE CATEGORY SLUG (for sportLink URL) ==========
    let categorySlug: string | null = null;
    if (categoryId) {
      const cat = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { slug: true }
      });
      categorySlug = cat?.slug || null;
    }

    // ========== TRANSACTION: CREATE ALL 3 ARTICLES ==========
    const result = await prisma.$transaction(async (tx: any) => {
      
      // 0. Create base Article first (to link all 3 article types)
      const baseArticle = await tx.article.create({
        data: {
          tenantId,
          authorId,
          title: headline,
          type: 'UNIFIED',
          content: bodyParagraphs.join('\n\n'),
          languageId,
          status: effectiveStatus,
          isBreakingNews: payload.isBreaking || false,
          tags: seoKeywords.slice(0, 10),
          images: images.map((img: any) => img.url).filter(isHttpUrl),
          contentJson: {
            raw: {
              title: headline,
              content: bodyParagraphs.join('\n\n'),
              coverImageUrl,
            },
            seo: {
              slug: seoSlug,
              metaTitle: seoMetaTitle,
              metaDescription: seoMetaDescription,
            }
          }
        }
      });

      // Link base article to category (many-to-many)
      if (categoryId) {
        await tx.article.update({
          where: { id: baseArticle.id },
          data: {
            categories: {
              connect: { id: categoryId }
            }
          }
        });
      }

      // 1. Create NewspaperArticle (linked to base article)
      const newspaperArticle = await tx.newspaperArticle.create({
        data: {
          tenantId,
          authorId,
          baseArticleId: baseArticle.id,
          title: headline,
          heading: headline,
          subTitle: subtitle,
          lead: bodyParagraphs[0] || null,
          dateline: datelineFormatted,
          languageId,
          categoryId,
          stateId,
          districtId,
          mandalId,
          villageId,
          placeName,
          status: effectiveStatus,
          isBreaking: payload.isBreaking || false,
          featuredImageUrl: coverImageUrl,
          mediaUrls: images.map((img: any) => img.url).filter(isHttpUrl),
          content: bodyParagraphs.join('\n\n'),
          points: highlights,
          wordCount: wordCount(bodyParagraphs.join(' ')),
          charCount: bodyParagraphs.join(' ').length
        }
      });

      // 2. Create TenantWebArticle (if webArticle data exists)
      let tenantWebArticle = null;
      if (webArticle.headline || webArticle.lead || webArticle.sections?.length > 0) {
        const contentHtml = buildWebContentHtml(webArticle);
        const plainText = buildPlainText(webArticle);
        
        // Build canonical URL in new format: https://domain/categorySlug/articleSlug
        const canonicalUrl = domainName
          ? (categorySlug 
              ? `https://${domainName}/${categorySlug}/${seoSlug}`
              : `https://${domainName}/${seoSlug}`)
          : `/${seoSlug}`;
        
        const jsonLd = buildNewsArticleJsonLd({
          headline: webArticle.headline || headline,
          description: seoMetaDescription,
          canonicalUrl,
          imageUrls: coverImageUrl ? [coverImageUrl] : [],
          languageCode,
          datePublished: nowIsoIST(),
          dateModified: nowIsoIST(),
          keywords: seoKeywords.slice(0, 10)
        });

        // Build contentJson structure for TenantWebArticle
        const contentJson = {
          contentHtml,
          plainText,
          excerpt: webArticle.lead || null,
          highlights: printArticle.highlights || [],
          blocks: webArticle.sections || [],
          meta: {
            languageCode,
            canonicalUrl
          }
        };

        const isBreaking = payload.isBreaking || false;

        tenantWebArticle = await tx.tenantWebArticle.create({
          data: {
            tenantId,
            domainId,
            authorId,
            languageId,
            categoryId,
            title: webArticle.headline || headline,
            slug: seoSlug,
            isBreaking,
            contentJson,
            tags: seoKeywords.slice(0, 10),
            seoTitle: seoMetaTitle,
            metaDescription: seoMetaDescription,
            coverImageUrl,
            status: effectiveStatus,
            jsonLd,
            publishedAt: effectiveStatus === 'PUBLISHED' ? new Date() : null
          }
        });
      }

      // 3. Create ShortNews (if shortNews data exists)
      let shortNewsRecord = null;
      if (shortNews.h1 || shortNews.content) {
        shortNewsRecord = await tx.shortNews.create({
          data: {
            authorId,
            title: shortNews.h1 || headline,
            content: shortNews.content || trimWords(bodyParagraphs.join(' '), 60),
            summary: shortNews.content || trimWords(bodyParagraphs.join(' '), 60),
            language: languageCode,
            categoryId,
            placeName,
            featuredImage: coverImageUrl,
            mediaUrls: images.map((img: any) => img.url).filter(isHttpUrl),
            tags: seoKeywords.slice(0, 5),
            status: effectiveStatus,
            isBreaking: payload.isBreaking || false,
            slug: seoSlug,
            publishDate: effectiveStatus === 'PUBLISHED' ? new Date() : null
          }
        });
      }

      // 4. Update base Article with webArticleId and shortNewsId for linking
      await tx.article.update({
        where: { id: baseArticle.id },
        data: {
          contentJson: {
            ...(baseArticle.contentJson as any),
            webArticleId: tenantWebArticle?.id || null,
            shortNewsId: shortNewsRecord?.id || null,
            newspaperArticleId: newspaperArticle.id,
          }
        }
      });

      return {
        baseArticle,
        newspaperArticle,
        tenantWebArticle,
        shortNewsRecord
      };
    });

    // ========== RESPONSE ==========
    
    // Send push notification if article is PENDING (for admin review)
    if (effectiveStatus === 'PENDING' && result.tenantWebArticle) {
      notifyArticleStatusChange({
        id: result.tenantWebArticle.id,
        title: result.tenantWebArticle.title,
        authorId,
        tenantId,
        domainId,
        status: 'PENDING',
        previousStatus: 'NEW'
      }).catch(err => console.error('[ArticleNotify] Background notification failed:', err));
    }
    
    return res.status(201).json({
      success: true,
      message: 'All articles created successfully',
      status: effectiveStatus,
      data: {
        baseArticleId: result.baseArticle.id,
        newspaperArticle: {
          id: result.newspaperArticle.id,
          title: result.newspaperArticle.title,
          status: result.newspaperArticle.status
        },
        webArticle: result.tenantWebArticle ? {
          id: result.tenantWebArticle.id,
          title: result.tenantWebArticle.title,
          slug: result.tenantWebArticle.slug,
          status: result.tenantWebArticle.status,
          url: domainName && result.tenantWebArticle.slug 
            ? (categorySlug 
                ? `https://${domainName}/${categorySlug}/${result.tenantWebArticle.slug}`
                : `https://${domainName}/${result.tenantWebArticle.slug}`)
            : null
        } : null,
        shortNews: result.shortNewsRecord ? {
          id: result.shortNewsRecord.id,
          title: result.shortNewsRecord.title,
          status: result.shortNewsRecord.status
        } : null
      }
    });

  } catch (e: any) {
    console.error('[UnifiedArticle] Error:', e);
    return res.status(500).json({ 
      error: 'Failed to create articles',
      details: e.message 
    });
  }
};

/**
 * GET /articles/unified
 * List articles with filters (tenantId, domainId, type, from/to date, pagination)
 */
export const listUnifiedArticles = async (req: Request, res: Response) => {
  try {
    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '').toUpperCase();
    
    // Query params
    const {
      tenantId: queryTenantId,
      domainId,
      type,  // newspaper, web, shortNews, all
      status,
      fromDate,
      toDate,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Resolve tenant access
    let tenantId: string | null = null;
    
    if (roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN') {
      tenantId = queryTenantId ? String(queryTenantId) : null;
    } else if (roleName === 'TENANT_ADMIN') {
      if (queryTenantId) {
        const hasAccess = await (prisma as any).tenantAdmin.findFirst({
          where: { userId: user.id, tenantId: String(queryTenantId) }
        }).catch(() => null);
        tenantId = hasAccess ? String(queryTenantId) : null;
      }
      if (!tenantId) {
        const ta = await (prisma as any).tenantAdmin.findFirst({
          where: { userId: user.id },
          select: { tenantId: true }
        }).catch(() => null);
        tenantId = ta?.tenantId || null;
      }
    } else {
      const reporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id },
        select: { tenantId: true }
      }).catch(() => null);
      tenantId = reporter?.tenantId || null;
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Could not determine tenant' });
    }

    // Role-based access control:
    // REPORTER: only see their own articles
    // SUPER_ADMIN, TENANT_ADMIN, DESK_EDITOR, EDITOR: see all articles for the tenant
    const isReporter = roleName === 'REPORTER';
    const authorFilter = isReporter ? user.id : null;

    // Pagination
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Date filters
    const dateFilter: any = {};
    if (fromDate) {
      dateFilter.gte = new Date(String(fromDate));
    }
    if (toDate) {
      const to = new Date(String(toDate));
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }

    // Build where clause (base: tenantId, status, date, author)
    // NOTE: domainId only applies to TenantWebArticle (not NewspaperArticle or ShortNews)
    const baseWhere: any = { tenantId };
    if (status) baseWhere.status = String(status).toUpperCase();
    if (Object.keys(dateFilter).length > 0) baseWhere.createdAt = dateFilter;
    // If reporter, filter by authorId
    if (authorFilter) baseWhere.authorId = authorFilter;

    // Determine article type
    const articleType = String(type || 'all').toLowerCase();

    const results: any = {
      newspaper: null,
      web: null,
      shortNews: null
    };

    // Fetch based on type
    if (articleType === 'all' || articleType === 'newspaper') {
      // NewspaperArticle does NOT have domainId or publishedAt fields
      const newspaperWhere = { ...baseWhere };
      const [items, total] = await Promise.all([
        (prisma as any).newspaperArticle.findMany({
          where: newspaperWhere,
          orderBy: { [String(sortBy)]: sortOrder === 'asc' ? 'asc' : 'desc' },
          skip: articleType === 'newspaper' ? skip : 0,
          take: articleType === 'newspaper' ? limitNum : 5,
          select: {
            id: true,
            title: true,
            heading: true,
            status: true,
            languageId: true,
            featuredImageUrl: true,
            createdAt: true,
            updatedAt: true,
            author: { select: { id: true, mobileNumber: true } }
          }
        }),
        (prisma as any).newspaperArticle.count({ where: newspaperWhere })
      ]);
      results.newspaper = { items, total, page: pageNum, limit: limitNum };
    }

    if (articleType === 'all' || articleType === 'web') {
      const webWhere = { ...baseWhere };
      if (domainId) webWhere.domainId = String(domainId);

      const [items, total] = await Promise.all([
        (prisma as any).tenantWebArticle.findMany({
          where: webWhere,
          orderBy: { [String(sortBy)]: sortOrder === 'asc' ? 'asc' : 'desc' },
          skip: articleType === 'web' ? skip : 0,
          take: articleType === 'web' ? limitNum : 5,
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            languageId: true,
            coverImageUrl: true,
            createdAt: true,
            publishedAt: true,
            author: { select: { id: true, mobileNumber: true } }
          }
        }),
        (prisma as any).tenantWebArticle.count({ where: webWhere })
      ]);
      results.web = { items, total, page: pageNum, limit: limitNum };
    }

    if (articleType === 'all' || articleType === 'shortnews') {
      // ShortNews does NOT have tenantId field - filter via author.reporterProfile.tenantId
      const snWhere: any = {
        author: {
          reporterProfile: {
            tenantId
          }
        }
      };
      if (status) snWhere.status = String(status).toUpperCase();
      if (Object.keys(dateFilter).length > 0) snWhere.createdAt = dateFilter;
      // If reporter, filter by authorId directly
      if (authorFilter) snWhere.authorId = authorFilter;

      const [items, total] = await Promise.all([
        (prisma as any).shortNews.findMany({
          where: snWhere,
          orderBy: { [String(sortBy)]: sortOrder === 'asc' ? 'asc' : 'desc' },
          skip: articleType === 'shortnews' ? skip : 0,
          take: articleType === 'shortnews' ? limitNum : 5,
          select: {
            id: true,
            title: true,
            summary: true,
            status: true,
            language: true,
            featuredImage: true,
            createdAt: true,
            publishDate: true,
            author: { select: { id: true, mobileNumber: true } }
          }
        }),
        (prisma as any).shortNews.count({ where: snWhere })
      ]);
      results.shortNews = { items, total, page: pageNum, limit: limitNum };
    }

    return res.json({
      success: true,
      tenantId,
      type: articleType,
      filters: {
        domainId: domainId || null,
        status: status || null,
        fromDate: fromDate || null,
        toDate: toDate || null
      },
      data: results
    });

  } catch (e: any) {
    console.error('[UnifiedArticle] List Error:', e);
    return res.status(500).json({ error: 'Failed to list articles', details: e.message });
  }
};

/**
 * PATCH /articles/unified/:id
 * Update any article type (newspaper, web, shortNews)
 */
export const updateUnifiedArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // newspaper, web, shortNews
    const payload = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Article ID is required' });
    }

    const articleType = String(type || 'newspaper').toLowerCase();
    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '').toUpperCase();

    let updated: any = null;

    if (articleType === 'newspaper') {
      // Verify access
      const existing = await (prisma as any).newspaperArticle.findUnique({
        where: { id },
        select: { tenantId: true, authorId: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Newspaper article not found' });
      }

      // Check permissions
      if (roleName === 'REPORTER' && existing.authorId !== user.id) {
        return res.status(403).json({ error: 'Not authorized to update this article' });
      }

      // Build update data
      const updateData: any = { updatedAt: new Date() };
      
      if (payload.title !== undefined) updateData.title = String(payload.title).trim();
      if (payload.heading !== undefined) updateData.heading = String(payload.heading).trim();
      if (payload.subTitle !== undefined) updateData.subTitle = String(payload.subTitle).trim();
      if (payload.dateLine !== undefined) updateData.dateLine = String(payload.dateLine).trim();
      if (payload.status !== undefined) updateData.status = String(payload.status).toUpperCase();
      if (payload.content !== undefined) {
        updateData.content = Array.isArray(payload.content) 
          ? payload.content.map((p: string) => ({ type: 'paragraph', text: String(p || '').trim() }))
          : payload.content;
      }
      if (payload.bulletPoints !== undefined) updateData.bulletPoints = payload.bulletPoints;
      if (payload.coverImageUrl !== undefined) updateData.coverImageUrl = payload.coverImageUrl;
      if (payload.images !== undefined) updateData.images = payload.images;
      if (payload.categoryId !== undefined) updateData.categoryId = payload.categoryId;
      
      if (updateData.status === 'PUBLISHED' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }

      updated = await (prisma as any).newspaperArticle.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          externalId: true,
          title: true,
          status: true,
          updatedAt: true
        }
      });

    } else if (articleType === 'web') {
      const existing = await (prisma as any).tenantWebArticle.findUnique({
        where: { id },
        select: { tenantId: true, authorId: true, status: true, title: true, domainId: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Web article not found' });
      }

      if (roleName === 'REPORTER' && existing.authorId !== user.id) {
        return res.status(403).json({ error: 'Not authorized to update this article' });
      }

      const previousStatus = existing.status;
      const updateData: any = { updatedAt: new Date() };
      
      if (payload.title !== undefined) updateData.title = String(payload.title).trim();
      if (payload.slug !== undefined) updateData.slug = String(payload.slug).trim();
      if (payload.status !== undefined) updateData.status = String(payload.status).toUpperCase();
      if (payload.contentHtml !== undefined) updateData.contentHtml = sanitizeHtmlAllowlist(payload.contentHtml);
      if (payload.plainText !== undefined) updateData.plainText = String(payload.plainText).trim();
      if (payload.seoTitle !== undefined) updateData.seoTitle = String(payload.seoTitle).slice(0, 60);
      if (payload.metaDescription !== undefined) updateData.metaDescription = String(payload.metaDescription).slice(0, 160);
      if (payload.coverImageUrl !== undefined) updateData.coverImageUrl = payload.coverImageUrl;
      if (payload.tags !== undefined) updateData.tags = payload.tags;
      if (payload.categoryIds !== undefined) updateData.categoryIds = payload.categoryIds;

      if (updateData.status === 'PUBLISHED' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }

      updated = await (prisma as any).tenantWebArticle.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          updatedAt: true
        }
      });

      // Send push notification for status change (fire and forget)
      if (updateData.status && updateData.status !== previousStatus) {
        notifyArticleStatusChange({
          id,
          title: updateData.title || existing.title,
          authorId: existing.authorId,
          tenantId: existing.tenantId,
          domainId: existing.domainId,
          status: updateData.status,
          previousStatus,
          rejectionReason: payload.rejectionReason
        }).catch(err => console.error('[ArticleNotify] Background notification failed:', err));
      }

    } else if (articleType === 'shortnews') {
      // ShortNews does NOT have tenantId - only authorId
      const existing = await (prisma as any).shortNews.findUnique({
        where: { id },
        select: { authorId: true, publishDate: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'ShortNews not found' });
      }

      if (roleName === 'REPORTER' && existing.authorId !== user.id) {
        return res.status(403).json({ error: 'Not authorized to update this article' });
      }

      const updateData: any = { updatedAt: new Date() };
      
      // ShortNews uses 'title' not 'heading'
      if (payload.title !== undefined) updateData.title = String(payload.title).trim();
      if (payload.heading !== undefined) updateData.title = String(payload.heading).trim();
      if (payload.summary !== undefined) updateData.summary = trimWords(String(payload.summary).trim(), 60);
      if (payload.content !== undefined) updateData.content = trimWords(String(payload.content).trim(), 60);
      if (payload.status !== undefined) updateData.status = String(payload.status).toUpperCase();
      // ShortNews uses 'featuredImage' not 'coverImageUrl'
      if (payload.coverImageUrl !== undefined) updateData.featuredImage = payload.coverImageUrl;
      if (payload.featuredImage !== undefined) updateData.featuredImage = payload.featuredImage;
      if (payload.categoryId !== undefined) updateData.categoryId = payload.categoryId;

      // ShortNews uses 'publishDate' not 'publishedAt'
      if (updateData.status === 'PUBLISHED' || updateData.status === 'APPROVED') {
        if (!existing.publishDate) {
          updateData.publishDate = new Date();
        }
      }

      updated = await (prisma as any).shortNews.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true
        }
      });

    } else {
      return res.status(400).json({ error: 'Invalid type. Use: newspaper, web, or shortNews' });
    }

    return res.json({
      success: true,
      message: `${articleType} article updated successfully`,
      type: articleType,
      data: updated
    });

  } catch (e: any) {
    console.error('[UnifiedArticle] Update Error:', e);
    return res.status(500).json({ error: 'Failed to update article', details: e.message });
  }
};

/**
 * GET /articles/unified/:id
 * Get single article by ID (any type)
 */
export const getUnifiedArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Article ID is required' });
    }

    const articleType = String(type || 'newspaper').toLowerCase();
    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '').toUpperCase();

    let article: any = null;

    if (articleType === 'newspaper') {
      article = await (prisma as any).newspaperArticle.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, mobileNumber: true } },
          category: { select: { id: true, name: true } },
          state: { select: { id: true, name: true } },
          district: { select: { id: true, name: true } },
          mandal: { select: { id: true, name: true } }
        }
      });
    } else if (articleType === 'web') {
      article = await (prisma as any).tenantWebArticle.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, mobileNumber: true } },
          domain: { select: { id: true, domain: true } }
        }
      });
    } else if (articleType === 'shortnews') {
      article = await (prisma as any).shortNews.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, mobileNumber: true } },
          category: { select: { id: true, name: true } }
        }
      });
    } else {
      return res.status(400).json({ error: 'Invalid type. Use: newspaper, web, or shortNews' });
    }

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check access for REPORTER
    if (roleName === 'REPORTER' && article.authorId !== user.id) {
      return res.status(403).json({ error: 'Not authorized to view this article' });
    }

    return res.json({
      success: true,
      type: articleType,
      data: article
    });

  } catch (e: any) {
    console.error('[UnifiedArticle] Get Error:', e);
    return res.status(500).json({ error: 'Failed to get article', details: e.message });
  }
};

