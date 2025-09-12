// src/app.ts
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
import likesRoutes from './api/likes/likes.routes';
import commentsRoutes from './api/comments/comments.routes';
import locationsRoutes from './api/locations/locations.routes';
import translateRoutes from './api/translate/translate.routes';
import profileRoutes from './api/profiles/profiles.routes';
import shortNewsRoutes from './api/shortnews/shortnews.routes';

const app = express();

/**
 * CORS configuration
 *
 * - You can set CORS_ORIGINS as a comma-separated list of allowed origins.
 *   Example: CORS_ORIGINS="https://app.kaburlumedia.com,http://localhost:3000"
 *
 * - Or set CORS_ALLOW_ALL=true to allow all origins (only for dev/testing).
 */
const defaultWhitelist = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://app.kaburlumedia.com'
];

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
  allowedHeaders: 'Content-Type, Authorization'
};

// Middlewares
app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport JWT strategy
app.use(passport.initialize());
try {
  jwtStrategy(passport);
} catch (e) {
  console.error('Failed to initialize JWT strategy:', e);
}

// Swagger UI
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/v1/articles', articlesRoutes);
app.use('/api/v1/shortnews', shortNewsRoutes);
app.use('/api/v1/likes', likesRoutes);
app.use('/api/v1/comments', commentsRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/languages', languagesRoutes);
app.use('/api/v1/states', statesRoutes);
app.use('/api/v1/roles', rolesRoutes);
app.use('/api/v1/permissions', permissionsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth', otpRoutes);
app.use('/api/v1/locations', locationsRoutes);
app.use('/api/v1/translate', translateRoutes);
app.use('/api/v1/profiles', profileRoutes);

// Protected sample route
app.get(
  '/api/v1/protected',
  passport.authenticate('jwt', { session: false }),
  (_req, res) => {
    res.json({ message: 'You are authorized to see this message' });
  }
);

// Root route
app.get('/', (_req, res) => {
  res.send('Welcome to the API. Visit /api/docs for documentation.');
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
    error: err && err.message ? err.message : 'Internal Server Error'
  });
});

export default app;
