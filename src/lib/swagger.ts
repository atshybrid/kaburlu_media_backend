
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
    { name: 'Articles' },
    { name: 'ShortNews' },
    { name: 'ShortNews Options' },
    { name: 'Reactions' },
    { name: 'Comments' },
    { name: 'Categories' },
    { name: 'Languages' },
    { name: 'States' },
    { name: 'Districts' },
    { name: 'Mandals' },
    { name: 'Assembly Constituencies' },
    { name: 'Locations' },
    { name: 'Media' },
    { name: 'Profiles' },
    { name: 'Preferences' },
    { name: 'Notifications' },
    { name: 'Devices' },
    { name: 'Translate' },
    { name: 'Prompts' },
    { name: 'Castes' },
    { name: 'Kin Relations' },
    { name: 'Countries' },
    { name: 'ID Cards' },
    // Multi-tenant & Reporter tags
    { name: 'Tenants', description: 'Tenant CRUD & PRGI fields' },
    { name: 'Domains', description: 'Domain verification & status management' },
    { name: 'Tenant Theme', description: 'Branding assets & colors per tenant' },
    { name: 'Reporters', description: 'Reporter hierarchy & roles' },
    { name: 'Reporter Payments', description: 'Annual subscription/payment tracking' },
    { name: 'PRGI Verification', description: 'Submit, verify or reject tenant PRGI compliance' },
    { name: 'Public - Tenant', description: 'Public read endpoints filtered by domain (categories, articles)' },
    { name: 'Public - Website', description: 'Website-facing public APIs for theme, categories, articles, navigation, homepage, SEO' },
    { name: 'Webhooks' }
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
