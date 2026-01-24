import { Router } from 'express';
import prisma from '../../lib/prisma';
import { toWebArticleCardDto, toWebArticleDetailDto } from '../../lib/tenantWebArticleView';
import { buildNewsArticleJsonLd } from '../../lib/seo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: News Website API 2.0
 *     description: |
 *       🚀 **Optimized News Website APIs** - Best practice consolidated endpoints
 *       
 *       **Key Improvements:**
 *       - Single /config endpoint (replaces /theme, /languages)
 *       - Unified /articles with powerful filtering
 *       - Homepage SEO schema support
 *       - Related articles support
 *       - Better pagination with totalPages
 *       
 *       **Performance:**
 *       - Homepage: 2 API calls (instead of 5+)
 *       - ISR/SSG friendly responses
 *       - Optimized for Next.js App Router
 */

/**
 * @swagger
 * /public/config:
 *   get:
 *     summary: 🎨 Get complete website configuration (Theme, Branding, SEO, Languages)
 *     description: |
 *       **✨ NEW CONSOLIDATED ENDPOINT** - Replaces /theme, /languages, and settings from /epaper/verify-domain
 *       
 *       Returns everything needed for website initialization in ONE call:
 *       - Branding (logo, colors, fonts)
 *       - SEO defaults (meta tags, OG, Twitter)
 *       - Languages (domain-allowed list)
 *       - Integrations (GA, GTM, AdSense public keys)
 *       - Layout settings (header, footer, ticker)
 *       - Tenant admin contact
 *       
 *       **Cache:** ISR 3600s (1 hour), Stale-While-Revalidate
 *       
 *       **Use case:** Call once on app initialization or page load
 *     tags: [News Website API 2.0]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional domain override for local testing
 *         schema: { type: string, example: "news.kaburlu.com" }
 *     responses:
 *       200:
 *         description: Complete website configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     slug: { type: string }
 *                     name: { type: string }
 *                     displayName: { type: string }
 *                 domain:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     domain: { type: string }
 *                     kind: { type: string, enum: [WEBSITE, EPAPER] }
 *                     status: { type: string }
 *                 branding:
 *                   type: object
 *                   properties:
 *                     logoUrl: { type: string, nullable: true }
 *                     faviconUrl: { type: string, nullable: true }
 *                     primaryColor: { type: string, example: "#e91e63" }
 *                     secondaryColor: { type: string, nullable: true }
 *                     siteName: { type: string }
 *                     fontFamily: { type: string, nullable: true }
 *                 seo:
 *                   type: object
 *                   properties:
 *                     meta:
 *                       type: object
 *                       properties:
 *                         title: { type: string }
 *                         description: { type: string }
 *                         keywords: { type: string, nullable: true }
 *                     openGraph:
 *                       type: object
 *                       properties:
 *                         url: { type: string }
 *                         title: { type: string }
 *                         description: { type: string }
 *                         imageUrl: { type: string, nullable: true }
 *                         siteName: { type: string }
 *                     twitter:
 *                       type: object
 *                       properties:
 *                         card: { type: string, example: "summary_large_image" }
 *                         handle: { type: string, nullable: true }
 *                     urls:
 *                       type: object
 *                       properties:
 *                         robotsTxt: { type: string }
 *                         sitemapXml: { type: string }
 *                 content:
 *                   type: object
 *                   properties:
 *                     defaultLanguage: { type: string, example: "te" }
 *                     languages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code: { type: string }
 *                           name: { type: string }
 *                           nativeName: { type: string }
 *                           direction: { type: string, enum: [ltr, rtl] }
 *                           defaultForTenant: { type: boolean }
 *                 integrations:
 *                   type: object
 *                   properties:
 *                     analytics:
 *                       type: object
 *                       properties:
 *                         googleAnalyticsId: { type: string, nullable: true }
 *                         gtmId: { type: string, nullable: true }
 *                     ads:
 *                       type: object
 *                       properties:
 *                         adsenseClientId: { type: string, nullable: true }
 *                     push:
 *                       type: object
 *                       properties:
 *                         vapidPublicKey: { type: string, nullable: true }
 *                 layout:
 *                   type: object
 *                   properties:
 *                     showTicker: { type: boolean, nullable: true }
 *                     showTopBar: { type: boolean, nullable: true }
 *                 tenantAdmin:
 *                   type: object
 *                   properties:
 *                     name: { type: string, nullable: true }
 *                     mobile: { type: string, nullable: true }
 *       500:
 *         description: Domain context missing
 */
router.get('/config', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });

  try {
    const [tenantTheme, tenantEntity, domainLanguages, domainSettings] = await Promise.all([
      p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
      p.tenantEntity.findUnique({ 
        where: { tenantId: tenant.id }, 
        include: { language: true } 
      }).catch(() => null),
      p.domainLanguage.findMany({ 
        where: { domainId: domain.id }, 
        include: { language: true } 
      }).catch(() => []),
      p.domainSettings?.findUnique?.({ where: { domainId: domain.id } }).catch(() => null)
    ]);

    const baseUrl = `https://${domain.domain}`;
    const tenantDefaultCode = tenantEntity?.language?.code;
    
    // Branding
    const effectiveDomainSettings = (domainSettings as any)?.data || {};
    const branding = {
      logoUrl: effectiveDomainSettings?.branding?.logoUrl ?? (tenantTheme as any)?.logoUrl ?? null,
      faviconUrl: effectiveDomainSettings?.branding?.faviconUrl ?? (tenantTheme as any)?.faviconUrl ?? null,
      primaryColor: (tenantTheme as any)?.primaryColor ?? effectiveDomainSettings?.theme?.colors?.primary ?? null,
      secondaryColor: (tenantTheme as any)?.secondaryColor ?? effectiveDomainSettings?.theme?.colors?.secondary ?? null,
      siteName: effectiveDomainSettings?.branding?.siteName ?? tenant.name ?? null,
      fontFamily: (tenantTheme as any)?.fontFamily ?? effectiveDomainSettings?.theme?.typography?.fontFamily ?? null
    };

    // SEO
    const seoBase = effectiveDomainSettings?.seo || (tenantTheme as any)?.seoConfig || {};
    const seoMeta = {
      title: seoBase?.defaultMetaTitle ?? null,
      description: seoBase?.defaultMetaDescription ?? null,
      keywords: seoBase?.keywords ?? null
    };

    const seoOpenGraph = {
      url: baseUrl,
      title: seoBase?.ogTitle ?? seoBase?.defaultMetaTitle ?? null,
      description: seoBase?.ogDescription ?? seoBase?.defaultMetaDescription ?? null,
      imageUrl: seoBase?.ogImageUrl ?? null,
      siteName: branding.siteName
    };

    const seoTwitter = {
      card: seoBase?.twitterCard ?? 'summary_large_image',
      handle: seoBase?.twitterHandle ?? null,
      title: seoBase?.twitterTitle ?? seoOpenGraph.title,
      description: seoBase?.twitterDescription ?? seoOpenGraph.description,
      imageUrl: seoBase?.twitterImageUrl ?? seoOpenGraph.imageUrl
    };

    // Languages
    const languages = domainLanguages.map((dl: any) => ({
      code: dl.language.code,
      name: dl.language.name,
      nativeName: dl.language.nativeName,
      direction: dl.language.direction,
      defaultForTenant: dl.language.code === tenantDefaultCode
    }));

    // Integrations (public keys only)
    const integ = effectiveDomainSettings?.integrations || {};
    const integrations = {
      analytics: {
        googleAnalyticsId: integ?.analytics?.googleAnalyticsMeasurementId ?? integ?.analytics?.gaMeasurementId ?? null,
        gtmId: integ?.analytics?.googleTagManagerId ?? integ?.analytics?.gtmContainerId ?? null
      },
      ads: {
        adsenseClientId: integ?.ads?.adsenseClientId ?? integ?.ads?.adsensePublisherId ?? null
      },
      push: {
        vapidPublicKey: integ?.push?.webPushVapidPublicKey ?? integ?.push?.vapidPublicKey ?? null
      }
    };

    // Layout
    const layout = {
      showTicker: effectiveDomainSettings?.layout?.showTicker ?? null,
      showTopBar: effectiveDomainSettings?.layout?.showTopBar ?? null
    };

    // Tenant admin
    let tenantAdmin: { name: string | null; mobile: string | null } = { name: null, mobile: null };
    try {
      const adminReporter = await p.reporter.findFirst({
        where: { tenantId: tenant.id, user: { role: { name: 'TENANT_ADMIN' } } },
        include: {
          user: {
            select: {
              mobileNumber: true,
              profile: { select: { fullName: true } }
            }
          }
        }
      });
      if (adminReporter?.user) {
        tenantAdmin = {
          name: adminReporter.user.profile?.fullName || tenantEntity?.publisherName || null,
          mobile: adminReporter.user.mobileNumber || null
        };
      } else {
        tenantAdmin = {
          name: tenantEntity?.publisherName || tenantEntity?.editorName || null,
          mobile: null
        };
      }
    } catch {}

    return res.json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        displayName: (tenant as any)?.displayName || tenant.name
      },
      domain: {
        id: domain.id,
        domain: domain.domain,
        kind: domain.kind,
        status: domain.status
      },
      branding,
      seo: {
        meta: seoMeta,
        openGraph: seoOpenGraph,
        twitter: seoTwitter,
        urls: {
          robotsTxt: `${baseUrl}/robots.txt`,
          sitemapXml: `${baseUrl}/sitemap.xml`
        }
      },
      content: {
        defaultLanguage: tenantDefaultCode || null,
        languages
      },
      integrations,
      layout,
      tenantAdmin
    });
  } catch (error) {
    console.error('Error in /config:', error);
    return res.status(500).json({ error: 'Failed to load configuration' });
  }
});

/**
 * @swagger
 * /public/seo/homepage:
 *   get:
 *     summary: 🔍 Get homepage SEO structured data (Organization + WebSite JSON-LD)
 *     description: |
 *       Returns Schema.org structured data for homepage.
 *       
 *       **Includes:**
 *       - Organization schema with logo and social links
 *       - WebSite schema with search action
 *       - Properly formatted for Google News compliance
 *       
 *       **Cache:** ISR 3600s (1 hour)
 *       
 *       **Use case:** Render in homepage <script type="application/ld+json">
 *     tags: [News Website API 2.0]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: JSON-LD structured data
 *         content:
 *           application/json:
 *             example:
 *               context: "https://schema.org"
 *               graph:
 *                 - type: "WebSite"
 *                   url: "https://yourdomain.com"
 *                   name: "Your News Site"
 *                 - type: "Organization"
 *                   name: "Your News Organization"
 *                   logo: "https://yourdomain.com/logo.png"
 */
router.get('/seo/homepage', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });

  try {
    const [tenantTheme, domainSettings] = await Promise.all([
      p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
      p.domainSettings?.findUnique?.({ where: { domainId: domain.id } }).catch(() => null)
    ]);

    const baseUrl = `https://${domain.domain}`;
    const effectiveDomainSettings = (domainSettings as any)?.data || {};
    const seoConfig = effectiveDomainSettings?.seo || {};
    
    const siteName = effectiveDomainSettings?.branding?.siteName ?? tenant.name;
    const logoUrl = effectiveDomainSettings?.branding?.logoUrl ?? (tenantTheme as any)?.logoUrl ?? null;
    const socialLinks = seoConfig?.socialLinks || seoConfig?.organization?.sameAs || [];

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${baseUrl}/#website`,
          url: baseUrl,
          name: siteName,
          description: seoConfig?.defaultMetaDescription || null,
          inLanguage: 'te',
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${baseUrl}/search?q={search_term_string}`
            },
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@type': 'Organization',
          '@id': `${baseUrl}/#organization`,
          name: siteName,
          url: baseUrl,
          ...(logoUrl ? {
            logo: {
              '@type': 'ImageObject',
              url: logoUrl,
              width: 512,
              height: 512
            }
          } : {}),
          ...(Array.isArray(socialLinks) && socialLinks.length ? { sameAs: socialLinks } : {})
        }
      ]
    };

    return res.json(jsonLd);
  } catch (error) {
    console.error('Error in /seo/homepage:', error);
    return res.status(500).json({ error: 'Failed to generate SEO data' });
  }
});

export default router;
