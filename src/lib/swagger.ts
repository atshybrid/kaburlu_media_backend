
import swaggerJSDoc from 'swagger-jsdoc';
import { userSwagger } from '../api/users/users.swagger';

function toPosixPath(p: string) {
  return p.replace(/\\/g, '/');
}

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Kaburlu News Platform API',
    version: '1.0.0',
    description: 'REST API for Kaburlu platform. Note: Core roles and minimal seed bootstrap run automatically on server start to recover from empty databases.'
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
    { name: 'AI', description: 'AI utility endpoints (test, headline generation, etc.)' },
    { name: 'AI Rewrite', description: 'AI rewrite controls, usage metering, and billing limits' },
    { name: 'Location AI', description: 'AI helper endpoints for location translations (DB is source-of-truth)' },
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
    { name: 'Tenant Ads', description: 'Tenant-scoped website ads (CRUD) stored in TenantSettings.data.ads' },
    { name: 'Tenant Static Pages', description: 'Tenant-scoped static website pages like /about-us and /privacy-policy' },
    { name: 'Reporters', description: 'Reporter hierarchy & roles' },
    { name: 'TenantReporters', description: 'Tenant-scoped reporter management (admin/editor controls)' },
    { name: 'Reporter Payments', description: 'Annual subscription/payment tracking' },
    { name: 'PRGI Verification', description: 'Submit, verify or reject tenant PRGI compliance' },
    { name: 'Public - Tenant', description: 'Public read endpoints filtered by domain (categories, articles)' },
    { name: 'Public - Website', description: 'Website-facing public APIs for theme, categories, articles, navigation, homepage, SEO' },
    { name: 'Public - Reporter Join', description: 'Public endpoints to check reporter slot availability & initiate onboarding payments' },
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
    parameters: {
      XTenantDomain: {
        name: 'X-Tenant-Domain',
        in: 'header',
        required: false,
        description: 'Optional override for tenant/domain detection when testing locally. In production, tenant/domain is inferred from Host / X-Forwarded-Host.',
        schema: { type: 'string', example: 'epaper.kaburlu.com' }
      },
      DomainQuery: {
        name: 'domain',
        in: 'query',
        required: false,
        description: 'Optional override for domain detection when testing locally (alternative to X-Tenant-Domain).',
        schema: { type: 'string', example: 'epaper.kaburlu.com' }
      }
    },
    responses: {
      EpaperDomainNotVerified: {
        description: 'Domain not verified / not EPAPER / not resolved',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' }
              }
            },
            examples: {
              notVerified: {
                value: {
                  code: 'EPAPER_DOMAIN_NOT_VERIFIED',
                  message: 'ePaper domain not verified/active or not resolved.'
                }
              },
              kindRequired: {
                value: {
                  code: 'EPAPER_DOMAIN_KIND_REQUIRED',
                  message: 'Domain is not configured as an EPAPER domain.'
                }
              }
            }
          }
        }
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
  // Important: swagger-jsdoc needs to be able to find the annotated files.
  // - In dev: we run from TS source under src/
  // - In prod/build: we run compiled JS under dist/
  apis: (() => {
    const here = toPosixPath(__dirname);
    const isDistRuntime = here.includes('/dist/');
    if (isDistRuntime) {
      return [
        './dist/api/**/*.js',
        `${toPosixPath(process.cwd())}/dist/api/**/*.js`
      ];
    }
    return [
      './src/api/**/*.ts',
      './src/api/**/*.js',
      // Also include absolute globs to be resilient to different working directories
      `${toPosixPath(process.cwd())}/src/api/**/*.ts`,
      `${toPosixPath(process.cwd())}/src/api/**/*.js`
    ];
  })()
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
