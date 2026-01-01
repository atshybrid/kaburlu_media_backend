// src/app.ts
import 'reflect-metadata';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import passport from 'passport';
import cors, { CorsOptions } from 'cors';
import jwtStrategy from './api/auth/jwt.strategy';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './lib/swagger';

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
import publicReporterJoinRoutes from './api/public/publicReporterJoin.routes';
import tenantsRoutes from './api/tenants/tenants.routes';
import domainsRoutes from './api/domains/domains.routes';
import reportersRoutes from './api/reporters/reporters.routes';
import tenantReportersRoutes from './api/reporters/tenantReporters.routes';
import reporterPaymentsRoutes from './api/reporterPayments/reporterPayments.routes';
import tenantThemeRoutes from './api/tenantTheme/tenantTheme.routes';
import tenantAdsRoutes from './api/ads/tenantAds.routes';
import prgiRoutes from './api/prgi/prgi.routes';
import districtsRoutes from './api/districts/districts.routes';
import mandalsRoutes from './api/mandals/mandals.routes';
import assemblyConstituenciesRoutes from './api/assembly/assemblyConstituencies.routes';
import adminRoutes from './api/admin/admin.routes';
import webhooksRoutes from './api/webhooks/webhooks.routes';
import idCardsRoutes from './api/idCards/idCards.routes';
import reporterDesignationsPublicRoutes from './api/reporters/reporterDesignations.public.routes';
import { Router } from 'express';
import settingsRouter from './api/settings/settings.routes';
import aiTestRoutes from './api/ai/ai.routes';
import dashboardRoutes from './api/dashboard/dashboard.routes';

const app = express();

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
  allowedHeaders: 'Content-Type, Authorization, X-Tenant-Domain'
};

// Middlewares
app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JSON body parse error handler (must be BEFORE other routes' logic error handling) –
// Express's built-in json parser throws a SyntaxError for invalid JSON; we intercept
// and convert to a 400 with a clear, consistent structure.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload',
      message: err.message,
      hint: 'Ensure request body is valid JSON: use double quotes for property names & strings, no trailing commas.'
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
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Also expose docs under the versioned base for convenience
app.use('/api/v1', settingsRouter);
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
app.use('/auth', authRoutes);
app.use('/auth', otpRoutes);
app.use('/locations', locationsRoutes);
app.use('/districts', districtsRoutes);
app.use('/mandals', mandalsRoutes);
app.use('/', assemblyConstituenciesRoutes);
// Tenant-scoped reporter management (mount root so internal paths /tenants/:tenantId/... work)
app.use('/', tenantReportersRoutes);
app.use('/translate', translateRoutes);
app.use('/profiles', profileRoutes);
app.use('/media', mediaRoutes);
app.use('/devices', devicesRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/prompts', promptsRoutes);
app.use('/ai', aiTestRoutes);
app.use('/preferences', preferencesRoutes);
app.use('/shortnews-options', shortnewsOptionsRouter);
app.use('/dashboard', dashboardRoutes);
// Mount reporter payments routes at root so absolute paths inside work (e.g., /tenants/:tenantId/reporters/:id/payments/order)
app.use('/', reporterPaymentsRoutes);
// family & kin-relations removed
app.use('/castes', castesRoutes);

// API Routes mounted under /api/v1 (preferred)
const apiV1: Router = Router();
apiV1.use('/articles', articlesRoutes);
apiV1.use('/articles/read', articleReadRoutes);
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
apiV1.use('/auth', authRoutes);
apiV1.use('/auth', otpRoutes);
apiV1.use('/locations', locationsRoutes);
apiV1.use('/districts', districtsRoutes);
apiV1.use('/mandals', mandalsRoutes);
apiV1.use('/', assemblyConstituenciesRoutes);
// Tenant-scoped reporter management under versioned API as well
apiV1.use('/', tenantReportersRoutes);
apiV1.use('/translate', translateRoutes);
apiV1.use('/profiles', profileRoutes);
apiV1.use('/media', mediaRoutes);
apiV1.use('/devices', devicesRoutes);
apiV1.use('/notifications', notificationsRoutes);
apiV1.use('/prompts', promptsRoutes);
apiV1.use('/ai', aiTestRoutes);
apiV1.use('/preferences', preferencesRoutes);
apiV1.use('/shortnews-options', shortnewsOptionsRouter);
apiV1.use('/dashboard', dashboardRoutes);
// Mount reporter payments under versioned root as well for absolute paths
apiV1.use('/', reporterPaymentsRoutes);
// family & kin-relations removed
apiV1.use('/castes', castesRoutes);
apiV1.use('/tenants', tenantsRoutes);
apiV1.use('/domains', domainsRoutes);
apiV1.use('/reporters', reportersRoutes);
// Public helper: used by public join to list designation options
apiV1.use('/reporter-designations', reporterDesignationsPublicRoutes);
apiV1.use('/reporter-payments', reporterPaymentsRoutes);
apiV1.use('/tenant-theme', tenantThemeRoutes);
apiV1.use('/', tenantAdsRoutes);
apiV1.use('/prgi', prgiRoutes);
apiV1.use('/admin', adminRoutes);
apiV1.use('/webhooks', webhooksRoutes);
// Public ID Card render APIs (JSON/HTML/PDF)
apiV1.use('/id-cards', idCardsRoutes);
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

// Root route
app.get('/', (_req, res) => {
  res.send('Welcome to the API. Visit /api/v1/docs for documentation.');
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
