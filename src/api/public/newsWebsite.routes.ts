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
 *     summary: 🎨 Get complete website configuration (Multi-tenant optimized)
 *     description: |
 *       **✨ BEST PRACTICE MULTI-TENANT NEWS WEBSITE CONFIG**
 *       
 *       Single endpoint that returns everything needed for frontend initialization:
 *       - Tenant & Domain context
 *       - Branding & Theme (colors, typography, assets)
 *       - SEO settings (meta, OG, Twitter, JSON-LD)
 *       - Content settings (languages, formats)
 *       - Integrations (Analytics, Ads, Push)
 *       - Features flags (PWA, commenting, bookmarking)
 *       - Navigation (header, footer, mobile)
 *       - Social media links
 *       - Contact information
 *       - Cache control hints
 *       
 *       **Cache:** ISR 3600s (1 hour), Stale-While-Revalidate
 *       
 *       **Version:** 2.0 - Enhanced multi-tenant structure
 *     tags: [News Website API 2.0]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional domain override for local testing
 *         schema: { type: string, example: "telangana.kaburlu.com" }
 *     responses:
 *       200:
 *         description: Complete website configuration (Multi-tenant optimized)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version: { type: string, example: "2.0" }
 *                 timestamp: { type: string, format: date-time }
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     slug: { type: string }
 *                     name: { type: string }
 *                     displayName: { type: string }
 *                     timezone: { type: string, example: "Asia/Kolkata" }
 *                     locale: { type: string, example: "te" }
 *                 domain:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     domain: { type: string }
 *                     baseUrl: { type: string }
 *                     kind: { type: string, enum: [WEBSITE, EPAPER] }
 *                     status: { type: string }
 *                     environment: { type: string, enum: [development, production] }
 *                 branding:
 *                   type: object
 *                   properties:
 *                     siteName: { type: string }
 *                     siteTagline: { type: string, nullable: true }
 *                     logo: { type: string, nullable: true }
 *                     favicon: { type: string, nullable: true }
 *                     appleTouchIcon: { type: string, nullable: true }
 *                 theme:
 *                   type: object
 *                   properties:
 *                     colors:
 *                       type: object
 *                       properties:
 *                         primary: { type: string, example: "#1976d2" }
 *                         secondary: { type: string, example: "#dc004e" }
 *                         headerBg: { type: string }
 *                         footerBg: { type: string }
 *                     typography:
 *                       type: object
 *                       properties:
 *                         fontFamily: { type: string }
 *                         fontFamilyHeadings: { type: string, nullable: true }
 *                     assets:
 *                       type: object
 *                       properties:
 *                         logo: { type: string, nullable: true }
 *                         favicon: { type: string, nullable: true }
 *                         headerHtml: { type: string, nullable: true }
 *                         footerHtml: { type: string, nullable: true }
 *                     layout:
 *                       type: object
 *                       properties:
 *                         style: { type: string, example: "style1" }
 *                         headerStyle: { type: string }
 *                         footerStyle: { type: string }
 *                         containerWidth: { type: number, example: 1280 }
 *                         homepageConfig: { type: object, nullable: true }
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
 *                         card: { type: string }
 *                         handle: { type: string, nullable: true }
 *                         title: { type: string }
 *                         description: { type: string }
 *                         imageUrl: { type: string, nullable: true }
 *                     jsonLd:
 *                       type: object
 *                       properties:
 *                         organizationUrl: { type: string }
 *                         websiteUrl: { type: string }
 *                     urls:
 *                       type: object
 *                       properties:
 *                         robotsTxt: { type: string }
 *                         sitemapXml: { type: string }
 *                         rssFeed: { type: string }
 *                 content:
 *                   type: object
 *                   properties:
 *                     defaultLanguage: { type: string, example: "te" }
 *                     supportedLanguages:
 *                       type: array
 *                       items: { type: string }
 *                     languages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code: { type: string }
 *                           name: { type: string }
 *                           nativeName: { type: string }
 *                           direction: { type: string }
 *                           defaultForTenant: { type: boolean }
 *                     dateFormat: { type: string, example: "DD/MM/YYYY" }
 *                     timeFormat: { type: string, example: "12h" }
 *                 integrations:
 *                   type: object
 *                   properties:
 *                     analytics:
 *                       type: object
 *                       properties:
 *                         googleAnalytics: { type: string, nullable: true }
 *                         googleTagManager: { type: string, nullable: true }
 *                         enabled: { type: boolean }
 *                     ads:
 *                       type: object
 *                       properties:
 *                         adsense: { type: string, nullable: true }
 *                         enabled: { type: boolean }
 *                     push:
 *                       type: object
 *                       properties:
 *                         vapidPublicKey: { type: string, nullable: true }
 *                         enabled: { type: boolean }
 *                     social:
 *                       type: object
 *                       properties:
 *                         facebookAppId: { type: string, nullable: true }
 *                         twitterHandle: { type: string, nullable: true }
 *                 features:
 *                   type: object
 *                   properties:
 *                     darkMode: { type: boolean }
 *                     pwaPushNotifications: { type: boolean }
 *                     commenting: { type: boolean }
 *                     bookmarking: { type: boolean }
 *                     sharing: { type: boolean }
 *                     liveUpdates: { type: boolean }
 *                     newsletter: { type: boolean }
 *                     ePaper: { type: boolean }
 *                     mobileApp: { type: boolean }
 *                 navigation:
 *                   type: object
 *                   properties:
 *                     header:
 *                       type: object
 *                       properties:
 *                         primaryMenu:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               label: { type: string }
 *                               href: { type: string }
 *                               icon: { type: string, nullable: true }
 *                         utilityMenu: { type: array }
 *                         showSearch: { type: boolean }
 *                         showLanguageSwitcher: { type: boolean }
 *                         sticky:
 *                           type: object
 *                           properties:
 *                             enabled: { type: boolean }
 *                             offsetPx: { type: number }
 *                     footer:
 *                       type: object
 *                       properties:
 *                         sections:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               title: { type: string }
 *                               links: { type: array }
 *                         copyrightText: { type: string }
 *                         showSocialLinks: { type: boolean }
 *                     mobile:
 *                       type: object
 *                       properties:
 *                         bottomNav: { type: array }
 *                         quickActions: { type: array }
 *                 social:
 *                   type: object
 *                   properties:
 *                     facebook: { type: string, nullable: true }
 *                     twitter: { type: string, nullable: true }
 *                     instagram: { type: string, nullable: true }
 *                     youtube: { type: string, nullable: true }
 *                     telegram: { type: string, nullable: true }
 *                     linkedin: { type: string, nullable: true }
 *                     whatsapp: { type: string, nullable: true }
 *                 contact:
 *                   type: object
 *                   properties:
 *                     email: { type: string, nullable: true }
 *                     phone: { type: string, nullable: true }
 *                     address:
 *                       type: object
 *                       properties:
 *                         street: { type: string, nullable: true }
 *                         city: { type: string, nullable: true }
 *                         state: { type: string, nullable: true }
 *                         country: { type: string }
 *                         postalCode: { type: string, nullable: true }
 *                 layout:
 *                   type: object
 *                   properties:
 *                     showTicker: { type: boolean }
 *                     showTopBar: { type: boolean }
 *                     showBreadcrumbs: { type: boolean }
 *                     showReadingProgress: { type: boolean }
 *                     articlesPerPage: { type: number, example: 20 }
 *                 admin:
 *                   type: object
 *                   properties:
 *                     name: { type: string, nullable: true }
 *                     mobile: { type: string, nullable: true }
 *                 cacheControl:
 *                   type: object
 *                   description: Recommended cache TTL in seconds for different resource types
 *                   properties:
 *                     config: { type: number, example: 3600 }
 *                     homepage: { type: number, example: 300 }
 *                     article: { type: number, example: 600 }
 *                     category: { type: number, example: 300 }
 *                     staticPages: { type: number, example: 86400 }
 *       500:
 *         description: Domain context missing
 */
router.get('/config', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });

  try {
    const [tenantTheme, tenantEntity, domainLanguages, domainSettings, tenantNavigation] = await Promise.all([
      p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
      p.tenantEntity.findUnique({ 
        where: { tenantId: tenant.id }, 
        include: { language: true } 
      }).catch(() => null),
      p.domainLanguage.findMany({ 
        where: { domainId: domain.id }, 
        include: { language: true } 
      }).catch(() => []),
      p.domainSettings?.findUnique?.({ where: { domainId: domain.id } }).catch(() => null),
      p.tenantNavigation?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null)
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

    // Theme details from TenantTheme
    const theme = {
      colors: {
        primary: (tenantTheme as any)?.primaryColor ?? branding.primaryColor ?? '#1976d2',
        secondary: (tenantTheme as any)?.secondaryColor ?? branding.secondaryColor ?? '#dc004e',
        headerBg: (tenantTheme as any)?.headerBgColor ?? '#ffffff',
        footerBg: (tenantTheme as any)?.footerBgColor ?? '#f5f5f5'
      },
      typography: {
        fontFamily: (tenantTheme as any)?.fontFamily ?? branding.fontFamily ?? 'Inter, system-ui, sans-serif',
        fontFamilyHeadings: effectiveDomainSettings?.theme?.typography?.fontFamilyHeadings ?? null
      },
      assets: {
        logo: (tenantTheme as any)?.logoUrl ?? branding.logoUrl,
        favicon: (tenantTheme as any)?.faviconUrl ?? branding.faviconUrl,
        headerHtml: (tenantTheme as any)?.headerHtml ?? null,
        footerHtml: (tenantTheme as any)?.footerHtml ?? null
      },
      layout: {
        style: effectiveDomainSettings?.themeStyle ?? 'style1',
        headerStyle: effectiveDomainSettings?.layout?.headerStyle ?? 'default',
        footerStyle: effectiveDomainSettings?.layout?.footerStyle ?? 'default',
        containerWidth: effectiveDomainSettings?.layout?.containerWidth ?? 1280,
        homepageConfig: (tenantTheme as any)?.homepageConfig ?? null
      }
    };

    // Navigation from TenantNavigation with fallback structure
    const navigationConfig = tenantNavigation ? (tenantNavigation as any).config : null;
    const navigation = {
      header: {
        primaryMenu: navigationConfig?.primaryLinks ?? [
          { label: 'Home', href: '/', icon: null },
          { label: 'Latest', href: '/latest', icon: null }
        ],
        utilityMenu: navigationConfig?.utilityLinks ?? [],
        showSearch: effectiveDomainSettings?.navigation?.showSearch ?? true,
        showLanguageSwitcher: (domainLanguages?.length ?? 0) > 1,
        sticky: navigationConfig?.sticky ?? { enabled: true, offsetPx: 0 }
      },
      footer: {
        sections: effectiveDomainSettings?.footer?.sections ?? [
          {
            title: 'Quick Links',
            links: [
              { label: 'About Us', href: '/about-us' },
              { label: 'Contact', href: '/contact-us' },
              { label: 'Advertise', href: '/advertise' }
            ]
          },
          {
            title: 'Legal',
            links: [
              { label: 'Privacy Policy', href: '/privacy-policy' },
              { label: 'Terms & Conditions', href: '/terms' },
              { label: 'Disclaimer', href: '/disclaimer' }
            ]
          }
        ],
        copyrightText: effectiveDomainSettings?.footer?.copyrightText ?? `© ${new Date().getFullYear()} ${branding.siteName}. All rights reserved.`,
        showSocialLinks: effectiveDomainSettings?.footer?.showSocialLinks ?? true
      },
      mobile: {
        bottomNav: navigationConfig?.mobile?.bottomNavLinks ?? [
          { label: 'Home', href: '/', icon: 'home' },
          { label: 'Categories', href: '/categories', icon: 'grid' },
          { label: 'Saved', href: '/saved', icon: 'bookmark' },
          { label: 'Menu', href: '/menu', icon: 'menu' }
        ],
        quickActions: navigationConfig?.mobile?.quickActions ?? []
      }
    };

    // Social media links
    const social = {
      facebook: effectiveDomainSettings?.social?.facebook ?? null,
      twitter: effectiveDomainSettings?.social?.x ?? effectiveDomainSettings?.social?.twitter ?? null,
      instagram: effectiveDomainSettings?.social?.instagram ?? null,
      youtube: effectiveDomainSettings?.social?.youtube ?? null,
      telegram: effectiveDomainSettings?.social?.telegram ?? null,
      linkedin: effectiveDomainSettings?.social?.linkedin ?? null,
      whatsapp: effectiveDomainSettings?.social?.whatsapp ?? null
    };

    // Feature flags
    const features = {
      darkMode: effectiveDomainSettings?.features?.darkMode ?? false,
      pwaPushNotifications: !!integrations.push.vapidPublicKey,
      commenting: effectiveDomainSettings?.features?.commenting ?? false,
      bookmarking: effectiveDomainSettings?.features?.bookmarking ?? true,
      sharing: effectiveDomainSettings?.features?.sharing ?? true,
      liveUpdates: effectiveDomainSettings?.features?.liveUpdates ?? false,
      newsletter: effectiveDomainSettings?.features?.newsletter ?? false,
      ePaper: (domain.kind === 'EPAPER') || (effectiveDomainSettings?.features?.ePaper ?? false),
      mobileApp: effectiveDomainSettings?.features?.mobileApp ?? false
    };

    // Contact information
    const contact = {
      email: effectiveDomainSettings?.contact?.email ?? null,
      phone: effectiveDomainSettings?.contact?.phone ?? null,
      address: {
        street: effectiveDomainSettings?.contact?.address ?? null,
        city: effectiveDomainSettings?.contact?.city ?? null,
        state: effectiveDomainSettings?.contact?.region ?? null,
        country: effectiveDomainSettings?.contact?.country ?? 'India',
        postalCode: effectiveDomainSettings?.contact?.postalCode ?? null
      }
    };

    // Cache control hints for frontend
    const cacheControl = {
      config: 3600, // 1 hour
      homepage: 300, // 5 minutes
      article: 600, // 10 minutes
      category: 300, // 5 minutes
      staticPages: 86400 // 24 hours
    };

    return res.json({
      version: '2.0',
      timestamp: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        displayName: (tenant as any)?.displayName || tenant.name,
        timezone: 'Asia/Kolkata',
        locale: tenantDefaultCode || 'te'
      },
      domain: {
        id: domain.id,
        domain: domain.domain,
        baseUrl,
        kind: domain.kind,
        status: domain.status,
        environment: process.env.NODE_ENV || 'production'
      },
      branding: {
        siteName: branding.siteName,
        siteTagline: effectiveDomainSettings?.branding?.tagline ?? null,
        logo: branding.logoUrl,
        favicon: branding.faviconUrl,
        appleTouchIcon: effectiveDomainSettings?.branding?.appleTouchIcon ?? branding.logoUrl
      },
      theme,
      seo: {
        meta: seoMeta,
        openGraph: seoOpenGraph,
        twitter: seoTwitter,
        jsonLd: {
          organizationUrl: `${baseUrl}/#organization`,
          websiteUrl: `${baseUrl}/#website`
        },
        urls: {
          robotsTxt: `${baseUrl}/robots.txt`,
          sitemapXml: `${baseUrl}/sitemap.xml`,
          rssFeed: `${baseUrl}/rss.xml`
        }
      },
      content: {
        defaultLanguage: tenantDefaultCode || 'te',
        supportedLanguages: languages.map((l: any) => l.code),
        languages,
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h'
      },
      integrations: {
        analytics: {
          googleAnalytics: integrations.analytics.googleAnalyticsId,
          googleTagManager: integrations.analytics.gtmId,
          enabled: !!(integrations.analytics.googleAnalyticsId || integrations.analytics.gtmId)
        },
        ads: {
          adsense: integrations.ads.adsenseClientId,
          enabled: !!integrations.ads.adsenseClientId
        },
        push: {
          vapidPublicKey: integrations.push.vapidPublicKey,
          enabled: !!integrations.push.vapidPublicKey
        },
        social: {
          facebookAppId: effectiveDomainSettings?.integrations?.social?.facebookAppId ?? null,
          twitterHandle: seoTwitter.handle
        }
      },
      features,
      navigation,
      social,
      contact,
      layout: {
        showTicker: layout.showTicker ?? true,
        showTopBar: layout.showTopBar ?? true,
        showBreadcrumbs: effectiveDomainSettings?.layout?.showBreadcrumbs ?? true,
        showReadingProgress: effectiveDomainSettings?.layout?.showReadingProgress ?? true,
        articlesPerPage: effectiveDomainSettings?.layout?.articlesPerPage ?? 20
      },
      admin: {
        name: tenantAdmin.name,
        mobile: tenantAdmin.mobile
      },
      cacheControl
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
