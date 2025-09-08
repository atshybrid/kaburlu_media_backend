
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

const app = express();

const whitelist = [
    'http://localhost:3000',
    'http://localhost:8080',
    'https://3000-firebase-khabarxbackend-1757330578765.cluster-6dx7corvpngoivimwvvljgokdw.cloudworkstations.dev',
    'https://app.kaburlumedia.com'
];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.error(`Origin not allowed by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  allowedHeaders: 'Content-Type, Authorization',
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
jwtStrategy(passport);

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/articles', articlesRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/languages', languagesRoutes);
app.use('/api/states', statesRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth', otpRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/profiles', profileRoutes);

app.get('/api/protected', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({ message: 'You are authorized to see this message' });
});

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the API. Visit /api/docs for documentation.');
});

export default app;
