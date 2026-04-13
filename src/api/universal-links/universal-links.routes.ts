import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

// App Store URLs - Update these with your actual app store links
const APP_STORE_URL = process.env.IOS_APP_STORE_URL || 'https://apps.apple.com/app/kaburlu/id123456789';
const PLAY_STORE_URL = process.env.ANDROID_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.media.kaburlu';
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE_NAME || 'com.media.kaburlu';

/**
 * @swagger
 * /.well-known/apple-app-site-association:
 *   get:
 *     summary: iOS Universal Links verification file
 *     tags: [Universal Links]
 *     responses:
 *       200:
 *         description: Apple App Site Association JSON
 */
router.get('/.well-known/apple-app-site-association', (_req: Request, res: Response) => {
  const appID = `${process.env.APPLE_TEAM_ID || 'TEAM_ID'}.${process.env.IOS_BUNDLE_ID || 'com.media.kaburlu'}`;
  // Support both new (iOS 13+) and legacy (iOS 12-) formats
  const appSiteAssociation = {
    applinks: {
      details: [
        {
          // New format (iOS 13+)
          appIDs: [appID],
          components: [
            { '/': '/s/*' },
            { '/': '/open/*' },
            { '/': '/*' }
          ]
        },
        {
          // Legacy format (iOS 12 and below)
          appID: appID,
          paths: ['/s/*', '/open/*', '/*']
        }
      ]
    }
  };
  
  // Must be served with correct content-type and NO redirect for Universal Links to work
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(appSiteAssociation);
});

/**
 * @swagger
 * /.well-known/assetlinks.json:
 *   get:
 *     summary: Android App Links verification file
 *     tags: [Universal Links]
 *     responses:
 *       200:
 *         description: Android Asset Links JSON
 */
router.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  const packageName = process.env.ANDROID_PACKAGE_NAME || 'com.media.kaburlu';
  const sha256Fingerprints = process.env.ANDROID_SHA256_FINGERPRINT
    ? process.env.ANDROID_SHA256_FINGERPRINT.split(',').map(s => s.trim())
    : ['CE:03:35:2C:60:BE:5D:A8:2D:60:DE:63:B7:3A:C7:BE:5F:24:3B:3B:71:89:A2:95:51:DF:DA:62:1F:57:EE:86'];

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: sha256Fingerprints
      }
    }
  ];

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(assetLinks);
});

// ─── Deep-link web fallback pages ───────────────────────────────────────────

/**
 * GET /article/:id
 * Web fallback for Android App Links / iOS Universal Links.
 * - If user has the app → Android opens it directly via App Link (never hits this route).
 * - If user does NOT have the app → browser lands here → smart redirect to Play Store.
 */
router.get('/article/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) { res.status(400).send('Missing article id'); return; }

  const ua = req.headers['user-agent'] || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const appSchemeUrl = `kaburlu://article/${encodeURIComponent(id)}`;
  const storeUrl = isIOS ? APP_STORE_URL : PLAY_STORE_URL;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening in Kaburlu…</title>
  <!-- Android App Link meta -->
  <meta property="al:android:package" content="${ANDROID_PACKAGE}" />
  <meta property="al:android:url" content="${appSchemeUrl}" />
  <meta property="al:android:app_name" content="Kaburlu" />
  <!-- iOS Universal Link meta -->
  <meta property="al:ios:url" content="${appSchemeUrl}" />
  <meta property="al:ios:app_name" content="Kaburlu" />
</head>
<body>
  <p>Opening article in Kaburlu app…</p>
  <script>
    (function () {
      var appUrl = '${appSchemeUrl}';
      var storeUrl = '${storeUrl}';
      var isAndroid = ${isAndroid};
      var isIOS = ${isIOS};
      if (isAndroid || isIOS) {
        var start = Date.now();
        window.location = appUrl;
        setTimeout(function () {
          if (Date.now() - start < 2500) {
            window.location = storeUrl;
          }
        }, 2000);
      } else {
        // Desktop: just redirect to Play Store listing
        window.location = storeUrl;
      }
    })();
  <\/script>
</body>
</html>`);
});

/**
 * GET /category/:slug
 * Web fallback for category deep links.
 */
router.get('/category/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug) { res.status(400).send('Missing category slug'); return; }

  const ua = req.headers['user-agent'] || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const appSchemeUrl = `kaburlu://category/${encodeURIComponent(slug)}`;
  const storeUrl = isIOS ? APP_STORE_URL : PLAY_STORE_URL;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening in Kaburlu…</title>
  <meta property="al:android:package" content="${ANDROID_PACKAGE}" />
  <meta property="al:android:url" content="${appSchemeUrl}" />
  <meta property="al:android:app_name" content="Kaburlu" />
  <meta property="al:ios:url" content="${appSchemeUrl}" />
  <meta property="al:ios:app_name" content="Kaburlu" />
</head>
<body>
  <p>Opening category in Kaburlu app…</p>
  <script>
    (function () {
      var appUrl = '${appSchemeUrl}';
      var storeUrl = '${storeUrl}';
      var isAndroid = ${isAndroid};
      var isIOS = ${isIOS};
      if (isAndroid || isIOS) {
        var start = Date.now();
        window.location = appUrl;
        setTimeout(function () {
          if (Date.now() - start < 2500) {
            window.location = storeUrl;
          }
        }, 2000);
      } else {
        window.location = storeUrl;
      }
    })();
  <\/script>
</body>
</html>`);
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: Detect device type from user agent
 */
function detectDevice(userAgent: string): { isIOS: boolean; isAndroid: boolean; isMobile: boolean } {
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  return { isIOS, isAndroid, isMobile: isIOS || isAndroid };
}

/**
 * Helper: User-friendly HTML page for invalid / not-found / expired short links
 */
function generateNotFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Link not found – Kaburlu</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #FF5722 0%, #FF7043 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      max-width: 360px;
      width: 100%;
      background: white;
      border-radius: 20px;
      padding: 36px 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .icon { font-size: 56px; margin-bottom: 12px; }
    .brand { font-size: 22px; font-weight: 700; color: #FF5722; margin-bottom: 20px; }
    h1 { font-size: 20px; color: #222; margin-bottom: 10px; }
    p { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px; }
    a.btn {
      display: inline-block;
      padding: 14px 28px;
      background: linear-gradient(135deg, #FF5722, #F4511E);
      color: white;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔗</div>
    <div class="brand">Kaburlu</div>
    <h1>Link not found</h1>
    <p>This link may have expired or the article was removed. Browse the latest news on Kaburlu.</p>
    <a href="https://kaburlumedia.com" class="btn">Go to Kaburlu</a>
  </div>
</body>
</html>`;
}

/**
 * Helper: Generate smart banner HTML for mobile devices
 */
function generateSmartBannerHtml(params: {
  newsTitle: string;
  appDeepLink: string;
  webUrl: string;
  storeUrl: string;
  storeName: string;
  isIOS: boolean;
  ogDescription?: string;
  ogImage?: string;
}): string {
  const { newsTitle, appDeepLink, webUrl, storeUrl, storeName, isIOS, ogDescription, ogImage } = params;
  const safeTitle = newsTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeDesc = (ogDescription || 'Read the latest news on Kaburlu').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeImage = ogImage || `https://kaburlumedia.com/og-default.jpg`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${webUrl}" />
  <meta property="og:site_name" content="Kaburlu" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />
  <link rel="canonical" href="${webUrl}" />
  <meta name="apple-itunes-app" content="app-id=${process.env.IOS_APP_ID || '123456789'}">
  <title>${safeTitle} - Kaburlu</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: linear-gradient(135deg, #FF5722 0%, #FF7043 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container { 
      max-width: 380px; 
      width: 100%;
      background: white; 
      padding: 32px 24px; 
      border-radius: 20px; 
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .logo { 
      font-size: 48px; 
      margin-bottom: 8px;
    }
    .brand {
      font-size: 24px;
      font-weight: 700;
      color: #FF5722;
      margin-bottom: 16px;
    }
    .title { 
      color: #333; 
      font-size: 16px; 
      margin-bottom: 24px; 
      line-height: 1.5;
      max-height: 72px;
      overflow: hidden;
    }
    .status { 
      color: #666; 
      font-size: 14px;
      margin-bottom: 20px;
      min-height: 20px;
    }
    .btn { 
      display: block; 
      padding: 16px 24px; 
      color: white; 
      text-decoration: none; 
      border-radius: 12px; 
      margin: 10px 0; 
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, opacity 0.2s;
    }
    .btn:active { transform: scale(0.98); opacity: 0.9; }
    .primary { background: linear-gradient(135deg, #FF5722 0%, #F4511E 100%); }
    .store { background: ${isIOS ? '#000' : '#01875f'}; }
    .store-icon { font-size: 18px; margin-right: 8px; }
    .web { background: #6c757d; }
    .divider {
      display: flex;
      align-items: center;
      margin: 16px 0;
      color: #999;
      font-size: 12px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e0e0e0;
    }
    .divider span { padding: 0 12px; }
    .pulse { animation: pulse 2s infinite; }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,87,34,0.4); }
      50% { box-shadow: 0 0 0 10px rgba(255,87,34,0); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">📰</div>
    <div class="brand">Kaburlu</div>
    <p class="title">${safeTitle}</p>
    <p class="status" id="status">Opening app...</p>
    
    <a href="${appDeepLink}" class="btn primary pulse" id="openApp">
      Open in Kaburlu App
    </a>
    
    <div class="divider"><span>App not installed?</span></div>
    
    <a href="${storeUrl}" class="btn store" id="storeLink">
      <span class="store-icon">${isIOS ? '🍎' : '▶️'}</span>
      Download from ${storeName}
    </a>
    
    <a href="${webUrl}" class="btn web">
      View on Website
    </a>
  </div>
  
  <script>
    (function() {
      var hidden = false;
      
      // Detect if page becomes hidden (app opened successfully)
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) hidden = true;
      });
      window.addEventListener('pagehide', function() { hidden = true; });
      
      // Try to open app immediately
      window.location.href = "${appDeepLink}";
      
      // Update UI after 2.5s if app did NOT open
      setTimeout(function() {
        if (!hidden) {
          document.getElementById('status').textContent = 'App not found. Download below:';
          document.getElementById('openApp').classList.remove('pulse');
          document.getElementById('storeLink').classList.add('pulse');
        }
      }, 2500);
    })();
  </script>
</body>
</html>`;
}

/**
 * @swagger
 * /s/{shortId}:
 *   get:
 *     summary: Short URL - Universal Link handler with smart app/store/web routing
 *     description: |
 *       Smart short URL handler that:
 *       - Mobile with app installed: Opens Kaburlu app via Universal Links / App Links
 *       - Mobile without app: Shows smart banner with App Store / Play Store download
 *       - Desktop: Redirects to web URL
 *     tags: [Universal Links]
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *         description: Short ID (last 6-8 chars of article/shortnews ID)
 *     responses:
 *       200:
 *         description: Smart banner HTML for mobile devices
 *       302:
 *         description: Redirect to web URL for desktop
 *       404:
 *         description: News not found
 */

// Helper function to handle short URL logic
async function handleShortUrl(shortId: string, req: Request, res: Response) {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const { isIOS, isAndroid, isMobile } = detectDevice(userAgent);
    
    if (!shortId || shortId.length < 6) {
      return res.status(400).send(generateNotFoundHtml());
    }

    // Initialize variables
    let newsId = '';
    let newsTitle = 'Kaburlu News';
    let newsDescription = '';
    let newsImage = '';
    let categorySlug = 'news';
    let domain = 'kaburlumedia.com';
    let newsSlug = '';
    let newsType = 'shortnews';

    // Try to find ShortNews first — use indexed shortId column, fallback to endsWith for old records
    const shortNews = await (prisma.shortNews as any).findFirst({
      where: {
        OR: [
          { shortId: shortId },
          { id: { endsWith: shortId } }
        ],
        status: { in: ['DESK_APPROVED', 'AI_APPROVED', 'PUBLISHED'] }
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        featuredImage: true,
        categoryId: true,
        author: {
          select: {
            reporterProfile: {
              select: {
                tenant: {
                  select: {
                    domains: {
                      where: { isPrimary: true },
                      take: 1,
                      select: { domain: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (shortNews) {
      newsId = shortNews.id;
      newsTitle = shortNews.title || 'Kaburlu News';
      newsDescription = (shortNews as any).summary || '';
      newsImage = (shortNews as any).featuredImage || '';
      newsSlug = shortNews.slug || shortNews.id;
      domain = (shortNews.author as any)?.reporterProfile?.tenant?.domains?.[0]?.domain || 'kaburlumedia.com';
      
      if (shortNews.categoryId) {
        const cat = await prisma.category.findUnique({
          where: { id: shortNews.categoryId },
          select: { slug: true }
        });
        if (cat?.slug) categorySlug = cat.slug;
      }
    } else {
      // Try Article if ShortNews not found
      const article = await prisma.article.findFirst({
        where: {
          id: { endsWith: shortId },
          status: { in: ['DESK_APPROVED', 'AI_APPROVED', 'PUBLISHED'] }
        },
        select: {
          id: true,
          title: true,
          headlines: true,
          images: true,
          categories: {
            select: { slug: true },
            take: 1
          },
          author: {
            select: {
              reporterProfile: {
                select: {
                  tenant: {
                    select: {
                      domains: {
                        where: { isPrimary: true },
                        take: 1,
                        select: { domain: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!article) {
        return res.status(404).send(generateNotFoundHtml());
      }

      newsId = article.id;
      newsTitle = article.title || 'Kaburlu News';
      newsDescription = (article as any).headlines || '';
      newsImage = (article as any).images?.[0] || '';
      newsSlug = article.id;
      newsType = 'article';
      categorySlug = article.categories?.[0]?.slug || 'news';
      domain = (article.author as any)?.reporterProfile?.tenant?.domains?.[0]?.domain || 'kaburlumedia.com';
    }

    // Build URLs
    const webUrl = `https://${domain}/${categorySlug}/${newsSlug}`;
    const storeUrl = isIOS ? APP_STORE_URL : PLAY_STORE_URL;
    // Android Chrome blocks custom-scheme navigation from JS; use intent:// instead
    const appDeepLink = isAndroid
      ? `intent://${newsType}/${newsId}#Intent;scheme=kaburlu;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`
      : `kaburlu://${newsType}/${newsId}`;
    const storeName = isIOS ? 'App Store' : 'Play Store';

    // For mobile devices, show smart banner
    if (isMobile) {
      const html = generateSmartBannerHtml({
        newsTitle,
        appDeepLink,
        webUrl,
        storeUrl,
        storeName,
        isIOS,
        ogDescription: newsDescription,
        ogImage: newsImage
      });

      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    // For desktop, redirect directly to web URL
    return res.redirect(302, webUrl);
  } catch (error) {
    console.error('Short URL redirect error:', error);
    return res.status(500).send(generateNotFoundHtml());
  }
}

// Route: /s/:shortId (for use with main domain e.g., kaburlumedia.com/s/abc123)
router.get('/s/:shortId', async (req: Request, res: Response) => {
  const { shortId } = req.params;
  return handleShortUrl(shortId, req, res);
});

// Route: /:shortId (for use with s.kaburlumedia.com/abc123)
// This catches direct shortId at root level when using subdomain s.kaburlumedia.com
router.get('/:shortId([a-zA-Z0-9]{6,})', async (req: Request, res: Response) => {
  const { shortId } = req.params;
  return handleShortUrl(shortId, req, res);
});

/**
 * @swagger
 * /open/{type}/{id}:
 *   get:
 *     summary: Deep link handler with app store fallback
 *     description: |
 *       Opens app with deep link, shows download options if app not installed.
 *       Detects device type (iOS/Android) and shows appropriate store link.
 *     tags: [Universal Links]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [shortnews, article]
 *         description: Content type
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content ID
 *     responses:
 *       200:
 *         description: Smart banner HTML page
 */
router.get('/open/:type/:id', async (req: Request, res: Response) => {
  const { type, id } = req.params;
  const userAgent = req.headers['user-agent'] || '';
  const { isIOS } = detectDevice(userAgent);
  
  const appDeepLink = `kaburlu://${type}/${id}`;
  let webUrl = 'https://kaburlumedia.com';
  let newsTitle = 'Kaburlu News';
  
  try {
    if (type === 'shortnews') {
      const news = await prisma.shortNews.findUnique({
        where: { id },
        select: { slug: true, title: true, categoryId: true }
      });
      if (news) {
        newsTitle = news.title || newsTitle;
        let catSlug = 'news';
        if (news.categoryId) {
          const cat = await prisma.category.findUnique({ 
            where: { id: news.categoryId }, 
            select: { slug: true } 
          });
          if (cat?.slug) catSlug = cat.slug;
        }
        webUrl = `https://kaburlumedia.com/${catSlug}/${news.slug || id}`;
      }
    } else if (type === 'article') {
      const article = await prisma.article.findUnique({
        where: { id },
        select: { title: true, categories: { select: { slug: true }, take: 1 } }
      });
      if (article) {
        newsTitle = article.title || newsTitle;
        const catSlug = article.categories?.[0]?.slug || 'news';
        webUrl = `https://kaburlumedia.com/${catSlug}/${id}`;
      }
    }
  } catch {}

  const storeUrl = isIOS ? APP_STORE_URL : PLAY_STORE_URL;
  const storeName = isIOS ? 'App Store' : 'Play Store';

  const html = generateSmartBannerHtml({
    newsTitle,
    appDeepLink,
    webUrl,
    storeUrl,
    storeName,
    isIOS
  });
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
