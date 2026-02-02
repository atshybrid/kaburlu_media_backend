// src/app.ts
import 'reflect-metadata';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import passport from 'passport';
import cors, { CorsOptions } from 'cors';
import jwtStrategy from './api/auth/jwt.strategy';
import swaggerUi from 'swagger-ui-express';

import categoriesRoutes from './api/categories/categories.routes';
import languagesRoutes from './api/languages/languages.routes';
import statesRoutes from './api/states/states.routes';
import rolesRoutes from './api/roles/roles.routes';
import permissionsRoutes from './api/roles/permissions.routes';
import usersRoutes from './api/users/users.routes';
import authRoutes from './api/auth/auth.routes';
import otpRoutes from './api/auth/otp.routes';
import articlesRoutes from './api/articles/articles.routes';
import articleReadRoutes from './api/articles/articleRead.routes';
import reactionsRoutes from './api/reactions/reactions.routes';
import commentsRoutes from './api/comments/comments.routes';
import locationsRoutes from './api/locations/locations.routes';
import translateRoutes from './api/translate/translate.routes';
import profileRoutes from './api/profiles/profiles.routes';
import shortNewsRoutes from './api/shortnews/shortnews.routes';
import shortNewsReadRoutes from './api/shortnews/shortNewsRead.routes';
import mediaRoutes from './api/media/media.routes';
import devicesRoutes from './api/devices/devices.routes';
import notificationsRoutes from './api/notifications/notifications.routes';
import promptsRoutes from './api/prompts/prompts.routes';
import preferencesRoutes from './api/preferences/preferences.routes';
import shortnewsOptionsRouter from './api/shortnewsOptions/shortnewsOptions.routes';
import castesRoutes from './api/castes/castes.routes';
import publicRoutes from './api/public/public.routes';
import websitePublicRoutes from './api/public/website.routes';
import rootSeoRoutes from './api/public/rootSeo.routes';
import publicReporterJoinRoutes from './api/public/publicReporterJoin.routes';
import tenantsRoutes from './api/tenants/tenants.routes';
import domainsRoutes from './api/domains/domains.routes';
import billingRoutes from './api/billing/billing.routes';
import reportersRoutes from './api/reporters/reporters.routes';
import reportersMeIdCardRoutes from './api/reporters/reporters.me.idcard.routes';
import tenantReportersRoutes from './api/reporters/tenantReporters.routes';
import reporterPaymentsRoutes from './api/reporterPayments/reporterPayments.routes';
import tenantThemeRoutes from './api/tenantTheme/tenantTheme.routes';
import homepageSectionsRoutes from './api/homepageSections/homepageSections.routes';
import tenantAdsRoutes from './api/ads/tenantAds.routes';
import tenantStaticPagesRoutes from './api/pages/tenantStaticPages.routes';
import prgiRoutes from './api/prgi/prgi.routes';
import districtsRoutes from './api/districts/districts.routes';
import mandalsRoutes from './api/mandals/mandals.routes';
import assemblyConstituenciesRoutes from './api/assembly/assemblyConstituencies.routes';
import adminRoutes from './api/admin/admin.routes';
import webhooksRoutes from './api/webhooks/webhooks.routes';
import idCardsRoutes from './api/idCards/idCards.routes';
import whatsappRoutes from './api/whatsapp/whatsapp.routes';
import reporterDesignationsPublicRoutes from './api/reporters/reporterDesignations.public.routes';
import { Router } from 'express';
import settingsRouter from './api/settings/settings.routes';
import aiTestRoutes from './api/ai/ai.routes';
import aiUnifiedRoutes from './api/ai/ai.unified.routes';
import dashboardRoutes from './api/dashboard/dashboard.routes';
import aiNewspaperRewriteRoutes from './api/ainewspaper/ainewspaper.routes';
import locationAiRoutes from './api/locationAi/locationAi.routes';
import locationStatusRoutes from './api/locationStatus/locationStatus.routes';
import metaRoutes from './api/meta/meta.routes';
import familyRoutes from './api/family/family.routes';
import epaperRoutes from './api/epaper/epaper.routes';
import proofsRoutes from './api/proofs/proofs.routes';
import aiHealthRoutes from './api/health/ai.routes';
import articlesUnifiedRoutes from './api/articles/unified.routes';
import reporterArticlesRoutes from './api/articles/reporter.routes';
import leaderboardRoutes from './api/leaderboard/leaderboard.routes';
import analyticsRoutes from './api/analytics/analytics.routes';
import gdprRoutes from './api/gdpr/gdpr.routes';
import universalLinksRoutes from './api/universal-links/universal-links.routes';
import tenantAdminsRoutes from './api/tenantAdmins/tenantAdmins.routes';

const app = express();

// Swagger helpers
const noStore = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

/**
 * CORS configuration
 *
 * - You can set CORS_ORIGINS as a comma-separated list of allowed origins.
 *   Example: CORS_ORIGINS="https://app.kaburlumedia.com,http://localhost:3000"
 *
 * - Or set CORS_ALLOW_ALL=true to allow all origins (only for dev/testing).
 */
import { ensureCoreSeeds } from './lib/bootstrap';
const defaultWhitelist = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://ai-kaburlu-backend.onrender.com',
  'https://app.kaburlumedia.com'

];

// Note: Core seeds are triggered from index.ts AFTER Prisma connects to avoid noisy
// errors during transient DB connectivity. Do not call ensureCoreSeeds here.

const envOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [];

const whitelist = Array.from(new Set([...defaultWhitelist, ...envOrigins]));

const allowAll = String(process.env.CORS_ALLOW_ALL).toLowerCase() === 'true';

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // If no origin (e.g., server-to-server, curl, or Postman), allow it
    if (!origin) return callback(null, true);

    if (allowAll) {
      return callback(null, true);
    }

    if (whitelist.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  // Allow custom tenant header for cross-origin calls
  allowedHeaders: 'Content-Type, Authorization, X-Tenant-Domain, X-Tenant-Id, X-Tenant-Slug'
};

// Middlewares
app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());

// Root-level SEO endpoints (robots.txt/sitemap.xml) for domain-based public sites.
// Best practice: these files should live at the domain root.
app.use('/', rootSeoRoutes);

// Universal Links / App Links verification and short URL redirects
// MUST be at root level for Apple/Google verification
app.use('/', universalLinksRoutes);

// Compatibility: redirect versioned paths to the root equivalents.
// (Some clients mistakenly call /api/v1/robots.txt and /api/v1/sitemap.xml.)
app.get('/api/v1/robots.txt', (req, res) => {
  const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  return res.redirect(301, `/robots.txt${qs}`);
});
app.get('/api/v1/sitemap.xml', (req, res) => {
  const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  return res.redirect(301, `/sitemap.xml${qs}`);
});

// JSON body parser with sanitization for illegal control characters
// Control chars 0x00-0x1F are illegal in JSON strings except \t(9), \n(10), \r(13).
// This helps when text is pasted from Word/web with invisible control chars.
app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
      // Sanitize the buffer string to strip illegal control chars before parsing
      // Note: This is done post-parse via middleware below
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Post-parse sanitization: strip illegal JSON control characters from string fields
// (0x00-0x1F except \t \n \r). Helps when text is pasted from Word/web sources.
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      }
      if (Array.isArray(obj)) return obj.map(sanitize);
      if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          obj[key] = sanitize(obj[key]);
        }
      }
      return obj;
    };
    req.body = sanitize(req.body);
  }
  next();
});

// JSON body parse error handler (must be BEFORE other routes' logic error handling) –
// Express's built-in json parser throws a SyntaxError for invalid JSON; we intercept
// and convert to a 400 with a clear, consistent structure.
// Also handles PayloadTooLargeError for oversized requests.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    // Check if it's a control character issue (common when pasting from Word/web)
    const isControlCharError = err.message.includes('control character');
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload',
      message: err.message,
      hint: isControlCharError
        ? 'Text contains invisible control characters (often from Word/web copy-paste). Try: 1) Paste into plain text editor first, 2) Remove and re-type special characters, 3) Use a JSON validator to find the exact position.'
        : 'Ensure request body is valid JSON: use double quotes for property names & strings, no trailing commas.'
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload too large',
      message: 'Request body exceeds the maximum allowed size of 50MB',
      hint: 'For large media uploads, use the /api/v1/media/upload endpoint with multipart/form-data.'
    });
  }
  return next(err);
});

// Passport JWT strategy
app.use(passport.initialize());
try {
  jwtStrategy(passport);
} catch (e) {
  console.error('Failed to initialize JWT strategy:', e);
}

// Swagger UI
// Serve Swagger JSON (useful for clients and avoids stale cached UI/spec in production)
app.get('/api/docs-json', noStore, (_req, res) => {
  const swaggerSpec = require('./lib/swagger').default;
  res.setHeader('Cache-Control', 'no-store');
  res.json(swaggerSpec);
});
app.get('/api/v1/docs-json', noStore, (_req, res) => {
  const swaggerSpec = require('./lib/swagger').default;
  res.setHeader('Cache-Control', 'no-store');
  res.json(swaggerSpec);
});

// Swagger UI (always loads live spec from the JSON endpoints)
app.use(
  '/api/docs',
  noStore,
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    swaggerOptions: { url: '/api/docs-json' }
  })
);
// Also expose docs under the versioned base for convenience
// IMPORTANT: Swagger routes MUST come BEFORE settings router to avoid 404
app.use(
  '/api/v1/docs',
  noStore,
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    swaggerOptions: { url: '/api/v1/docs-json' }
  })
);
app.use('/api/v1', settingsRouter);

// API Routes (no version prefix) - legacy support
app.use('/articles', articlesRoutes);
app.use('/articles/read', articleReadRoutes);
app.use('/shortnews', shortNewsRoutes);
app.use('/shortnews/read', shortNewsReadRoutes);
// Deprecated likes routes removed; unified reactions API replaces them.
app.use('/likes', (_req, res) => {
  return res.status(410).json({
    error: 'The /likes API is deprecated. Use PUT /reactions with { reaction: "like" | "dislike" | null } instead.'
  });
});
app.use('/reactions', reactionsRoutes);
app.use('/comments', commentsRoutes);
app.use('/categories', categoriesRoutes);
app.use('/languages', languagesRoutes);
app.use('/states', statesRoutes);
app.use('/roles', rolesRoutes);
app.use('/permissions', permissionsRoutes);
app.use('/users', usersRoutes);
// GDPR compliance routes (data export, account deletion)
app.use('/users', gdprRoutes);
app.use('/auth', authRoutes);
app.use('/auth', otpRoutes);
app.use('/locations', locationsRoutes);
app.use('/districts', districtsRoutes);
app.use('/mandals', mandalsRoutes);
app.use('/', assemblyConstituenciesRoutes);
// Tenant-scoped reporter management (mount root so internal paths /tenants/:tenantId/... work)
app.use('/', tenantReportersRoutes);
// Billing routes include both /billing/* and /tenants/:tenantId/billing/*
app.use('/', billingRoutes);
app.use('/translate', translateRoutes);
app.use('/profiles', profileRoutes);
app.use('/media', mediaRoutes);
app.use('/devices', devicesRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/prompts', promptsRoutes);
app.use('/ai', aiTestRoutes);
app.use('/', aiNewspaperRewriteRoutes);
app.use('/location', locationAiRoutes);
app.use('/location', locationStatusRoutes);
app.use('/preferences', preferencesRoutes);
app.use('/shortnews-options', shortnewsOptionsRouter);
app.use('/dashboard', dashboardRoutes);
// Mount reporter payments routes at root so absolute paths inside work (e.g., /tenants/:tenantId/reporters/:id/payments/order)
app.use('/', reporterPaymentsRoutes);
// Tenant static pages (admin CRUD)
app.use('/', tenantStaticPagesRoutes);
// family & kin-relations removed
app.use('/castes', castesRoutes);
app.use('/meta', metaRoutes);
app.use('/family', familyRoutes);
app.use('/epaper', epaperRoutes);
// Health endpoints
app.use('/health', aiHealthRoutes);
// Leaderboard endpoints
app.use('/leaderboard', leaderboardRoutes);
// Analytics endpoints
app.use('/analytics', analyticsRoutes);
// Tenant Admins - simplified CRUD
app.use('/tenant-admins', tenantAdminsRoutes);

// API Routes mounted under /api/v1 (preferred)
const apiV1: Router = Router();
apiV1.use('/articles', articlesUnifiedRoutes);  // Unified 3-in-1 article creation (MUST be before articlesRoutes to avoid /:id catching /unified)
apiV1.use('/articles', articlesRoutes);
apiV1.use('/articles/read', articleReadRoutes);
apiV1.use('/reporter', reporterArticlesRoutes);  // Reporter dashboard - own articles only (authorId from JWT)
apiV1.use('/shortnews', shortNewsRoutes);
apiV1.use('/shortnews/read', shortNewsReadRoutes);
apiV1.use('/likes', (_req, res) => {
  return res.status(410).json({
    error: 'The /api/v1/likes API is deprecated. Use /api/v1/reactions instead.'
  });
});
apiV1.use('/reactions', reactionsRoutes);
apiV1.use('/comments', commentsRoutes);
apiV1.use('/categories', categoriesRoutes);
apiV1.use('/languages', languagesRoutes);
apiV1.use('/states', statesRoutes);
apiV1.use('/roles', rolesRoutes);
apiV1.use('/permissions', permissionsRoutes);
apiV1.use('/users', usersRoutes);
// GDPR compliance routes (data export, account deletion)
apiV1.use('/users', gdprRoutes);
apiV1.use('/auth', authRoutes);
apiV1.use('/auth', otpRoutes);
apiV1.use('/locations', locationsRoutes);
apiV1.use('/districts', districtsRoutes);
apiV1.use('/mandals', mandalsRoutes);
apiV1.use('/', assemblyConstituenciesRoutes);
// Tenant-scoped reporter management under versioned API as well
apiV1.use('/', tenantReportersRoutes);
apiV1.use('/', billingRoutes);
apiV1.use('/translate', translateRoutes);
apiV1.use('/profiles', profileRoutes);
apiV1.use('/media', mediaRoutes);
apiV1.use('/devices', devicesRoutes);
apiV1.use('/notifications', notificationsRoutes);
apiV1.use('/prompts', promptsRoutes);
apiV1.use('/ai', aiTestRoutes);
apiV1.use('/ai', aiUnifiedRoutes);  // NEW: Unified Newsroom AI Agent
apiV1.use('/', aiNewspaperRewriteRoutes);  // DEPRECATED: Use /ai/rewrite/unified instead
apiV1.use('/location', locationAiRoutes);
apiV1.use('/location', locationStatusRoutes);
apiV1.use('/preferences', preferencesRoutes);
apiV1.use('/shortnews-options', shortnewsOptionsRouter);
apiV1.use('/dashboard', dashboardRoutes);
apiV1.use('/analytics', analyticsRoutes);
apiV1.use('/leaderboard', leaderboardRoutes);
// Mount reporter payments under versioned root as well for absolute paths
apiV1.use('/', reporterPaymentsRoutes);
// family & kin-relations removed
apiV1.use('/castes', castesRoutes);
apiV1.use('/meta', metaRoutes);
apiV1.use('/family', familyRoutes);
apiV1.use('/epaper', epaperRoutes);
apiV1.use('/proofs', proofsRoutes);
apiV1.use('/health', aiHealthRoutes);
apiV1.use('/tenants', tenantsRoutes);
apiV1.use('/domains', domainsRoutes);
apiV1.use('/reporters', reportersRoutes);
// Tenant Admins - simplified CRUD (also under /api/v1)
apiV1.use('/tenant-admins', tenantAdminsRoutes);
apiV1.use('/reporters/me', reportersMeIdCardRoutes);
// Public helper: used by public join to list designation options
apiV1.use('/reporter-designations', reporterDesignationsPublicRoutes);
apiV1.use('/reporter-payments', reporterPaymentsRoutes);
apiV1.use('/tenant-theme', tenantThemeRoutes);
apiV1.use('/homepage-sections', homepageSectionsRoutes);
apiV1.use('/', tenantAdsRoutes);
apiV1.use('/', tenantStaticPagesRoutes);
apiV1.use('/prgi', prgiRoutes);
apiV1.use('/admin', adminRoutes);
apiV1.use('/webhooks', webhooksRoutes);
// Public ID Card render APIs (JSON/HTML/PDF)
apiV1.use('/id-cards', idCardsRoutes);
// WhatsApp template management
apiV1.use('/whatsapp', whatsappRoutes);
// Public reporter join (tenantId-based; does not rely on Host)
apiV1.use('/public-join', publicReporterJoinRoutes);
// Versioned public read-only routes (duplicate of /api/public for convenience in Swagger testing)
apiV1.use('/public', publicRoutes);
apiV1.use('/public', websitePublicRoutes);
// Multi-tenant public read-only routes (domain based)
// Preferred mount without version/prefix for frontend consumption
app.use('/public', publicRoutes);
app.use('/public', websitePublicRoutes);
app.use('/public-join', publicReporterJoinRoutes);
// Backward compatibility mounts (still available)
app.use('/api/public', publicRoutes);
app.use('/api/public', websitePublicRoutes);
app.use('/api/public-join', publicReporterJoinRoutes);
app.use('/api/v1', apiV1);

// Protected sample route
app.get(
  '/protected',
  passport.authenticate('jwt', { session: false }),
  (_req, res) => {
    res.json({ message: 'You are authorized to see this message' });
  }
);

// Root route - Landing page
app.get('/', (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kaburlu Media API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #e94560, #ff6b6b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      font-size: 1.2rem;
      color: #a0a0a0;
      margin-bottom: 40px;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,0.1);
      padding: 12px 24px;
      border-radius: 50px;
      margin-bottom: 30px;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      background: #00ff88;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .links {
      display: flex;
      gap: 20px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .links a {
      color: #fff;
      text-decoration: none;
      padding: 12px 28px;
      border: 2px solid #e94560;
      border-radius: 8px;
      transition: all 0.3s;
    }
    .links a:hover {
      background: #e94560;
    }
    .links a.primary {
      background: #e94560;
    }
    .links a.primary:hover {
      background: #ff6b6b;
      border-color: #ff6b6b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">📰</div>
    <h1>Kaburlu Media API</h1>
    <p class="tagline">News & Media Backend Services</p>
    <div class="status">
      <span class="status-dot"></span>
      <span>API Running</span>
    </div>
    <div class="links">
      <a href="/api/v1/docs" class="primary">📖 API Documentation</a>
      <a href="/api/docs">Swagger UI</a>
    </div>
  </div>
</body>
</html>
  `);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler (must be 4 args)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err && (err.stack || err.message || err));
  const status = err && err.status && Number(err.status) >= 400 ? Number(err.status) : 500;
  res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal Server Error' : err.message || 'Error',
    message: err && err.message ? err.message : undefined
  });
});

export default app;
