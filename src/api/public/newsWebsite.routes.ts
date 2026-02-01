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
 *                     nativeName: { type: string, description: "Native language name from TenantEntity" }
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
        nativeName: tenantEntity?.nativeName || (tenant as any)?.displayName || tenant.name,
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
        appleTouchIcon: effectiveDomainSettings?.branding?.appleTouchIcon ?? branding.logoUrl,

        // Legacy fields (kept for older clients)
        logoUrl: branding.logoUrl,
        faviconUrl: branding.faviconUrl,
        primaryColor: theme.colors.primary,
        secondaryColor: theme.colors.secondary,
        fontFamily: theme.typography.fontFamily
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
          enabled: !!(integrations.analytics.googleAnalyticsId || integrations.analytics.gtmId),

          // Legacy fields
          googleAnalyticsId: integrations.analytics.googleAnalyticsId,
          gtmId: integrations.analytics.gtmId
        },
        ads: {
          adsense: integrations.ads.adsenseClientId,
          enabled: !!integrations.ads.adsenseClientId,

          // Legacy fields
          adsenseClientId: integrations.ads.adsenseClientId
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

      // Legacy field name
      tenantAdmin: {
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
 * /public/smart-homepage:
 *   get:
 *     summary: ⚡ Smart Homepage - Auto-detects Style1/Style2
 *     description: |
 *       🚀 **SMART HOMEPAGE API - Theme-aware Layout**
 *       
 *       Single endpoint that returns ALL homepage data structured for the detected theme.
 *       Theme is auto-detected from `DomainSettings.data.themeStyle` (defaults to style1).
 *       
 *       ---
 *       
 *       ## **Style1 Layout** (default)
 *       | Section | Description | Articles |
 *       |---------|-------------|----------|
 *       | flashTicker | Breaking news ticker | 12 items |
 *       | heroSection | 4-column grid | heroLead(8) + latest(7) + mostRead(8) + topViewed(4) |
 *       | categorySection1 | First 4 categories | 4 × 5 = 20 |
 *       | categorySection2 | Next 4 categories | 4 × 5 = 20 |
 *       | categoryHub | Next 4 categories | 4 × 5 = 20 |
 *       
 *       ---
 *       
 *       ## **Style2 Layout** (TOI-style)
 *       | Section | Style | Articles |
 *       |---------|-------|----------|
 *       | flashTicker | Ticker strip | 10 items |
 *       | heroSection | TOI 3-column | left(10) + center(9) + right(11) |
 *       | categoryColumns | 3-col grid | 6 cats × 5 = 30 |
 *       | magazineGrid | Emerald | 1 cat × 6 |
 *       | horizontalCards | Rose | 1 cat × 6 |
 *       | spotlight | Amber | 1 cat × 6 |
 *       | newspaperColumns | Blue | 1 cat × 6 |
 *       | extraMagazineGrid | Violet | 1 cat × 6 |
 *       | extraHorizontalCards | Cyan | 1 cat × 6 |
 *       | photoGallery | Slate | 1 cat × 6 |
 *       | timeline | Gray | 1 cat × 6 |
 *       | compactLists | Green/Purple | 2 cats × 6 = 12 |
 *       
 *       ---
 *       
 *       **Smart Features:**
 *       - Theme auto-detected from domain settings
 *       - Categories injected top-to-bottom by createdAt order
 *       - Section `visible: false` when no articles exist
 *       
 *       **Cache:** ISR 180s (3 minutes)
 *     tags: [News Website API 2.0]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string, example: "aksharamvoice.com" }
 *       - in: query
 *         name: lang
 *         schema: { type: string, example: "te" }
 *         description: Language filter (optional)
 *     responses:
 *       200:
 *         description: Theme-specific homepage data (style1 or style2)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version: { type: string, example: "2.0-smart-style1 or 2.0-smart-style2" }
 *                 themeStyle: { type: string, enum: [style1, style2] }
 *                 timestamp: { type: string, format: date-time }
 *                 flashTicker: { type: object }
 *                 heroSection: { type: object }
 *                 meta: { type: object }
 *       500:
 *         description: Server error
 */
router.get('/smart-homepage', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });

  try {
    // Get domain settings for theme style detection
    const domainSettings = await p.domainSettings?.findUnique?.({ where: { domainId: domain.id } }).catch(() => null);
    const effectiveDomainSettings = (domainSettings as any)?.data || {};
    const themeStyle = effectiveDomainSettings?.themeStyle || 'style1';

    // Parse query parameters with defaults
    const langCode = req.query.lang ? String(req.query.lang).toLowerCase().trim() : null;

    // Build language filter
    let languageFilter: any = {};
    if (langCode) {
      const language = await p.language.findUnique({ where: { code: langCode } }).catch(() => null);
      if (language) {
        languageFilter = { languageId: language.id };
      }
    }

    // Build domain scope - include both domain-specific and shared (domainId=null) articles
    const domainScope = { OR: [{ domainId: domain.id }, { domainId: null }] };

    // Base where clause for published articles
    const baseWhere = {
      tenantId: tenant.id,
      status: 'PUBLISHED',
      ...domainScope,
      ...languageFilter
    };

    // Style1 Layout Configuration:
    // - flashTicker: 12 breaking news items
    // - heroSection: 4 columns (heroLead: 8, latest: 7, mostRead: 8, topViewed: 4 = 27 total)
    // - categorySection1: 4 categories × 5 articles = 20
    // - categorySection2: 4 categories × 5 articles = 20
    // - categoryHub: 4 categories × 5 articles = 20
    // Total categories needed: 12

    // Get ALL domain categories ordered by createdAt (no position field)
    const domainCategories = await p.domainCategory.findMany({
      where: { domainId: domain.id },
      include: { category: { select: { id: true, slug: true, name: true, iconUrl: true } } },
      orderBy: { createdAt: 'asc' }
    });

    // Parallel data fetching for hero section
    const [
      latestArticles,
      mostReadArticles,
      topViewedArticles,
      totalArticlesCount
    ] = await Promise.all([
      // Latest news for heroLead + latest column (15 articles: 8 for lead, 7 for latest)
      p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 27, // heroLead(8) + latest(7) + ticker backup
        include: {
          category: { select: { id: true, slug: true, name: true, iconUrl: true } },
          language: { select: { code: true } }
        }
      }),
      
      // Most read articles for mostRead column (8 articles)
      p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take: 8,
        include: {
          category: { select: { id: true, slug: true, name: true } }
        }
      }),

      // Top viewed for sidebar (4 articles)
      p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ viewCount: 'desc' }],
        take: 4,
        select: {
          id: true,
          title: true,
          slug: true,
          coverImageUrl: true,
          viewCount: true,
          publishedAt: true
        }
      }),

      // Total count for meta
      p.tenantWebArticle.count({ where: baseWhere })
    ]);

    // Helper: Format article for response
    const formatArticle = (a: any) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.metaDescription || null,
      imageUrl: a.coverImageUrl || null,
      categoryId: a.category?.id || null,
      categoryName: a.category?.name || null,
      categorySlug: a.category?.slug || null,
      publishedAt: a.publishedAt,
      isBreaking: a.isBreaking || false,
      viewCount: a.viewCount || 0
    });

    // Helper: Fetch articles for a category
    const fetchCategoryArticles = async (cat: any, limit: number = 5) => {
      if (!cat) return null;

      const categoryWhere: any = {
        tenantId: tenant.id,
        status: 'PUBLISHED',
        categoryId: cat.id,
        OR: [{ domainId: domain.id }, { domainId: null }]
      };
      if (languageFilter.languageId) {
        categoryWhere.languageId = languageFilter.languageId;
      }

      const [articles, count] = await Promise.all([
        p.tenantWebArticle.findMany({
          where: categoryWhere,
          orderBy: [{ publishedAt: 'desc' }],
          take: limit,
          include: {
            category: { select: { id: true, slug: true, name: true, iconUrl: true } }
          }
        }),
        p.tenantWebArticle.count({ where: categoryWhere })
      ]);

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categorySlug: cat.slug,
        categoryIcon: cat.iconUrl || null,
        articlesCount: count,
        articles: articles.map(formatArticle),
        visible: articles.length > 0
      };
    };

    // Split categories into 3 groups of 4 each for Style1 sections
    const allCategories = domainCategories.map((dc: any) => dc.category).filter(Boolean);
    const section1Categories = allCategories.slice(0, 4);   // First 4 categories
    const section2Categories = allCategories.slice(4, 8);   // Next 4 categories  
    const hubCategories = allCategories.slice(8, 12);       // Next 4 categories

    // Fetch articles for all category sections in parallel
    const [section1Data, section2Data, hubData] = await Promise.all([
      Promise.all(section1Categories.map((cat: any) => fetchCategoryArticles(cat, 5))),
      Promise.all(section2Categories.map((cat: any) => fetchCategoryArticles(cat, 5))),
      Promise.all(hubCategories.map((cat: any) => fetchCategoryArticles(cat, 5)))
    ]);

    // Filter out null/empty categories
    const section1Valid = section1Data.filter((s: any) => s && s.visible);
    const section2Valid = section2Data.filter((s: any) => s && s.visible);
    const hubValid = hubData.filter((s: any) => s && s.visible);

    // Build flashTicker from first 12 latest articles (or breaking news)
    const tickerItems = latestArticles.slice(0, 12).map((a: any) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      categorySlug: a.category?.slug || null,
      publishedAt: a.publishedAt,
      isBreaking: a.isBreaking || false
    }));

    // Build heroSection columns
    const heroLeadArticles = latestArticles.slice(0, 8);   // First 8 for hero lead
    const latestColumnArticles = latestArticles.slice(8, 15); // Next 7 for latest column

    // ========================================
    // STYLE2 RESPONSE
    // ========================================
    if (themeStyle === 'style2') {
      // Style2 Layout Configuration:
      // - flashTicker: 10 breaking news items
      // - heroSection (TOI-style): Left (1 hero + 8 secondary = 9), Right (5 most read + 6 latest = 11)
      // - categoryColumns: 6 main categories × 5 articles = 30
      // - magazineGrid: 1 category × 6 articles
      // - horizontalCards: 1 category × 6 articles
      // - spotlight: 1 category × 6 articles
      // - newspaperColumns: 1 category × 6 articles
      // - extraMagazineGrid: 1 category × 6 articles
      // - extraHorizontalCards: 1 category × 6 articles
      // - photoGallery: 1 category × 6 articles
      // - timeline: 1 category × 6 articles
      // - featuredBanner: 1 featured article
      // - compactLists: 2 categories × 6 articles each = 12
      // Total categories needed: 6 (main columns) + 8 (styled sections) + 2 (compact) = 16

      // Split categories for Style2
      const mainCategories = allCategories.slice(0, 6);     // First 6 for main columns
      const styledSectionCats = allCategories.slice(6, 14); // Next 8 for styled sections
      const compactListCats = allCategories.slice(14, 16);  // Next 2 for compact lists

      // Fetch main category columns (6 categories × 5 articles)
      const mainColumnsData = await Promise.all(
        mainCategories.map((cat: any) => fetchCategoryArticles(cat, 5))
      );
      const mainColumnsValid = mainColumnsData.filter((s: any) => s && s.visible);

      // Fetch styled sections (8 categories × 6 articles each)
      const styledSectionsData = await Promise.all(
        styledSectionCats.map((cat: any) => fetchCategoryArticles(cat, 6))
      );

      // Fetch compact list categories (2 × 6 articles)
      const compactListsData = await Promise.all(
        compactListCats.map((cat: any) => fetchCategoryArticles(cat, 6))
      );

      // Section styles for Style2
      const sectionStyles = [
        { key: 'magazineGrid', style: 'magazine-grid', color: 'emerald' },
        { key: 'horizontalCards', style: 'horizontal-cards', color: 'rose' },
        { key: 'spotlight', style: 'spotlight', color: 'amber' },
        { key: 'newspaperColumns', style: 'newspaper-columns', color: 'blue' },
        { key: 'extraMagazineGrid', style: 'magazine-grid', color: 'violet' },
        { key: 'extraHorizontalCards', style: 'horizontal-cards', color: 'cyan' },
        { key: 'photoGallery', style: 'photo-gallery', color: 'slate' },
        { key: 'timeline', style: 'timeline', color: 'gray' }
      ];

      // Build styled sections
      const styledSections: any = {};
      sectionStyles.forEach((ss, idx) => {
        const catData = styledSectionsData[idx];
        styledSections[ss.key] = {
          visible: catData && catData.visible,
          style: ss.style,
          color: ss.color,
          ...(catData || { categoryId: null, categoryName: null, categorySlug: null, articles: [], articlesCount: 0 })
        };
      });

      // Build Style2 response
      const style2Response = {
        version: '2.0-smart-style2',
        themeStyle: 'style2',
        timestamp: new Date().toISOString(),

        // Section 1: Flash Ticker
        flashTicker: {
          visible: tickerItems.length > 0,
          items: tickerItems.slice(0, 10)
        },

        // Section 2: Hero Section (TOI-style 3 columns)
        heroSection: {
          visible: latestArticles.length > 0,
          layout: 'toi-grid-3',
          columns: {
            // Left: In The News (10 items)
            leftRail: {
              label: 'వార్తల్లో',
              articles: latestArticles.slice(15, 25).map(formatArticle)
            },
            // Center: Hero Lead (1 hero + 2 medium + 6 small = 9)
            centerLead: {
              hero: latestArticles[0] ? formatArticle(latestArticles[0]) : null,
              medium: latestArticles.slice(1, 3).map(formatArticle),
              small: latestArticles.slice(3, 9).map(formatArticle)
            },
            // Right: Latest + Most Read (6 + 5 = 11)
            rightRail: {
              latest: {
                label: 'తాజా వార్తలు',
                articles: latestArticles.slice(9, 15).map(formatArticle)
              },
              mostRead: {
                label: 'ఎక్కువగా చదివినవి',
                articles: mostReadArticles.slice(0, 5).map(formatArticle)
              }
            }
          }
        },

        // Section 3: Ad Banner (Leaderboard)
        adLeaderboard1: {
          visible: true,
          slot: 'homepage_leaderboard_1'
        },

        // Section 4: Category Columns Grid (6 main categories × 5 articles)
        categoryColumns: {
          visible: mainColumnsValid.length > 0,
          label: 'వార్తా విభాగాలు',
          columnsPerRow: 3,
          categories: mainColumnsValid
        },

        // Styled sections (dynamically built)
        ...styledSections,

        // Ad between sections
        adHorizontal1: {
          visible: true,
          slot: 'homepage_horizontal_1'
        },

        // Featured Banner (single featured article)
        featuredBanner: {
          visible: latestArticles.length > 0,
          article: latestArticles[0] ? formatArticle(latestArticles[0]) : null
        },

        // Compact Lists (2 categories side by side)
        compactLists: {
          visible: compactListsData.some((d: any) => d && d.visible),
          sections: compactListsData.filter((d: any) => d && d.visible).map((d: any, idx: number) => ({
            ...d,
            color: idx === 0 ? 'green' : 'purple'
          }))
        },

        // Ad footer
        adFooter: {
          visible: true,
          slots: ['homepage_footer_1', 'homepage_footer_2', 'homepage_footer_3']
        },

        // Meta information
        meta: {
          totalArticles: totalArticlesCount,
          totalCategories: allCategories.length,
          mainCategoriesCount: mainColumnsValid.length,
          styledSectionsCount: styledSectionsData.filter((s: any) => s && s.visible).length,
          lastUpdated: new Date().toISOString(),
          cacheAge: 180
        }
      };

      return res.json(style2Response);
    }

    // ========================================
    // STYLE1 RESPONSE (default)
    // ========================================
    // Build Style1 structured response
    const response = {
      version: '2.0-smart-style1',
      themeStyle,
      timestamp: new Date().toISOString(),
      
      // Section 1: Flash Ticker (Breaking News)
      flashTicker: {
        visible: tickerItems.length > 0,
        items: tickerItems
      },

      // Section 2: Hero Section (4 Column Grid)
      heroSection: {
        visible: heroLeadArticles.length > 0,
        columns: {
          // Column 1: Hero Lead (1 hero + 2 medium + 5 small = 8 articles)
          heroLead: {
            hero: heroLeadArticles[0] ? formatArticle(heroLeadArticles[0]) : null,
            medium: heroLeadArticles.slice(1, 3).map(formatArticle),
            small: heroLeadArticles.slice(3, 8).map(formatArticle)
          },
          // Column 2: Latest Articles (7 articles)
          latest: {
            label: 'తాజా వార్తలు',
            articles: latestColumnArticles.map(formatArticle)
          },
          // Column 3: Most Read (8 articles)
          mostRead: {
            label: 'ఎక్కువగా చదివినవి',
            articles: mostReadArticles.map(formatArticle)
          },
          // Column 4: Top Viewed (4 articles)
          topViewed: {
            label: 'టాప్ వీక్షణలు',
            articles: topViewedArticles.map((a: any) => ({
              id: a.id,
              title: a.title,
              slug: a.slug,
              imageUrl: a.coverImageUrl,
              viewCount: a.viewCount || 0,
              publishedAt: a.publishedAt
            }))
          }
        }
      },

      // Section 3: Horizontal Ad 1
      horizontalAd1: {
        visible: true,
        slot: 'homepage_below_hero'
      },

      // Section 4: Category Section 1 (First 4 categories × 5 articles)
      categorySection1: {
        visible: section1Valid.length > 0,
        label: 'వార్తా విభాగాలు',
        categories: section1Valid
      },

      // Section 5: Category Section 2 (Next 4 categories × 5 articles)
      categorySection2: {
        visible: section2Valid.length > 0,
        label: 'మరిన్ని విభాగాలు',
        categories: section2Valid
      },

      // Section 6: Horizontal Ad 2
      horizontalAd2: {
        visible: true,
        slot: 'homepage_below_categories'
      },

      // Section 7: Category Hub (Next 4 categories × 5 articles)
      categoryHub: {
        visible: hubValid.length > 0,
        label: 'ఇతర విభాగాలు',
        categories: hubValid
      },

      // Section 8: Web Stories placeholder
      webStories: {
        visible: false,
        stories: []
      },

      // Meta information
      meta: {
        totalArticles: totalArticlesCount,
        totalCategories: allCategories.length,
        categoriesInSections: section1Valid.length + section2Valid.length + hubValid.length,
        lastUpdated: new Date().toISOString(),
        cacheAge: 180 // 3 minutes recommended cache
      }
    };

    return res.json(response);
  } catch (error: any) {
    console.error('Error in /smart-homepage:', error);
    // Return detailed error in development/staging for debugging
    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(500).json({ 
      error: 'Failed to load smart homepage data',
      ...(isDev ? { details: error?.message, stack: error?.stack } : {}),
      // Always include error code/name for debugging
      code: error?.code || error?.name || 'UNKNOWN_ERROR'
    });
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

// =============================================================================
// DIGITAL DAILY NEWSPAPER APIs (ePaper for Mobile App)
// =============================================================================

/**
 * @swagger
 * /public/digital-papers:
 *   get:
 *     summary: 📰 Get all ePaper issues for swipe gallery (Digital Daily Newspaper)
 *     description: |
 *       🗞️ **DIGITAL DAILY NEWSPAPER - Issue List**
 *       
 *       Returns all published ePaper issues across all editions for a tenant.
 *       Perfect for mobile app "swipe through newspapers" UI.
 *       
 *       **Features:**
 *       - Default: Today's issues (all editions)
 *       - Cover images for gallery view
 *       - Grouped by edition/sub-edition
 *       - Filter by date range
 *       
 *       **Use Case:**
 *       - Display newspaper covers in swipeable gallery
 *       - User taps on cover → navigate to /public/digital-papers/:issueId
 *       
 *       **Cache:** ISR 300s (5 minutes)
 *     tags: [News Website API 2.0]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         schema: { type: string, example: "aksharamvoice.com" }
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date, example: "2026-02-01" }
 *         description: Filter by specific date (default is today)
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Start date for range filter
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: End date for range filter
 *       - in: query
 *         name: editionId
 *         schema: { type: string }
 *         description: Filter by specific edition ID
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30, maximum: 100 }
 *         description: Max number of issues to return
 *     responses:
 *       200:
 *         description: List of ePaper issues with cover images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 papers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       issueDate: { type: string, format: date }
 *                       coverImageUrl: { type: string }
 *                       coverImageUrlWebp: { type: string }
 *                       pdfUrl: { type: string }
 *                       pageCount: { type: integer }
 *                       edition: { type: object }
 *                       subEdition: { type: object, nullable: true }
 *                 editions:
 *                   type: array
 *                   description: List of available editions for filtering
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     filterDate: { type: string }
 *       500:
 *         description: Server error
 */
router.get('/digital-papers', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant) return res.status(500).json({ error: 'Tenant context missing' });

  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10) || 30, 1), 100);
    const editionIdFilter = req.query.editionId ? String(req.query.editionId) : null;

    // Date filtering
    let dateFilter: any = {};
    if (req.query.date) {
      // Specific date
      const targetDate = new Date(String(req.query.date));
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      dateFilter = { issueDate: { gte: targetDate, lt: nextDay } };
    } else if (req.query.from || req.query.to) {
      // Date range
      dateFilter = { issueDate: {} };
      if (req.query.from) {
        const fromDate = new Date(String(req.query.from));
        fromDate.setHours(0, 0, 0, 0);
        dateFilter.issueDate.gte = fromDate;
      }
      if (req.query.to) {
        const toDate = new Date(String(req.query.to));
        toDate.setHours(23, 59, 59, 999);
        dateFilter.issueDate.lte = toDate;
      }
    } else {
      // Default: today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFilter = { issueDate: { gte: today, lt: tomorrow } };
    }

    // Build where clause
    const whereClause: any = {
      tenantId: tenant.id,
      ...dateFilter
    };

    // Edition filter
    if (editionIdFilter) {
      whereClause.OR = [
        { editionId: editionIdFilter },
        { subEdition: { editionId: editionIdFilter } }
      ];
    }

    // Fetch issues with editions
    const [issues, editions] = await Promise.all([
      p.epaperPdfIssue.findMany({
        where: whereClause,
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        include: {
          edition: {
            select: {
              id: true,
              name: true,
              slug: true,
              coverImageUrl: true,
              state: { select: { id: true, name: true } }
            }
          },
          subEdition: {
            select: {
              id: true,
              name: true,
              slug: true,
              coverImageUrl: true,
              district: { select: { id: true, name: true } },
              edition: { select: { id: true, name: true, slug: true } }
            }
          }
        }
      }),
      // Get available editions for filter dropdown
      p.epaperPublicationEdition.findMany({
        where: { tenantId: tenant.id, isActive: true, isDeleted: false },
        select: {
          id: true,
          name: true,
          slug: true,
          coverImageUrl: true,
          subEditions: {
            where: { isActive: true, isDeleted: false },
            select: { id: true, name: true, slug: true }
          }
        },
        orderBy: { name: 'asc' }
      })
    ]);

    // Format response
    const papers = issues.map((issue: any) => ({
      id: issue.id,
      issueDate: issue.issueDate,
      coverImageUrl: issue.coverImageUrlWebp || issue.coverImageUrl || issue.edition?.coverImageUrl || issue.subEdition?.coverImageUrl || null,
      coverImageUrlWebp: issue.coverImageUrlWebp || null,
      coverImageUrlPng: issue.coverImageUrl || null,
      pdfUrl: issue.pdfUrl,
      pageCount: issue.pageCount,
      pdfOnlyMode: issue.pdfOnlyMode || false,
      edition: issue.edition ? {
        id: issue.edition.id,
        name: issue.edition.name,
        slug: issue.edition.slug,
        stateName: issue.edition.state?.name || null
      } : (issue.subEdition?.edition ? {
        id: issue.subEdition.edition.id,
        name: issue.subEdition.edition.name,
        slug: issue.subEdition.edition.slug
      } : null),
      subEdition: issue.subEdition ? {
        id: issue.subEdition.id,
        name: issue.subEdition.name,
        slug: issue.subEdition.slug,
        districtName: issue.subEdition.district?.name || null
      } : null
    }));

    return res.json({
      papers,
      editions: editions.map((ed: any) => ({
        id: ed.id,
        name: ed.name,
        slug: ed.slug,
        coverImageUrl: ed.coverImageUrl,
        subEditions: ed.subEditions
      })),
      meta: {
        total: papers.length,
        filterDate: req.query.date || 'today',
        tenantId: tenant.id,
        timestamp: new Date().toISOString(),
        cacheAge: 300
      }
    });
  } catch (error: any) {
    console.error('Error in /digital-papers:', error);
    return res.status(500).json({
      error: 'Failed to load digital papers',
      code: error?.code || error?.name || 'UNKNOWN_ERROR'
    });
  }
});

/**
 * @swagger
 * /public/digital-papers/{issueId}:
 *   get:
 *     summary: 📄 Get all pages of an ePaper issue (Digital Paper Detail)
 *     description: |
 *       🗞️ **DIGITAL DAILY NEWSPAPER - Issue Pages**
 *       
 *       Returns all pages of a specific ePaper issue.
 *       User taps on a newspaper cover → this API returns all pages.
 *       
 *       **Features:**
 *       - All page images (WebP optimized)
 *       - Page thumbnails for navigation
 *       - PDF download URL
 *       - Edition/Sub-edition metadata
 *       
 *       **Use Case:**
 *       - Display newspaper pages in full-screen reader
 *       - Swipe through pages
 *       - Pinch to zoom
 *       - Download PDF option
 *       
 *       **Cache:** ISR 600s (10 minutes)
 *     tags: [News Website API 2.0]
 *     parameters:
 *       - in: path
 *         name: issueId
 *         required: true
 *         schema: { type: string }
 *         description: ePaper Issue ID
 *       - in: header
 *         name: X-Tenant-Domain
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: ePaper issue with all pages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 issue:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     issueDate: { type: string, format: date }
 *                     pdfUrl: { type: string }
 *                     pageCount: { type: integer }
 *                     edition: { type: object }
 *                     subEdition: { type: object, nullable: true }
 *                 pages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       pageNumber: { type: integer }
 *                       imageUrl: { type: string }
 *                       imageUrlWebp: { type: string }
 *                       thumbnailUrl: { type: string }
 *       404:
 *         description: Issue not found
 *       500:
 *         description: Server error
 */
router.get('/digital-papers/:issueId', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Tenant context missing' });

  const issueId = req.params.issueId;
  if (!issueId) return res.status(400).json({ error: 'Issue ID required' });

  try {
    // Fetch issue with pages
    const issue = await p.epaperPdfIssue.findFirst({
      where: {
        id: issueId,
        tenantId: tenant.id
      },
      include: {
        edition: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImageUrl: true,
            seoTitle: true,
            seoDescription: true,
            state: { select: { id: true, name: true } }
          }
        },
        subEdition: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImageUrl: true,
            seoTitle: true,
            seoDescription: true,
            district: { select: { id: true, name: true } },
            edition: { select: { id: true, name: true, slug: true } }
          }
        },
        pages: {
          orderBy: { pageNumber: 'asc' },
          select: {
            id: true,
            pageNumber: true,
            imageUrl: true,
            imageUrlWebp: true
          }
        }
      }
    });

    if (!issue) {
      return res.status(404).json({ error: 'ePaper issue not found' });
    }

    // Format response
    const response = {
      issue: {
        id: issue.id,
        issueDate: issue.issueDate,
        pdfUrl: issue.pdfUrl,
        pageCount: issue.pageCount,
        pdfOnlyMode: issue.pdfOnlyMode || false,
        coverImageUrl: issue.coverImageUrlWebp || issue.coverImageUrl || null,
        edition: issue.edition ? {
          id: issue.edition.id,
          name: issue.edition.name,
          slug: issue.edition.slug,
          coverImageUrl: issue.edition.coverImageUrl,
          seoTitle: issue.edition.seoTitle,
          seoDescription: issue.edition.seoDescription,
          stateName: issue.edition.state?.name || null
        } : (issue.subEdition?.edition ? {
          id: issue.subEdition.edition.id,
          name: issue.subEdition.edition.name,
          slug: issue.subEdition.edition.slug
        } : null),
        subEdition: issue.subEdition ? {
          id: issue.subEdition.id,
          name: issue.subEdition.name,
          slug: issue.subEdition.slug,
          coverImageUrl: issue.subEdition.coverImageUrl,
          seoTitle: issue.subEdition.seoTitle,
          seoDescription: issue.subEdition.seoDescription,
          districtName: issue.subEdition.district?.name || null
        } : null
      },
      pages: issue.pages.map((page: any) => ({
        pageNumber: page.pageNumber,
        imageUrl: page.imageUrlWebp || page.imageUrl,
        imageUrlWebp: page.imageUrlWebp || null,
        imageUrlPng: page.imageUrl,
        // Generate thumbnail URL (if using CDN with transforms)
        thumbnailUrl: page.imageUrlWebp || page.imageUrl
      })),
      meta: {
        totalPages: issue.pages.length,
        timestamp: new Date().toISOString(),
        cacheAge: 600
      }
    };

    return res.json(response);
  } catch (error: any) {
    console.error('Error in /digital-papers/:issueId:', error);
    return res.status(500).json({
      error: 'Failed to load digital paper pages',
      code: error?.code || error?.name || 'UNKNOWN_ERROR'
    });
  }
});

/**
 * @swagger
 * /public/digital-papers/all-tenants:
 *   get:
 *     summary: 📚 Get ePaper issues from ALL tenants (App Gallery)
 *     description: |
 *       🗞️ **DIGITAL DAILY NEWSPAPER - Multi-Tenant Gallery**
 *       
 *       Returns ePaper issues from ALL tenants for app-wide newspaper gallery.
 *       Perfect for "All Papers" section in mobile app.
 *       
 *       **Features:**
 *       - Issues from all active tenants
 *       - Cover images for swipe gallery
 *       - Tenant branding (name, logo)
 *       - Filter by date
 *       
 *       **Use Case:**
 *       - App home screen showing all available newspapers
 *       - User can swipe through different newspaper brands
 *       
 *       **Cache:** ISR 300s (5 minutes)
 *     tags: [News Website API 2.0]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Filter by date (default is today)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200:
 *         description: List of ePaper issues from all tenants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 papers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       tenant: { type: object }
 *                       issueDate: { type: string }
 *                       coverImageUrl: { type: string }
 *                       pageCount: { type: integer }
 *                       edition: { type: object }
 */
router.get('/digital-papers/all-tenants', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);

    // Date filter
    let dateFilter: any = {};
    if (req.query.date) {
      const targetDate = new Date(String(req.query.date));
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      dateFilter = { issueDate: { gte: targetDate, lt: nextDay } };
    } else {
      // Default: today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFilter = { issueDate: { gte: today, lt: tomorrow } };
    }

    // Fetch issues from all tenants
    const issues = await p.epaperPdfIssue.findMany({
      where: dateFilter,
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            nativeName: true,
            tenantTheme: {
              select: { logoUrl: true, faviconUrl: true }
            }
          }
        },
        edition: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImageUrl: true,
            state: { select: { name: true } }
          }
        },
        subEdition: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImageUrl: true,
            district: { select: { name: true } },
            edition: { select: { id: true, name: true, slug: true } }
          }
        }
      }
    });

    // Format response
    const papers = issues.map((issue: any) => ({
      id: issue.id,
      tenant: {
        id: issue.tenant.id,
        name: issue.tenant.name,
        nativeName: issue.tenant.nativeName,
        logoUrl: issue.tenant.tenantTheme?.logoUrl || null
      },
      issueDate: issue.issueDate,
      coverImageUrl: issue.coverImageUrlWebp || issue.coverImageUrl || issue.edition?.coverImageUrl || issue.subEdition?.coverImageUrl || null,
      pdfUrl: issue.pdfUrl,
      pageCount: issue.pageCount,
      edition: issue.edition ? {
        id: issue.edition.id,
        name: issue.edition.name,
        slug: issue.edition.slug,
        stateName: issue.edition.state?.name || null
      } : (issue.subEdition?.edition ? {
        id: issue.subEdition.edition.id,
        name: issue.subEdition.edition.name,
        slug: issue.subEdition.edition.slug
      } : null),
      subEdition: issue.subEdition ? {
        id: issue.subEdition.id,
        name: issue.subEdition.name,
        districtName: issue.subEdition.district?.name || null
      } : null
    }));

    return res.json({
      papers,
      meta: {
        total: papers.length,
        filterDate: req.query.date || 'today',
        timestamp: new Date().toISOString(),
        cacheAge: 300
      }
    });
  } catch (error: any) {
    console.error('Error in /digital-papers/all-tenants:', error);
    return res.status(500).json({
      error: 'Failed to load all tenant papers',
      code: error?.code || error?.name || 'UNKNOWN_ERROR'
    });
  }
});

export default router;
