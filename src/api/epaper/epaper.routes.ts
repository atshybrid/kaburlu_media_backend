/**
 * ePaper Module Routes
 * Handles block templates, settings, editions, and layout generation
 */

import { Router } from 'express';
import passport from 'passport';
import multer from 'multer';
import { config } from '../../config/env';
import {
  listBlockTemplates,
  getBlockTemplate,
  createBlockTemplate,
  updateBlockTemplate,
  deleteBlockTemplate,
  cloneBlockTemplate,
  lockBlockTemplate,
} from './blockTemplate.controller';
import {
  getEpaperSettings,
  updateEpaperSettings,
  initializeEpaperSettings,
} from './settings.controller';
import { suggestBlockTemplate } from './suggestion.controller';
import {
  listPublicationEditions,
  getPublicationEdition,
  createPublicationEdition,
  updatePublicationEdition,
  deletePublicationEdition,
  listPublicationSubEditions,
  createPublicationSubEdition,
  getPublicationSubEdition,
  updatePublicationSubEdition,
  deletePublicationSubEdition,
} from './publicationEditions.controller';
import {
  uploadPdfIssue,
  uploadPdfIssueByUrl,
  getPdfIssue,
  findPdfIssue,
} from './pdfIssues.controller';
import {
  getEpaperPublicConfig,
  putEpaperPublicConfigType,
  putEpaperPublicConfigMultiEdition,
} from './publicConfig.controller';
import {
  getEpaperDomainSettingsForAdmin,
  putEpaperDomainSettingsForAdmin,
  patchEpaperDomainSettingsForAdmin,
  autoGenerateEpaperDomainSeoForAdmin,
} from './domainSettings.controller';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });
const epaperPdfMaxMb = Number((config as any)?.epaper?.pdfMaxMb || 30);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, Math.floor(epaperPdfMaxMb * 1024 * 1024)) },
});

// ============================================================================
// EPAPER DOMAIN SETTINGS (Branding/SEO/Theme per EPAPER domain)
// ============================================================================

/**
 * @swagger
 * /epaper/domain/settings:
 *   get:
 *     summary: Get EPAPER domain settings for current tenant
 *     description: |
 *       Admin endpoint.
 *       - Resolves tenant from JWT (reporter -> tenantId).
 *       - Finds the tenant's EPAPER domain and returns domainSettings + effective settings.
 *     tags: [ePaper Domain Settings - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: false
 *         schema: { type: string }
 *         description: Optional tenant override (SUPER_ADMIN; some admin flows)
 *       - in: query
 *         name: domainId
 *         required: false
 *         schema: { type: string }
 *         description: Optional explicit domainId (must be EPAPER + belong to tenant)
 *     responses:
 *       200:
 *         description: Domain settings
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenantId: "t_abc"
 *                   domain: { id: "dom_1", domain: "epaper.kaburlu.com", kind: "EPAPER", status: "ACTIVE", verifiedAt: "2026-01-01T00:00:00.000Z" }
 *                   settings:
 *                     branding: { logoUrl: "https://cdn.example.com/logo.png", faviconUrl: "https://cdn.example.com/favicon.ico" }
 *                     theme: { colors: { primary: "#0D47A1", secondary: "#FFB300" } }
 *                     seo: { defaultMetaTitle: "Kaburlu ePaper", defaultMetaDescription: "Latest ePaper PDFs", keywords: "kaburlu,epaper" }
 *                   effective:
 *                     branding: { logoUrl: "https://cdn.example.com/logo.png", faviconUrl: "https://cdn.example.com/favicon.ico" }
 *                     theme: { colors: { primary: "#0D47A1", secondary: "#FFB300" } }
 *                     seo: { canonicalBaseUrl: "https://epaper.kaburlu.com" }
 *                   updatedAt: "2026-01-12T20:07:20.515Z"
 */
router.get('/domain/settings', auth, getEpaperDomainSettingsForAdmin);

/**
 * @swagger
 * /epaper/domain/settings:
 *   put:
 *     summary: Replace EPAPER domain settings (branding/theme/seo/integrations)
 *     description: |
 *       Admin endpoint.
 *       - Replaces the stored JSON settings for the EPAPER domain.
 *       - By default triggers AI SEO autofill for missing SEO fields (autoSeo=true).
 *
 *       Security note:
 *       - You may store sensitive values under `secrets`, but they are NEVER returned by public APIs like `/public/epaper/settings`.
 *     tags: [ePaper Domain Settings - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: false
 *         schema: { type: string }
 *         description: Optional tenant override (SUPER_ADMIN; some admin flows)
 *       - in: query
 *         name: domainId
 *         required: false
 *         schema: { type: string }
 *         description: Optional explicit domainId (must be EPAPER + belong to tenant)
 *       - in: query
 *         name: autoSeo
 *         required: false
 *         schema: { type: boolean, default: true }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               epaper:
 *                 type: object
 *                 description: Optional. Updates tenant epaper public config in the same call.
 *                 properties:
 *                   type: { type: string, enum: [PDF, BLOCK], nullable: true }
 *                   multiEditionEnabled: { type: boolean, nullable: true }
 *               branding:
 *                 type: object
 *                 properties:
 *                   logoUrl: { type: string, nullable: true }
 *                   faviconUrl: { type: string, nullable: true }
 *                   siteName: { type: string, nullable: true }
 *               theme:
 *                 type: object
 *                 properties:
 *                   colors:
 *                     type: object
 *                     properties:
 *                       primary: { type: string, example: "#0D47A1", nullable: true }
 *                       secondary: { type: string, example: "#FFB300", nullable: true }
 *                       accent: { type: string, nullable: true }
 *                   typography:
 *                     type: object
 *                     properties:
 *                       fontFamily: { type: string, nullable: true }
 *               seo:
 *                 type: object
 *                 description: |
 *                   Optional; you can pass null/empty and backend will AI-fill missing parts when autoSeo=true.
 *                 properties:
 *                   canonicalBaseUrl: { type: string, nullable: true }
 *                   defaultMetaTitle: { type: string, nullable: true }
 *                   defaultMetaDescription: { type: string, nullable: true }
 *                   keywords: { type: string, nullable: true, example: "kaburlu,epaper,news,telangana" }
 *                   ogImageUrl: { type: string, nullable: true, example: "https://cdn.example.com/og-image.png" }
 *                   ogTitle: { type: string, nullable: true, example: "Kaburlu ePaper" }
 *                   ogDescription: { type: string, nullable: true, example: "Latest newspaper editions online" }
 *                   homepageH1: { type: string, nullable: true, example: "Kaburlu ePaper - Latest Editions" }
 *                   tagline: { type: string, nullable: true, example: "Your trusted source for local news" }
 *                   robotsTxt:
 *                     type: string
 *                     nullable: true
 *                     example: "User-agent: *\\nAllow: /\\nDisallow: /api\\nSitemap: https://epaper.example.com/sitemap.xml"
 *                     description: |
 *                       Full override for `/robots.txt` content (EPAPER domain).
 *                       If omitted/null, backend serves a safe default robots.txt.
 *                   robots: { type: string, nullable: true, example: "index,follow" }
 *                   sitemapEnabled: { type: boolean, nullable: true, example: true }
 *                   organization:
 *                     type: object
 *                     nullable: true
 *                     example: { name: "Kaburlu Media", logo: "https://cdn.example.com/logo.png" }
 *                   socialLinks:
 *                     type: array
 *                     items: { type: string }
 *                     nullable: true
 *                     example: ["https://facebook.com/kaburlu", "https://twitter.com/kaburlu"]
 *               layout: { type: object }
 *               integrations:
 *                 type: object
 *                 description: |
 *                   Public IDs/tokens only (do not put secrets here). Recommended keys:
 *                   - analytics.googleAnalyticsMeasurementId
 *                   - analytics.googleTagManagerId
 *                   - searchConsole.googleSiteVerification
 *                   - ads.adsenseClientId
 *                   - ads.googleAdsConversionId
 *                   - ads.googleAdsConversionLabel
 *                   - ads.adManagerNetworkCode
 *                   - push.webPushVapidPublicKey
 *               secrets:
 *                 type: object
 *                 description: |
 *                   Sensitive keys (never returned by public APIs). Recommended keys:
 *                   - push.webPushVapidPrivateKey
 *                   - push.fcmServerKey (if you use legacy FCM)
 *                   - google.serviceAccountJson (if you integrate server-side Google APIs)
 *           examples:
 *             completePayload:
 *               summary: "⭐ COMPLETE PAYLOAD - All Fields (Branding, SEO, Theme, Integrations, Secrets)"
 *               value:
 *                 epaper:
 *                   type: "PDF"
 *                   multiEditionEnabled: true
 *                 branding:
 *                   logoUrl: "https://cdn.example.com/logo.png"
 *                   faviconUrl: "https://cdn.example.com/favicon.ico"
 *                   siteName: "Kaburlu ePaper"
 *                 theme:
 *                   colors:
 *                     primary: "#0D47A1"
 *                     secondary: "#FFB300"
 *                     accent: "#4CAF50"
 *                   typography:
 *                     fontFamily: "Roboto, sans-serif"
 *                 seo:
 *                   canonicalBaseUrl: "https://epaper.kaburlu.com"
 *                   defaultMetaTitle: "Kaburlu ePaper - Latest News Editions"
 *                   defaultMetaDescription: "Read the latest Kaburlu newspaper editions in digital format."
 *                   keywords: "kaburlu,epaper,news,telangana,adilabad"
 *                   ogImageUrl: "https://cdn.example.com/og-image.png"
 *                   ogTitle: "Kaburlu ePaper"
 *                   ogDescription: "Latest newspaper editions online"
 *                   homepageH1: "Kaburlu ePaper - Read Latest Editions"
 *                   tagline: "Your trusted source for local news"
 *                   robots: "index,follow"
 *                   sitemapEnabled: true
 *                   organization:
 *                     name: "Kaburlu Media"
 *                     logo: "https://cdn.example.com/logo.png"
 *                   socialLinks:
 *                     - "https://facebook.com/kaburlu"
 *                     - "https://twitter.com/kaburlu"
 *                     - "https://instagram.com/kaburlu"
 *                     - "https://youtube.com/@kaburlu"
 *                 layout:
 *                   header: "centered"
 *                   footer: "full-width"
 *                   showTicker: true
 *                   showTopBar: true
 *                 integrations:
 *                   analytics:
 *                     googleAnalyticsMeasurementId: "G-XXXXXXXXXX"
 *                     googleTagManagerId: "GTM-XXXXXXX"
 *                   searchConsole:
 *                     googleSiteVerification: "google-site-verification-code-here"
 *                     bingSiteVerification: "bing-verification-code-here"
 *                   ads:
 *                     adsenseClientId: "ca-pub-1234567890123456"
 *                     googleAdsConversionId: "AW-123456789"
 *                     googleAdsConversionLabel: "AbC-DEfGHiJkLmN"
 *                     adManagerNetworkCode: "12345678"
 *                     adManagerAppId: "app-id-123"
 *                   push:
 *                     webPushVapidPublicKey: "BFG1x2y3z4a5b6c7d8e9f0..."
 *                     fcmSenderId: "123456789012"
 *                 secrets:
 *                   push:
 *                     webPushVapidPrivateKey: "your-vapid-private-key-here"
 *                     fcmServerKey: "AAAA1234567890:APA91b..."
 *                   google:
 *                     serviceAccountJson: "{\"type\":\"service_account\",\"project_id\":\"your-project-id\",\"private_key_id\":\"key123\",\"private_key\":\"-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n\",\"client_email\":\"service@project.iam.gserviceaccount.com\"}"
 *             minimal:
 *               summary: Minimal setup (AI will auto-fill SEO)
 *               value:
 *                 epaper: { type: "PDF", multiEditionEnabled: true }
 *                 branding: { logoUrl: "https://cdn.example.com/logo.png", faviconUrl: "https://cdn.example.com/favicon.ico" }
 *                 theme: { colors: { primary: "#0D47A1", secondary: "#FFB300" } }
 *                 seo: { defaultMetaTitle: null, defaultMetaDescription: null, keywords: null, ogImageUrl: "https://cdn.example.com/og.png" }
 *             completeSeo:
 *               summary: Complete SEO configuration with all fields
 *               value:
 *                 branding:
 *                   logoUrl: "https://cdn.example.com/logo.png"
 *                   faviconUrl: "https://cdn.example.com/favicon.ico"
 *                   siteName: "Kaburlu ePaper"
 *                 seo:
 *                   canonicalBaseUrl: "https://epaper.kaburlu.com"
 *                   defaultMetaTitle: "Kaburlu ePaper - Latest News Editions"
 *                   defaultMetaDescription: "Read the latest Kaburlu newspaper editions in digital format."
 *                   keywords: "kaburlu,epaper,news,telangana,adilabad"
 *                   ogImageUrl: "https://cdn.example.com/og-image.png"
 *                   ogTitle: "Kaburlu ePaper"
 *                   ogDescription: "Latest newspaper editions online"
 *                   homepageH1: "Kaburlu ePaper - Read Latest Editions"
 *                   tagline: "Your trusted source for local news"
 *                   robots: "index,follow"
 *                   sitemapEnabled: true
 *                   organization: { name: "Kaburlu Media", logo: "https://cdn.example.com/logo.png" }
 *                   socialLinks: ["https://facebook.com/kaburlu", "https://twitter.com/kaburlu"]
 *             withRobotsTxt:
 *               summary: Custom robots.txt override
 *               value:
 *                 seo:
 *                   robotsTxt: "User-agent: *\nAllow: /\nDisallow: /api\nSitemap: https://epaper.example.com/sitemap.xml\n"
 *                   sitemapEnabled: true
 *             withIntegrations:
 *               summary: Complete integrations setup (Google Analytics, Search Console, AdSense, etc.)
 *               value:
 *                 integrations:
 *                   analytics:
 *                     googleAnalyticsMeasurementId: "G-XXXXXXXXXX"
 *                     googleTagManagerId: "GTM-XXXXXXX"
 *                   searchConsole:
 *                     googleSiteVerification: "your-google-site-verification-code"
 *                   ads:
 *                     adsenseClientId: "ca-pub-1234567890123456"
 *                     googleAdsConversionId: "AW-123456789"
 *                     googleAdsConversionLabel: "AbC-DEfGHiJkLmN"
 *                     adManagerNetworkCode: "12345678"
 *                   push:
 *                     webPushVapidPublicKey: "BFG...your-vapid-public-key"
 *                 secrets:
 *                   push:
 *                     webPushVapidPrivateKey: "your-vapid-private-key"
 *                     fcmServerKey: "your-fcm-server-key"
 *                   google:
 *                     serviceAccountJson: "{\"type\":\"service_account\",\"project_id\":\"your-project\"}"
 *             withAllFields:
 *               summary: Complete configuration with all fields (branding, SEO, integrations, secrets)
 *               value:
 *                 epaper:
 *                   type: "PDF"
 *                   multiEditionEnabled: true
 *                 branding:
 *                   logoUrl: "https://cdn.example.com/logo.png"
 *                   faviconUrl: "https://cdn.example.com/favicon.ico"
 *                   siteName: "Kaburlu ePaper"
 *                 theme:
 *                   colors:
 *                     primary: "#0D47A1"
 *                     secondary: "#FFB300"
 *                     accent: "#4CAF50"
 *                   typography:
 *                     fontFamily: "Roboto, sans-serif"
 *                 seo:
 *                   canonicalBaseUrl: "https://epaper.kaburlu.com"
 *                   defaultMetaTitle: "Kaburlu ePaper - Latest News"
 *                   defaultMetaDescription: "Read the latest Kaburlu newspaper editions"
 *                   keywords: "kaburlu,epaper,news,telangana"
 *                   ogImageUrl: "https://cdn.example.com/og-image.png"
 *                   ogTitle: "Kaburlu ePaper"
 *                   ogDescription: "Latest newspaper editions online"
 *                   homepageH1: "Kaburlu ePaper - Latest Editions"
 *                   tagline: "Your trusted news source"
 *                   robots: "index,follow"
 *                   sitemapEnabled: true
 *                 integrations:
 *                   analytics:
 *                     googleAnalyticsMeasurementId: "G-XXXXXXXXXX"
 *                     googleTagManagerId: "GTM-XXXXXXX"
 *                   searchConsole:
 *                     googleSiteVerification: "google-verification-code"
 *                   ads:
 *                     adsenseClientId: "ca-pub-1234567890123456"
 *                     googleAdsConversionId: "AW-123456789"
 *                     googleAdsConversionLabel: "conversion-label"
 *                     adManagerNetworkCode: "12345678"
 *                   push:
 *                     webPushVapidPublicKey: "BFG...vapid-public-key"
 *                 secrets:
 *                   push:
 *                     webPushVapidPrivateKey: "vapid-private-key"
 *                     fcmServerKey: "fcm-server-key"
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.put('/domain/settings', auth, putEpaperDomainSettingsForAdmin);

/**
 * @swagger
 * /epaper/domain/settings:
 *   patch:
 *     summary: Patch EPAPER domain settings (deep-merge)
 *     description: |
 *       Admin endpoint.
 *       - Deep-merges the payload into existing domain settings.
 *       - By default triggers AI SEO autofill for missing SEO fields (autoSeo=true).
 *
 *       Security note:
 *       - You may store sensitive values under `secrets`, but they are NEVER returned by public APIs like `/public/epaper/settings`.
 *     tags: [ePaper Domain Settings - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: false
 *         schema: { type: string }
 *         description: Optional tenant override (SUPER_ADMIN; some admin flows)
 *       - in: query
 *         name: domainId
 *         required: false
 *         schema: { type: string }
 *         description: Optional explicit domainId (must be EPAPER + belong to tenant)
 *       - in: query
 *         name: autoSeo
 *         required: false
 *         schema: { type: boolean, default: true }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               epaper:
 *                 type: object
 *                 description: Optional. Updates tenant epaper public config in the same call.
 *                 properties:
 *                   type: { type: string, enum: [PDF, BLOCK], nullable: true }
 *                   multiEditionEnabled: { type: boolean, nullable: true }
 *               branding: { type: object }
 *               theme: { type: object }
 *               seo:
 *                 type: object
 *                 description: All SEO fields are optional for PATCH (deep merge)
 *                 properties:
 *                   canonicalBaseUrl: { type: string, nullable: true }
 *                   defaultMetaTitle: { type: string, nullable: true }
 *                   defaultMetaDescription: { type: string, nullable: true }
 *                   keywords: { type: string, nullable: true }
 *                   ogImageUrl: { type: string, nullable: true }
 *                   ogTitle: { type: string, nullable: true }
 *                   ogDescription: { type: string, nullable: true }
 *                   homepageH1: { type: string, nullable: true }
 *                   tagline: { type: string, nullable: true }
 *                   robotsTxt:
 *                     type: string
 *                     nullable: true
 *                     description: Full override for `/robots.txt` content (EPAPER domain)
 *                   robots: { type: string, nullable: true }
 *                   sitemapEnabled: { type: boolean, nullable: true }
 *                   organization: { type: object, nullable: true }
 *                   socialLinks: { type: array, items: { type: string }, nullable: true }
 *               layout: { type: object }
 *               integrations: { type: object }
 *               secrets: { type: object }
 *           examples:
 *             completePayload:
 *               summary: "⭐ COMPLETE PAYLOAD - All Fields (Branding, SEO, Theme, Integrations, Secrets)"
 *               value:
 *                 epaper:
 *                   type: "PDF"
 *                   multiEditionEnabled: true
 *                 branding:
 *                   logoUrl: "https://cdn.example.com/logo.png"
 *                   faviconUrl: "https://cdn.example.com/favicon.ico"
 *                   siteName: "Kaburlu ePaper"
 *                 theme:
 *                   colors:
 *                     primary: "#0D47A1"
 *                     secondary: "#FFB300"
 *                     accent: "#4CAF50"
 *                   typography:
 *                     fontFamily: "Roboto, sans-serif"
 *                 seo:
 *                   canonicalBaseUrl: "https://epaper.kaburlu.com"
 *                   defaultMetaTitle: "Kaburlu ePaper - Latest News Editions"
 *                   defaultMetaDescription: "Read the latest Kaburlu newspaper editions in digital format."
 *                   keywords: "kaburlu,epaper,news,telangana,adilabad"
 *                   ogImageUrl: "https://cdn.example.com/og-image.png"
 *                   ogTitle: "Kaburlu ePaper"
 *                   ogDescription: "Latest newspaper editions online"
 *                   homepageH1: "Kaburlu ePaper - Read Latest Editions"
 *                   tagline: "Your trusted source for local news"
 *                   robots: "index,follow"
 *                   sitemapEnabled: true
 *                   organization:
 *                     name: "Kaburlu Media"
 *                     logo: "https://cdn.example.com/logo.png"
 *                   socialLinks:
 *                     - "https://facebook.com/kaburlu"
 *                     - "https://twitter.com/kaburlu"
 *                     - "https://instagram.com/kaburlu"
 *                     - "https://youtube.com/@kaburlu"
 *                 layout:
 *                   header: "centered"
 *                   footer: "full-width"
 *                   showTicker: true
 *                   showTopBar: true
 *                 integrations:
 *                   analytics:
 *                     googleAnalyticsMeasurementId: "G-XXXXXXXXXX"
 *                     googleTagManagerId: "GTM-XXXXXXX"
 *                   searchConsole:
 *                     googleSiteVerification: "google-site-verification-code-here"
 *                     bingSiteVerification: "bing-verification-code-here"
 *                   ads:
 *                     adsenseClientId: "ca-pub-1234567890123456"
 *                     googleAdsConversionId: "AW-123456789"
 *                     googleAdsConversionLabel: "AbC-DEfGHiJkLmN"
 *                     adManagerNetworkCode: "12345678"
 *                     adManagerAppId: "app-id-123"
 *                   push:
 *                     webPushVapidPublicKey: "BFG1x2y3z4a5b6c7d8e9f0..."
 *                     fcmSenderId: "123456789012"
 *                 secrets:
 *                   push:
 *                     webPushVapidPrivateKey: "your-vapid-private-key-here"
 *                     fcmServerKey: "AAAA1234567890:APA91b..."
 *                   google:
 *                     serviceAccountJson: "{\"type\":\"service_account\",\"project_id\":\"your-project-id\",\"private_key_id\":\"key123\",\"private_key\":\"-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n\",\"client_email\":\"service@project.iam.gserviceaccount.com\"}"
 *             patchLogoOnly:
 *               summary: Update only logo
 *               value:
 *                 branding: { logoUrl: "https://cdn.example.com/new-logo.png" }
 *             patchSeoTitle:
 *               summary: Update SEO title and description only
 *               value:
 *                 seo:
 *                   defaultMetaTitle: "New Kaburlu ePaper Title"
 *                   defaultMetaDescription: "Updated meta description for better SEO"
 *             patchColors:
 *               summary: Update theme colors only
 *               value:
 *                 theme:
 *                   colors:
 *                     primary: "#1976D2"
 *                     secondary: "#FFC107"
 *             patchIntegrations:
 *               summary: Add Google Analytics and AdSense
 *               value:
 *                 integrations:
 *                   analytics:
 *                     googleAnalyticsMeasurementId: "G-XXXXXXXXXX"
 *                   ads:
 *                     adsenseClientId: "ca-pub-1234567890"
 *             patchOrganizationAndSocial:
 *               summary: Update SEO organization and social links
 *               value:
 *                 seo:
 *                   organization:
 *                     name: "Kaburlu Media"
 *                     logo: "https://cdn.example.com/logo.png"
 *                   socialLinks:
 *                     - "https://facebook.com/kaburlu"
 *                     - "https://twitter.com/kaburlu"
 *                     - "https://instagram.com/kaburlu"
 *                     - "https://youtube.com/@kaburlu"
 *             patchCompleteSeo:
 *               summary: Update complete SEO configuration with all fields
 *               value:
 *                 branding:
 *                   logoUrl: "https://cdn.example.com/logo.png"
 *                   faviconUrl: "https://cdn.example.com/favicon.ico"
 *                   siteName: "Kaburlu ePaper"
 *                 seo:
 *                   canonicalBaseUrl: "https://epaper.kaburlu.com"
 *                   defaultMetaTitle: "Kaburlu ePaper - Latest News Editions"
 *                   defaultMetaDescription: "Read the latest Kaburlu newspaper editions in digital format."
 *                   keywords: "kaburlu,epaper,news,telangana,adilabad"
 *                   ogImageUrl: "https://cdn.example.com/og-image.png"
 *                   ogTitle: "Kaburlu ePaper"
 *                   ogDescription: "Latest newspaper editions online"
 *                   homepageH1: "Kaburlu ePaper - Read Latest Editions"
 *                   tagline: "Your trusted source for local news"
 *                   robots: "index,follow"
 *                   sitemapEnabled: true
 *                   organization:
 *                     name: "Kaburlu Media"
 *                     logo: "https://cdn.example.com/logo.png"
 *                   socialLinks:
 *                     - "https://facebook.com/kaburlu"
 *                     - "https://twitter.com/kaburlu"
 *             patchMultipleFields:
 *               summary: Update multiple nested fields at once
 *               value:
 *                 branding:
 *                   siteName: "Kaburlu ePaper Updated"
 *                 seo:
 *                   defaultMetaTitle: "Kaburlu ePaper - Latest Editions"
 *                   keywords: "kaburlu,epaper,news,telangana,adilabad,updated"
 *                   homepageH1: "Welcome to Kaburlu ePaper"
 *                   robots: "index,follow"
 *                   sitemapEnabled: true
 *                 theme:
 *                   colors:
 *                     primary: "#0D47A1"
 *             patchIntegrationsComplete:
 *               summary: Update all integration keys (Google Analytics, Search Console, AdSense, Ads, Push)
 *               value:
 *                 integrations:
 *                   analytics:
 *                     googleAnalyticsMeasurementId: "G-XXXXXXXXXX"
 *                     googleTagManagerId: "GTM-XXXXXXX"
 *                   searchConsole:
 *                     googleSiteVerification: "your-google-site-verification-code"
 *                   ads:
 *                     adsenseClientId: "ca-pub-1234567890123456"
 *                     googleAdsConversionId: "AW-123456789"
 *                     googleAdsConversionLabel: "AbC-DEfGHiJkLmN"
 *                     adManagerNetworkCode: "12345678"
 *                   push:
 *                     webPushVapidPublicKey: "BFG...your-vapid-public-key"
 *             patchSecretsOnly:
 *               summary: Update secrets (private keys, server keys)
 *               value:
 *                 secrets:
 *                   push:
 *                     webPushVapidPrivateKey: "your-vapid-private-key"
 *                     fcmServerKey: "your-fcm-server-key"
 *                   google:
 *                     serviceAccountJson: "{\"type\":\"service_account\",\"project_id\":\"your-project\",\"private_key\":\"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n\"}"
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.patch('/domain/settings', auth, patchEpaperDomainSettingsForAdmin);

/**
 * @swagger
 * /epaper/domain/settings/seo/auto:
 *   post:
 *     summary: Auto-generate missing SEO fields for EPAPER domain
 *     description: |
 *       Admin endpoint.
 *       - Runs AI to fill missing SEO fields (title, description, keywords, H1, tagline) for the EPAPER domain.
 *       - Does NOT overwrite admin-provided SEO text; it only fills missing values.
 *
 *       Tip: use this for a "Generate SEO" button in admin UI.
 *     tags: [ePaper Domain Settings - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: false
 *         schema: { type: string }
 *         description: Optional tenant override (SUPER_ADMIN; some admin flows)
 *       - in: query
 *         name: domainId
 *         required: false
 *         schema: { type: string }
 *         description: Optional explicit domainId (must be EPAPER + belong to tenant)
 *     responses:
 *       200:
 *         description: Updated domain settings
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenantId: "t_abc"
 *                   domainId: "dom_1"
 *                   updatedAt: "2026-01-12T20:07:20.515Z"
 *                   settings:
 *                     seo:
 *                       canonicalBaseUrl: "https://epaper.kaburlu.com"
 *                       defaultMetaTitle: "Kaburlu ePaper – Latest PDF Issues"
 *                       defaultMetaDescription: "Read the latest Kaburlu ePaper PDF issues by edition and date."
 *                       keywords: "kaburlu,epaper,adilabad"
 *                       homepageH1: "Kaburlu ePaper"
 *                       tagline: "Latest PDF ePaper issues"
 *                       generatedBy: "ai"
 *                       generatedAt: "2026-01-12T20:07:20.515Z"
 */
router.post('/domain/settings/seo/auto', auth, autoGenerateEpaperDomainSeoForAdmin);

// ============================================================================
// BLOCK TEMPLATES
// ============================================================================

/**
 * @swagger
 * /epaper/templates:
 *   get:
 *     summary: List block templates
 *     description: Returns all available block templates. Global templates + tenant-specific templates.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [HEADER, CONTENT, FOOTER] }
 *         description: Filter by category
 *       - in: query
 *         name: subCategory
 *         schema: { type: string, enum: [MAIN_HEADER, INNER_HEADER, COL_2, COL_4, COL_6, COL_10, COL_12, STANDARD_FOOTER, LAST_PAGE_FOOTER] }
 *         description: Filter by sub-category
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, ACTIVE, ARCHIVED] }
 *         description: Filter by status
 *       - in: query
 *         name: columns
 *         schema: { type: integer }
 *         description: Filter by column count
 *       - in: query
 *         name: includeGlobal
 *         schema: { type: boolean, default: true }
 *         description: Include global platform templates
 *     responses:
 *       200:
 *         description: List of block templates
 */
router.get('/templates', auth, listBlockTemplates);

/**
 * @swagger
 * /epaper/templates/{id}:
 *   get:
 *     summary: Get a block template by ID
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Block template details
 *       404:
 *         description: Template not found
 */
router.get('/templates/:id', auth, getBlockTemplate);

/**
 * @swagger
 * /epaper/templates:
 *   post:
 *     summary: Create a new block template
 *     description: Creates a new block template in DRAFT status. Only tenant admins can create tenant-specific templates.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, category, subCategory, columns, widthInches, maxHeightInches, components]
 *             properties:
 *               code: { type: string, example: "BT_CUSTOM_2COL" }
 *               name: { type: string, example: "Custom 2-Column Block" }
 *               description: { type: string }
 *               category: { type: string, enum: [HEADER, CONTENT, FOOTER] }
 *               subCategory: { type: string, enum: [MAIN_HEADER, INNER_HEADER, COL_2, COL_4, COL_6, COL_10, COL_12, STANDARD_FOOTER, LAST_PAGE_FOOTER] }
 *               columns: { type: integer, example: 2 }
 *               widthInches: { type: number, example: 2 }
 *               minHeightInches: { type: number, example: 2 }
 *               maxHeightInches: { type: number, example: 4 }
 *               components: { type: object }
 *     responses:
 *       201:
 *         description: Created template
 *       400:
 *         description: Validation error
 */
router.post('/templates', auth, createBlockTemplate);

/**
 * @swagger
 * /epaper/templates/{id}:
 *   put:
 *     summary: Update a block template
 *     description: Update template properties. Cannot update locked templates.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               minHeightInches: { type: number }
 *               maxHeightInches: { type: number }
 *               components: { type: object }
 *               status: { type: string, enum: [DRAFT, ACTIVE, ARCHIVED] }
 *     responses:
 *       200:
 *         description: Updated template
 *       400:
 *         description: Template is locked
 *       404:
 *         description: Template not found
 */
router.put('/templates/:id', auth, updateBlockTemplate);

/**
 * @swagger
 * /epaper/templates/{id}:
 *   delete:
 *     summary: Archive a block template
 *     description: Soft delete (archive) a template. Cannot delete global templates.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template archived
 *       400:
 *         description: Cannot delete global template
 *       404:
 *         description: Template not found
 */
router.delete('/templates/:id', auth, deleteBlockTemplate);

/**
 * @swagger
 * /epaper/templates/{id}/clone:
 *   post:
 *     summary: Clone a block template
 *     description: Create a copy of a template for customization. Global templates can be cloned to tenant-specific.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newCode: { type: string, example: "BT_MY_CUSTOM_2COL" }
 *               newName: { type: string, example: "My Custom 2-Column" }
 *     responses:
 *       201:
 *         description: Cloned template
 *       404:
 *         description: Source template not found
 */
router.post('/templates/:id/clone', auth, cloneBlockTemplate);

/**
 * @swagger
 * /epaper/templates/{id}/lock:
 *   post:
 *     summary: Lock a block template
 *     description: Lock template to prevent further edits. Generates preview image. Required before using in articles.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template locked
 *       400:
 *         description: Template already locked or invalid
 *       404:
 *         description: Template not found
 */
router.post('/templates/:id/lock', auth, lockBlockTemplate);

// ============================================================================
// EPAPER SETTINGS
// ============================================================================

/**
 * @swagger
 * /epaper/settings:
 *   get:
 *     summary: Get ePaper settings for current tenant
 *     description: Returns page dimensions, headers, footers, printer info, and generation config.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: ePaper settings
 *       404:
 *         description: Settings not initialized
 */
router.get('/settings', auth, getEpaperSettings);

/**
 * @swagger
 * /epaper/settings:
 *   put:
 *     summary: Update ePaper settings
 *     description: Update page dimensions, headers, footers, printer info, etc.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pageWidthInches: { type: number, example: 13 }
 *               pageHeightInches: { type: number, example: 22 }
 *               gridColumns: { type: integer, example: 12 }
 *               paddingTop: { type: number, example: 0.5 }
 *               paddingRight: { type: number, example: 0.5 }
 *               paddingBottom: { type: number, example: 0.5 }
 *               paddingLeft: { type: number, example: 0.5 }
 *               defaultPageCount: { type: integer, example: 8 }
 *               mainHeaderTemplateId: { type: string }
 *               innerHeaderTemplateId: { type: string }
 *               footerTemplateId: { type: string }
 *               footerStyle: { type: string, enum: [dots, line, none] }
 *               showPrinterInfoOnLastPage: { type: boolean }
 *               printerName: { type: string, example: "Sri Lakshmi Offset Printers" }
 *               printerAddress: { type: string, example: "Industrial Area, Adilabad" }
 *               printerCity: { type: string }
 *               publisherName: { type: string }
 *               editorName: { type: string }
 *               ownerName: { type: string }
 *               rniNumber: { type: string }
 *               lastPageFooterTemplate: { type: string }
 *               generationConfig: { type: object }
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.put('/settings', auth, updateEpaperSettings);

/**
 * @swagger
 * /epaper/settings/initialize:
 *   post:
 *     summary: Initialize ePaper settings for tenant
 *     description: Creates default ePaper settings for a tenant. Called automatically on first access.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: Settings initialized
 *       200:
 *         description: Settings already exist
 */
router.post('/settings/initialize', auth, initializeEpaperSettings);

// ============================================================================
// EPAPER PUBLIC CONFIG (mode + multi-edition)
// Stored in EpaperSettings.generationConfig.publicEpaper
// ============================================================================

/**
 * @swagger
 * /epaper/public-config:
 *   get:
 *     summary: Get public ePaper configuration (type + multi-edition)
 *     description: Admin-only. Reads from EpaperSettings.generationConfig.publicEpaper.
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Config
 */
router.get('/public-config', auth, getEpaperPublicConfig);

/**
 * @swagger
 * /epaper/public-config/type:
 *   put:
 *     summary: Update public ePaper type (PDF or BLOCK)
 *     description: Admin-only. Updates EpaperSettings.generationConfig.publicEpaper.type.
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type: { type: string, enum: [PDF, BLOCK], example: PDF }
 *     responses:
 *       200:
 *         description: Updated config
 */
router.put('/public-config/type', auth, putEpaperPublicConfigType);

/**
 * @swagger
 * /epaper/public-config/multi-edition:
 *   put:
 *     summary: Update multi-edition flag (on/off)
 *     description: Admin-only. Updates EpaperSettings.generationConfig.publicEpaper.multiEditionEnabled.
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [multiEditionEnabled]
 *             properties:
 *               multiEditionEnabled: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Updated config
 */
router.put('/public-config/multi-edition', auth, putEpaperPublicConfigMultiEdition);

// ============================================================================
// PUBLICATION EDITIONS + SUB-EDITIONS (Tenant ePaper catalog)
// ============================================================================

/**
 * @swagger
 * /epaper/publication-editions:
 *   get:
 *     summary: List ePaper publication editions (state-level)
 *     description: |
 *       Admin-only. Returns tenant-scoped edition catalog (not daily generated editions).
 *
 *       SUPER_ADMIN usage:
 *       - Pass `tenantId` as a query param to manage any tenant.
 *       - Avoid leading/trailing spaces in tenantId (e.g. `tenantId=%20abc` will fail).
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: includeSubEditions
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: includeDeleted
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (manage any tenant)
 *         example: cmk7e7tg401ezlp22wkz5rxky
 *     responses:
 *       200:
 *         description: List of editions
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   items:
 *                     - id: "ed_1"
 *                       tenantId: "cmk7e7tg401ezlp22wkz5rxky"
 *                       name: "Main Edition"
 *                       slug: "main-edition"
 *                       stateId: null
 *                       isActive: true
 */
router.get('/publication-editions', auth, listPublicationEditions);

/**
 * @swagger
 * /epaper/publication-editions:
 *   post:
 *     summary: Create ePaper publication edition
 *     description: |
 *       Admin-only. Creates a tenant-scoped edition (state-level).
 *
 *       SUPER_ADMIN usage:
 *       - Pass `tenantId` as query param to create for any tenant.
 *       - Avoid leading/trailing spaces in tenantId (no `%20`).
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (create for any tenant)
 *         example: cmk7e7tg401ezlp22wkz5rxky
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Telangana Edition" }
 *               slug: { type: string, example: "telangana" }
 *               stateId: { type: string, nullable: true, description: "Optional. Link edition to an existing State." }
 *               coverImageUrl: { type: string }
 *               isActive: { type: boolean, default: true }
 *               seoTitle: { type: string }
 *               seoDescription: { type: string }
 *               seoKeywords: { type: string }
 *     responses:
 *       201:
 *         description: Created edition
 *         content:
 *           application/json:
 *             examples:
 *               minimal:
 *                 summary: Minimal payload (recommended)
 *                 value:
 *                   id: "ed_1"
 *                   tenantId: "cmk7e7tg401ezlp22wkz5rxky"
 *                   name: "Main Edition"
 *                   slug: "main-edition"
 *                   stateId: null
 *                   coverImageUrl: null
 *                   isActive: true
 *               withSeo:
 *                 summary: With SEO fields
 *                 value:
 *                   id: "ed_2"
 *                   tenantId: "cmk7e7tg401ezlp22wkz5rxky"
 *                   name: "Telangana"
 *                   slug: "telangana"
 *                   stateId: "cmk74ho02002rugy45x85vvi7"
 *                   seoTitle: "Telangana Edition"
 *                   seoDescription: "Latest Telangana news"
 *       409:
 *         description: Edition slug already exists for this tenant
 */
router.post('/publication-editions', auth, createPublicationEdition);

/**
 * @swagger
 * /epaper/publication-editions/{id}:
 *   get:
 *     summary: Get a publication edition by ID
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Edition details
 *       404:
 *         description: Not found
 */
router.get('/publication-editions/:id', auth, getPublicationEdition);

/**
 * @swagger
 * /epaper/publication-editions/{id}:
 *   put:
 *     summary: Update a publication edition
 *     description: |
 *       Admin-only.
 *       - `stateId` is optional; to clear it send `stateId: null`.
 *       - SUPER_ADMIN can pass `tenantId` as query param; avoid `%20`.
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *         example: cmk7e7tg401ezlp22wkz5rxky
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               stateId: { type: string, nullable: true }
 *               coverImageUrl: { type: string }
 *               isActive: { type: boolean }
 *               seoTitle: { type: string }
 *               seoDescription: { type: string }
 *               seoKeywords: { type: string }
 *     responses:
 *       200:
 *         description: Updated edition
 */
router.put('/publication-editions/:id', auth, updatePublicationEdition);

/**
 * @swagger
 * /epaper/publication-editions/{id}:
 *   delete:
 *     summary: Delete (soft) a publication edition
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/publication-editions/:id', auth, deletePublicationEdition);

/**
 * @swagger
 * /epaper/publication-editions/{editionId}/sub-editions:
 *   get:
 *     summary: List sub-editions for a publication edition
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: editionId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includeDeleted
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: List of sub-editions
 */
router.get('/publication-editions/:editionId/sub-editions', auth, listPublicationSubEditions);

/**
 * @swagger
 * /epaper/publication-editions/{editionId}/sub-editions:
 *   post:
 *     summary: Create a sub-edition (district-level)
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: editionId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Adilabad" }
 *               slug: { type: string, example: "adilabad" }
 *               districtId: { type: string, description: "Optional. Link sub-edition to an existing District." }
 *               coverImageUrl: { type: string }
 *               isActive: { type: boolean, default: true }
 *               seoTitle: { type: string }
 *               seoDescription: { type: string }
 *               seoKeywords: { type: string }
 *     responses:
 *       201:
 *         description: Created sub-edition
 */
router.post('/publication-editions/:editionId/sub-editions', auth, createPublicationSubEdition);

/**
 * @swagger
 * /epaper/publication-sub-editions/{id}:
 *   get:
 *     summary: Get a sub-edition by ID
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Sub-edition details
 */
router.get('/publication-sub-editions/:id', auth, getPublicationSubEdition);

/**
 * @swagger
 * /epaper/publication-sub-editions/{id}:
 *   put:
 *     summary: Update a sub-edition
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               districtId: { type: string }
 *               coverImageUrl: { type: string }
 *               isActive: { type: boolean }
 *               seoTitle: { type: string }
 *               seoDescription: { type: string }
 *               seoKeywords: { type: string }
 *     responses:
 *       200:
 *         description: Updated sub-edition
 */
router.put('/publication-sub-editions/:id', auth, updatePublicationSubEdition);

/**
 * @swagger
 * /epaper/publication-sub-editions/{id}:
 *   delete:
 *     summary: Delete (soft) a sub-edition
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/publication-sub-editions/:id', auth, deletePublicationSubEdition);

// ============================================================================
// PDF-BASED ISSUES (one PDF per date per edition/sub-edition)
// ============================================================================

/**
 * @swagger
 * /epaper/pdf-issues/upload:
 *   post:
 *     summary: Upload/replace a PDF-based ePaper issue
 *     description: |
 *       Admin-only.
 *
 *       Rules:
 *       - Provide exactly one: editionId OR subEditionId
 *       - One PDF per (tenant + date + target). Re-upload replaces existing and regenerates PNG pages.
 *       - Page 1 becomes coverImageUrl.
 *
 *       Validation:
 *       - `issueDate` must be YYYY-MM-DD
 *       - Uploaded file must be a PDF
 *
 *       Requires Poppler `pdftoppm` available on the server (or set PDFTOPPM_PATH).
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (upload for any tenant)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, issueDate]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               issueDate:
 *                 type: string
 *                 example: "2026-01-12"
 *               editionId:
 *                 type: string
 *               subEditionId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Uploaded/replaced
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   ok: true
 *                   issue:
 *                     id: "iss_1"
 *                     tenantId: "t_abc"
 *                     issueDate: "2026-01-12T00:00:00.000Z"
 *                     editionId: "ed_1"
 *                     subEditionId: null
 *                     pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                     coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                     pageCount: 12
 *                     pages: []
 *       400:
 *         description: Validation error (missing target / invalid date / not a PDF)
 *       403:
 *         description: Tenant override not allowed (non-superadmin)
 */
router.post('/pdf-issues/upload', auth, upload.single('pdf'), uploadPdfIssue);

/**
 * @swagger
 * /epaper/pdf-issues/upload-by-url:
 *   post:
 *     summary: Upload/replace a PDF-based ePaper issue by URL
 *     description: |
 *       Admin-only.
 *
 *       Use this when your frontend already uploaded the PDF to Bunny (or any public URL)
 *       and you want the backend to fetch it, convert to PNG pages, and upsert the daily issue.
 *
 *       Rules:
 *       - Provide exactly one: editionId OR subEditionId
 *       - One PDF per (tenant + date + target). Re-run replaces existing and regenerates PNG pages.
 *       - Page 1 becomes coverImageUrl.
 *
 *       Validation:
 *       - `issueDate` must be YYYY-MM-DD
 *       - `pdfUrl` must be a public http/https URL that returns a real PDF
 *
 *       Security:
 *       - Only http/https URLs allowed
 *       - Local/private hosts are rejected
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (upload for any tenant)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pdfUrl, issueDate]
 *             properties:
 *               tenantId:
 *                 type: string
 *                 description: SUPER_ADMIN only (alternative to query tenantId)
 *               pdfUrl:
 *                 type: string
 *                 example: "https://kaburlu-news.b-cdn.net/epaper/pdfs/2026/01/12/telangana.pdf"
 *               issueDate:
 *                 type: string
 *                 example: "2026-01-12"
 *               editionId:
 *                 type: string
 *               subEditionId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Uploaded/replaced
 *         content:
 *           application/json:
 *             examples:
 *               editionTarget:
 *                 summary: Create/replace an edition-level issue
 *                 value:
 *                   ok: true
 *                   issue:
 *                     id: "iss_1"
 *                     issueDate: "2026-01-12T00:00:00.000Z"
 *                     editionId: "ed_1"
 *                     subEditionId: null
 *                     pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                     coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                     pageCount: 12
 *               subEditionTarget:
 *                 summary: Create/replace a sub-edition issue
 *                 value:
 *                   ok: true
 *                   issue:
 *                     id: "iss_2"
 *                     issueDate: "2026-01-12T00:00:00.000Z"
 *                     editionId: null
 *                     subEditionId: "sub_1"
 *                     pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/adilabad.pdf"
 *                     coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/adilabad/p1.png"
 *                     pageCount: 8
 *       400:
 *         description: Validation error (missing target / invalid URL / invalid date)
 *       403:
 *         description: Tenant override not allowed (non-superadmin)
 */
router.post('/pdf-issues/upload-by-url', auth, uploadPdfIssueByUrl);

/**
 * @swagger
 * /epaper/pdf-issues:
 *   get:
 *     summary: Find PDF issues by date (optionally filter by edition/sub-edition)
 *     description: |
 *       Admin-only.
 *       - `issueDate` is required.
 *       - If you provide `editionId` OR `subEditionId`, returns the single matching issue (with pages).
 *       - If you provide neither, returns all issues for that date as `{ items: [...] }`.
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (find issue for any tenant)
 *       - in: query
 *         name: issueDate
 *         required: true
 *         schema: { type: string, example: "2026-01-12" }
 *       - in: query
 *         name: editionId
 *         schema: { type: string }
 *       - in: query
 *         name: subEditionId
 *     responses:
 *       200:
 *         description: Issue with pages OR list of issues
 *         content:
 *           application/json:
 *             examples:
 *               singleIssue:
 *                 value:
 *                   id: "iss_1"
 *                   issueDate: "2026-01-12T00:00:00.000Z"
 *                   editionId: "ed_1"
 *                   subEditionId: null
 *                   pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                   coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                   pageCount: 12
 *                   pages:
 *                     - pageNumber: 1
 *                       imageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *               listByDate:
 *                 value:
 *                   items:
 *                     - id: "iss_1"
 *                       issueDate: "2026-01-12T00:00:00.000Z"
 *                       editionId: "ed_1"
 *                       subEditionId: null
 *                       pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                       coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                       pageCount: 12
 *       400:
 *         description: Validation error (missing/invalid query params)
 */
router.get('/pdf-issues', auth, findPdfIssue);

/**
 * @swagger
 * /epaper/pdf-issues/{id}:
 *   get:
 *     summary: Get a PDF issue by ID
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Issue with pages
 */
router.get('/pdf-issues/:id', auth, getPdfIssue);

// ============================================================================
// BLOCK SUGGESTION
// ============================================================================

/**
 * @swagger
 * /epaper/suggest-block:
 *   post:
 *     summary: Suggest a block template for article
 *     description: Based on character count, image presence, and highlights, suggests the best block template.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [charCount]
 *             properties:
 *               charCount: { type: integer, example: 1200 }
 *               wordCount: { type: integer, example: 200 }
 *               hasImage: { type: boolean, example: true }
 *               hasHighlights: { type: boolean, example: true }
 *               highlightCount: { type: integer, example: 3 }
 *               isBreaking: { type: boolean, example: false }
 *     responses:
 *       200:
 *         description: Suggested block template
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestedTemplateId: { type: string }
 *                 suggestedTemplateCode: { type: string }
 *                 suggestedTemplateName: { type: string }
 *                 confidence: { type: number, example: 0.85 }
 *                 alternatives: { type: array, items: { type: object } }
 */
router.post('/suggest-block', auth, suggestBlockTemplate);

export default router;
