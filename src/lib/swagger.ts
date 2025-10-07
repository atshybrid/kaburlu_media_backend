
import swaggerJSDoc from 'swagger-jsdoc';
import { userSwagger } from '../api/users/users.swagger';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Kaburlu News Platform API',
    version: '1.0.0',
    description: 'REST API for Kaburlu platform, covering Superadmin, Language Admin, News Desk, Citizen Reporter, Categories & Category Translations.'
  },
  servers: [
    {
      url: 'http://localhost:3001/api/v1',
      description: 'Local server'
    },
    {
      url: 'https://kaburlu-media-backend.onrender.com/api/v1',
      description: 'Render server'
    },
    {
      url: 'https://app.kaburlumedia.com/api/v1',
      description: 'Production server'
    }
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'ShortNews' },
    { name: 'ShortNews Options' },
    { name: 'Locations' },
    { name: 'Categories' },
    { name: 'Languages' },
    { name: 'Roles' },
    { name: 'States' },
    { name: 'Translate' },
    { name: 'Media' },
    { name: 'Prompts' },
    { name: 'Engagement - Comments' },
    { name: 'KaChat - Interests', description: 'Follow / mute user interests for filtering realtime feed' },
    { name: 'KaChat - Membership', description: 'Family and direct chat room management & sync' },
    { name: 'KaChat - Messaging', description: 'Message send & history (Firestore bridge)' },
    { name: 'KaChat - Crypto', description: 'End-to-end encryption key management (public key distribution)' },
    { name: 'KaChat - Auth', description: 'Chat-specific authentication helpers (Firebase custom token)' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      // ...existing code for schemas...
    }
  },

  security: [
    {
      bearerAuth: []
    }
  ]
};

const options = {
  swaggerDefinition,
  apis: ['./src/api/**/*.ts']
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
