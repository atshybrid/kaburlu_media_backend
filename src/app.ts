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
import articleReadRoutes from './api/articles/articleRead.routes';
import likesRoutes from './api/likes/likes.routes'; // deprecated (use reactions)
import reactionsRoutes from './api/reactions/reactions.routes';
import commentsRoutes from './api/comments/comments.routes';
import locationsRoutes from './api/locations/locations.routes';
import translateRoutes from './api/translate/translate.routes';
import profileRoutes from './api/profiles/profiles.routes';
import shortNewsRoutes from './api/shortnews/shortnews.routes';
import mediaRoutes from './api/media/media.routes';
import devicesRoutes from './api/devices/devices.routes';
import notificationsRoutes from './api/notifications/notifications.routes';
import promptsRoutes from './api/prompts/prompts.routes';
import { Router } from 'express';

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
  'https://ai-kaburlu-backend.onrender.com',
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
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Also expose docs under the versioned base for convenience
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes (no version prefix) - legacy support
app.use('/articles', articlesRoutes);
app.use('/articles/read', articleReadRoutes);
app.use('/shortnews', shortNewsRoutes);
app.use('/likes', likesRoutes); // deprecated
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
app.use('/translate', translateRoutes);
app.use('/profiles', profileRoutes);
app.use('/media', mediaRoutes);
app.use('/devices', devicesRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/prompts', promptsRoutes);

// API Routes mounted under /api/v1 (preferred)
const apiV1: Router = Router();
apiV1.use('/articles', articlesRoutes);
apiV1.use('/articles/read', articleReadRoutes);
apiV1.use('/shortnews', shortNewsRoutes);
apiV1.use('/likes', likesRoutes); // deprecated
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
apiV1.use('/translate', translateRoutes);
apiV1.use('/profiles', profileRoutes);
apiV1.use('/media', mediaRoutes);
apiV1.use('/devices', devicesRoutes);
apiV1.use('/notifications', notificationsRoutes);
apiV1.use('/prompts', promptsRoutes);
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
    error: err && err.message ? err.message : 'Internal Server Error'
  });
});

export default app;
