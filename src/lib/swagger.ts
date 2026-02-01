
import swaggerJSDoc from 'swagger-jsdoc';
import { userSwagger } from '../api/users/users.swagger';

/**
 * ⚠️ IMPORTANT: Swagger Spec Generation
 * 
 * The Swagger spec is generated ONCE at application startup when this module is imported.
 * Any changes to API routes, JSDoc comments, or Swagger annotations require a full process restart.
 * 
 * Production deployment MUST include: pm2 restart kaburlu-api
 * Never use: pm2 reload (keeps old process in memory)
 */

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
      url: 'https://api.kaburlumedia.com/api/v1',
      description: 'Production server (DigitalOcean)'
    },
    {
      url: 'https://app.kaburlumedia.com/api/v1',
      description: 'Production server (App)'
    },
    {
      url: 'https://kaburlu-media-backend.onrender.com/api/v1',
      description: 'Render server'
    },
    {
      url: 'http://localhost:3001/api/v1',
      description: 'Local development'
    }
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Articles', description: 'Legacy article CRUD endpoints - Read, update, and delete articles' },
    { name: 'News Room', description: 'Unified article creation and reporter article management - Create 3-in-1 articles (Newspaper, Web, ShortNews) with AI support' },
    { name: 'Dashboard', description: 'Tenant admin and reporter dashboard endpoints - Statistics, top news, activity feed' },
    { name: 'AI', description: 'AI utility endpoints (test, headline generation, etc.)' },
    { name: 'AI Rewrite', description: 'AI rewrite controls, usage metering, and billing limits' },
    { name: 'Location AI', description: 'AI-powered location data generation and translation - Generate complete state hierarchies (districts→mandals→villages) in multiple Indian languages using ChatGPT' },
    { name: 'Location', description: 'Location data status monitoring and retry APIs - Check population progress and retry failed districts/mandals' },
    { name: 'ShortNews', description: 'Short news CRUD endpoints - Quick news snippets with location and metadata' },
    { name: 'ShortNews Options', description: 'Short news dropdown options - Categories, statuses, and configuration' },
    { name: 'Reactions' },
    { name: 'Comments' },
    { name: 'Engagement', description: 'User engagement tracking - Reactions, comments, reads, and interactions' },
    { name: 'Engagement - Read Tracking', description: 'Article and ShortNews read progress tracking with time spent and scroll depth' },
    { name: 'Engagement - Comments', description: 'Article comments CRUD - Create, edit, delete, and moderate comments' },
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
    { name: 'Settings (Admin)', description: 'Domain settings, theme, layout, SEO, legal pages configuration (SUPER_ADMIN only)' },
    { name: 'Tenant Ads', description: 'Tenant-scoped website ads (CRUD) stored in TenantSettings.data.ads' },
    { name: 'Tenant Static Pages', description: 'Tenant-scoped static website pages like /about-us and /privacy-policy' },
    { name: 'Reporters', description: 'Reporter hierarchy & roles' },
    { name: 'TenantReporters', description: 'Tenant-scoped reporter management (admin/editor controls)' },
    { name: 'Reporter Payments', description: 'Annual subscription/payment tracking' },
    { name: 'Leaderboard', description: 'Reporter monthly leaderboard and performance rankings' },
    { name: 'Analytics', description: 'Tenant and reporter analytics with article counts and breakdowns' },
    { name: 'PRGI Verification', description: 'Submit, verify or reject tenant PRGI compliance' },
    { name: 'Public - Tenant', description: 'Public read endpoints filtered by domain (categories, articles)' },
    { name: 'Public - Website', description: 'Website-facing public APIs for theme, categories, articles, navigation, homepage, SEO' },
    { name: 'Public - Reporter Join', description: 'Public endpoints to check reporter slot availability & initiate onboarding payments' },
    { name: 'Webhooks' },
    { name: 'Health', description: 'System and provider readiness checks' },
    // ePaper Module tags
    { name: 'ePaper Domain Settings - Admin', description: 'ePaper domain configuration and settings management (SUPER_ADMIN & DESK_EDITOR)' },
    { name: 'EPF ePaper - Admin', description: 'ePaper editions and sub-editions management (SUPER_ADMIN & DESK_EDITOR)' },
    { name: 'EPF ePaper PDF Issues - Admin', description: 'PDF-based ePaper issue upload and management - Upload PDFs, manage issues by date/edition (SUPER_ADMIN & DESK_EDITOR)' },
    { name: 'EPF ePaper Clips - Admin', description: 'Article clip management for PDF issues - Create, update, delete article regions with coordinates (SUPER_ADMIN & DESK_EDITOR)' },
    { name: 'EPF ePaper - Public', description: 'Public ePaper endpoints - Latest issues, editions list, and PDF page delivery' },
    { name: 'Block ePaper - Admin', description: 'Block-based ePaper templates and layout generation (Admin only)' },
    // Digital Daily Newspaper (Mobile App)
    { name: 'Digital Daily Newspaper', description: 'Mobile app ePaper APIs - Swipeable newspaper gallery, all-tenants view, and issue pages for Digital Daily Newspaper app' },
    // Admin & WhatsApp
    { name: 'Admin', description: 'Administrative operations - Tenant admin management, system configuration' },
    { name: 'WhatsApp Templates', description: 'WhatsApp Business API template management - Sync, list, and manage message templates' }
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
        description: 'Optional override for tenant/domain detection when testing locally. In production, tenant/domain is inferred from Host / X-Forwarded-Host. Avoid leading/trailing spaces (e.g., %20) in header values.',
        schema: { type: 'string', example: 'epaper.kaburlu.com' }
      },
      DomainQuery: {
        name: 'domain',
        in: 'query',
        required: false,
        description: 'Optional override for domain detection when testing locally (alternative to X-Tenant-Domain). Avoid leading/trailing spaces (e.g., %20) in query values.',
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
