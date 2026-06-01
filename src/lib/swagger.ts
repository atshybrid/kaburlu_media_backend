
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
    description:
      'REST API for Kaburlu platform. Journalist Union: use tags "Journalist Union — Super Admin", "Tenant Admin", "Tenant Reporter", "Non-Tenant Reporter" (legacy union tags hidden). Login response includes unionMember with document URLs and approval status.',
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
    { name: 'Public', description: 'Public reader endpoints - Google Sign-in, push notifications subscribe/unsubscribe, ePaper public access' },
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
    { name: 'Smart Theme Management', description: 'Style1 homepage configuration with sections, categories, and ads - Complete layout management for modern news websites' },
    { name: 'Settings (Admin)', description: 'Domain settings, theme, layout, SEO, legal pages configuration (SUPER_ADMIN only)' },
    { name: 'Tenant Ads', description: 'Tenant-scoped website ads (CRUD) stored in TenantSettings.data.ads' },
    { name: 'Tenant Static Pages', description: 'Tenant-scoped static website pages like /about-us and /privacy-policy' },
    { name: 'Reporters', description: 'Reporter hierarchy & roles' },
    { name: 'TenantReporters', description: 'Tenant-scoped reporter management (admin/editor controls)' },
    { name: 'Reporter Payments', description: 'Annual subscription/payment tracking' },
    { name: 'Leaderboard', description: 'Reporter monthly leaderboard and performance rankings' },
    { name: 'Analytics', description: 'Tenant and reporter analytics with article counts and breakdowns' },
    { name: 'Article Listing & Filters', description: 'Role-based article listing APIs with advanced filters - Super Admin, Tenant Admin, Reporter endpoints for article management and monitoring' },
    { name: 'Article Quota Management', description: 'Reporter daily article quota system - Admin quota settings and reporter self-service quota checking' },
    { name: 'PRGI Verification', description: 'Submit, verify or reject tenant PRGI compliance' },
    { name: 'PRGI Newspaper', description: 'PRGI registered newspaper titles — public search; Super Admin create/update/CSV import' },
    { name: 'Public - Tenant', description: 'Public read endpoints filtered by domain (categories, articles)' },
    { name: 'Public - Website', description: 'Website-facing public APIs for theme, categories, articles, navigation, homepage, SEO' },
    { name: 'News Website API 2.0', description: 'Optimized News Website APIs - Best practice consolidated endpoints (config, articles, homepage, SEO)' },
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
    {
      name: 'ePaper Smart Design',
      description:
        'Edition-wise ePaper design CRUD — header/sub-header styles, logos, volume/issue auto-number, PRGI context. Use instead of legacy /epaper/design-config. Requires admin JWT + X-Tenant-Id.',
    },
    {
      name: 'ePaper News Blocks',
      description:
        'Newspaper block layout engine — render articles into BLOCK-04A (and future blocks) HTML/CSS, store in EpaperNewsBlock table.',
    },
    { name: 'ePaper - Newspaper Config', description: 'Tenant-level newspaper page count, per-page cost, volume/issue seeds (legacy tenant config)' },
    // Digital Daily Newspaper (Mobile App)
    { name: 'Digital Daily Newspaper', description: 'Mobile app ePaper APIs - Swipeable newspaper gallery, all-tenants view, and issue pages for Digital Daily Newspaper app' },
    // Admin & WhatsApp
    { name: 'Admin', description: 'Administrative operations - Tenant admin management, system configuration' },
    {
      name: 'WhatsApp',
      description:
        'WhatsApp Cloud API — create/request templates (Meta approval), sync APPROVED templates, send OTP/ID card/custom template messages. Webhook at POST /webhooks/whatsapp.',
    },
    // Tenant Subscription & Wallet System
    { name: 'Tenant Subscription - Wallet Management', description: 'Admin wallet operations - Top-up, bulk payments, adjustments, transaction history, and balance management' },
    { name: 'Tenant Subscription - Pricing Configuration', description: 'Admin pricing setup - Configure tenant-specific rates, minimum pages, discounts, and activation dates (effectiveFrom/effectiveUntil)' },
    { name: 'Tenant Subscription - Billing & Usage', description: 'Admin billing operations - Monthly charges, usage tracking, invoice generation, and account lock/unlock' },
    { name: 'Tenant Subscription - Self-Service', description: 'Tenant self-service - Check balance, view transactions, current usage, invoices, and request top-ups' },
    // Epaper Designer
    { name: 'Epaper Designer', description: 'Block-wise newspaper article data for the Epaper Designer tool – list articles as layout blocks, assign block templates, and browse the template palette' },
    // ── Journalist Union (2026) — use these tags; legacy union tags are hidden in Swagger UI ──
    {
      name: 'Journalist Union — Super Admin',
      description:
        'SUPER_ADMIN JWT required. Member list with survey + insurance status; pending approvals; create tenant/non-tenant members; assign accidental & health insurance; press cards; union admins; complaints; settings.',
    },
    {
      name: 'Journalist Union — Tenant Admin',
      description:
        'TENANT_ADMIN — create union member for own-tenant reporters only (mobile + unionName). Same POST /journalist/admin/members/create as Super Admin.',
    },
    {
      name: 'Journalist Union — Tenant Reporter',
      description:
        'REPORTER JWT — join union, download press ID when approved, reporter-link status. Login via POST /auth/login (role REPORTER).',
    },
    {
      name: 'Journalist Union — Non-Tenant Reporter',
      description:
        'NON_TENANT_REPORTER — public join-union, document uploads, login (mobile + last 4 digits MPIN). unionMember block on login with document URLs & status.',
    },
    {
      name: 'Journalist Union — Public',
      description: 'No auth — public join-union (non-tenant), reporter mobile lookup, directory, committee, union settings.',
    },
    {
      name: 'Journalist Union — Survey (Member)',
      description: 'Union member JWT — party surveys, YES/NO answers, video upload, insurance eligibility.',
    },
    {
      name: 'Journalist Union — Survey (Admin)',
      description: 'Union admin / Super Admin — campaign YES/NO stats (other campaign CRUD returns 501).',
    },
    {
      name: 'India Political Parties',
      description:
        'ECI registered parties (name, symbol). Public GET for apps. SUPER_ADMIN — list/create/update, set primary/secondary colors, symbol name, upload symbol PNG to CDN.',
    },
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
      /** Designer block – a NewspaperArticle formatted for the Epaper Designer layout tool */
      DesignerBlock: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'NewspaperArticle ID' },
          status: { type: 'string', description: 'Article status (DRAFT / APPROVED / PUBLISHED / REJECTED)' },
          isBreaking: { type: 'boolean' },
          priority: { type: 'integer', description: 'Layout priority (higher = more prominent placement)' },
          title: { type: 'string', nullable: true },
          subTitle: { type: 'string', nullable: true },
          heading: { type: 'string', nullable: true },
          dateline: { type: 'string', nullable: true, description: 'Dateline string (e.g. "VIJAYAWADA, Feb 22")' },
          points: { type: 'array', items: { type: 'string' }, description: 'Bullet-point summary lines' },
          lead: { type: 'string', nullable: true, description: 'Opening paragraph / lead-in text' },
          contentParagraphs: { type: 'array', items: { type: 'string' }, description: 'Structured content paragraphs for print layout' },
          content: { type: 'string', nullable: true, description: 'Full article body' },
          charCount: { type: 'integer', nullable: true, description: 'Stored character count for layout column calculations' },
          wordCount: { type: 'integer', nullable: true },
          featuredImageUrl: { type: 'string', nullable: true, format: 'uri' },
          media: {
            type: 'array',
            description: 'Media items derived from mediaUrls + mediaMeta/mediaCaptions.',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'uri' },
                caption: { type: 'string', nullable: true },
                alt: { type: 'string', nullable: true },
                afterParagraph: { type: 'integer', nullable: true }
              }
            }
          },
          category: {
            nullable: true,
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string', nullable: true }
            }
          },
          location: {
            type: 'object',
            properties: {
              stateId: { type: 'string', nullable: true },
              stateName: { type: 'string', nullable: true },
              districtId: { type: 'string', nullable: true },
              districtName: { type: 'string', nullable: true },
              mandalId: { type: 'string', nullable: true },
              mandalName: { type: 'string', nullable: true },
              villageId: { type: 'string', nullable: true },
              villageName: { type: 'string', nullable: true },
              placeName: { type: 'string', nullable: true }
            }
          },
          languageId: { type: 'string', nullable: true },
          languageName: { type: 'string', nullable: true },
          assignedBlockTemplateId: { type: 'string', nullable: true, description: 'ID of the currently assigned EpaperBlockTemplate' },
          assignedBlockTemplate: { nullable: true, '$ref': '#/components/schemas/EpaperBlockTemplateSummary' },
          suggestedBlockTemplateId: { type: 'string', nullable: true, description: 'AI-suggested block template ID' },
          suggestedBlockTemplate: { nullable: true, '$ref': '#/components/schemas/EpaperBlockTemplateSummary' },
          layoutSuggestion: { nullable: true, description: 'Any paragraph/layout suggestion object captured from editor/AI' },
          authorId: { type: 'string' },
          authorName: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      /** Slim block template descriptor embedded inside a DesignerBlock */
      EpaperBlockTemplateSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          code: { type: 'string', description: 'Unique short code (e.g. ARTICLE_3COL_FULL)' },
          name: { type: 'string' },
          category: { type: 'string', description: 'HEADER | ARTICLE | ADVERTISEMENT | FOOTER | DIVIDER | CUSTOM' },
          subCategory: { type: 'string' },
          columns: { type: 'integer', description: 'Column span (e.g. 2, 3, 4, 6, 12)' },
          widthInches: { type: 'number', format: 'float', description: 'Physical block width in inches' },
          minHeightInches: { type: 'number', format: 'float', nullable: true },
          maxHeightInches: { type: 'number', format: 'float' }
        }
      }
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

/** Legacy tags → hide (replaced by canonical paths under Journalist Union — * tags). */
const HIDDEN_JOURNALIST_UNION_TAGS = new Set([
  'Journalist Union - Public',
  'Journalist Union - Member',
  'Journalist President',
  'Union Members Survey',
]);

/** Legacy `- Admin` routes that use `requireSuperAdmin` (not union-scoped admin). */
const LEGACY_ADMIN_PATHS_SUPER_ADMIN = new Set([
  '/journalist/admin/generate-card',
  '/journalist/admin/cards/{profileId}',
  '/journalist/admin/cards/{profileId}/generate-pdf',
  '/journalist/admin/cards/renewal-due',
  '/journalist/admin/cards/{profileId}/renew',
  '/journalist/admin/complaints',
  '/journalist/admin/complaints/{id}',
  '/journalist/admin/updates',
  '/journalist/admin/updates/{id}',
  '/journalist/admin/posts/appoint',
  '/journalist/admin/posts/holders/{id}',
  '/journalist/admin/settings',
  '/journalist/admin/settings/state',
  '/journalist/admin/settings/upload',
  '/journalist/admin/settings/state/upload',
]);

const CANONICAL_UNION_TAGS = new Set([
  'Journalist Union — Super Admin',
  'Journalist Union — Tenant Admin',
  'Journalist Union — Tenant Reporter',
  'Journalist Union — Non-Tenant Reporter',
  'Journalist Union — Public',
  'Journalist Union — Survey (Member)',
  'Journalist Union — Survey (Admin)',
]);

const INDIA_POLITICAL_PARTIES_TAG = 'India Political Parties';

const JOURNALIST_UNION_TAG_ORDER = [
  'India Political Parties',
  'Journalist Union — Super Admin',
  'Journalist Union — Tenant Admin',
  'Journalist Union — Tenant Reporter',
  'Journalist Union — Non-Tenant Reporter',
  'Journalist Union — Public',
  'Journalist Union — Survey (Member)',
  'Journalist Union — Survey (Admin)',
];

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

function opKey(pathKey: string, method: string) {
  return `${method.toLowerCase()}:${pathKey}`;
}

function hasCanonicalTag(tags: string[]) {
  return tags.some((t) => CANONICAL_UNION_TAGS.has(t));
}

function migrateLegacyUnionTags(tags: string[], pathKey: string): string[] {
  const out = tags.map((t) => {
    if (t === 'Journalist Union - Super Admin') return 'Journalist Union — Super Admin';
    if (t === 'Journalist Union - Admin') {
      return LEGACY_ADMIN_PATHS_SUPER_ADMIN.has(pathKey)
        ? 'Journalist Union — Super Admin'
        : 'Journalist Union — Tenant Admin';
    }
    return t;
  });
  return [...new Set(out)];
}

function hideLegacyJournalistUnionOperations(spec: Record<string, unknown>): Record<string, unknown> {
  const paths = spec.paths as Record<string, Record<string, { tags?: string[] }>> | undefined;
  if (!paths) return spec;

  const canonicalOps = new Set<string>();
  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey];
    for (const method of Object.keys(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      const op = pathItem[method];
      if (!op || typeof op !== 'object' || !Array.isArray(op.tags)) continue;
      if (hasCanonicalTag(op.tags)) canonicalOps.add(opKey(pathKey, method));
    }
  }

  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey];
    for (const method of Object.keys(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      const op = pathItem[method];
      if (!op || typeof op !== 'object' || !Array.isArray(op.tags)) continue;
      const key = opKey(pathKey, method);

      if (op.tags.some((t) => HIDDEN_JOURNALIST_UNION_TAGS.has(t))) {
        if (canonicalOps.has(key)) {
          delete pathItem[method];
          continue;
        }
        delete pathItem[method];
        continue;
      }

      if (
        op.tags.some(
          (t) => t === 'Journalist Union - Super Admin' || t === 'Journalist Union - Admin',
        )
      ) {
        if (canonicalOps.has(key)) {
          delete pathItem[method];
          continue;
        }
        op.tags = migrateLegacyUnionTags(op.tags, pathKey);
      }
    }
    const hasOp = Object.keys(pathItem).some((k) => HTTP_METHODS.has(k.toLowerCase()));
    if (!hasOp) delete paths[pathKey];
  }

  if (Array.isArray(spec.tags)) {
    const orderMap = new Map(JOURNALIST_UNION_TAG_ORDER.map((n, i) => [n, i]));
    (spec.tags as { name: string }[]).sort((a, b) => {
      const ai = orderMap.has(a.name) ? orderMap.get(a.name)! : 999;
      const bi = orderMap.has(b.name) ? orderMap.get(b.name)! : 999;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
  }

  return spec;
}

const rawSwaggerSpec = swaggerJSDoc(options) as Record<string, unknown>;
const swaggerSpec = hideLegacyJournalistUnionOperations(rawSwaggerSpec);

export default swaggerSpec;
export { JOURNALIST_UNION_TAG_ORDER, HIDDEN_JOURNALIST_UNION_TAGS, INDIA_POLITICAL_PARTIES_TAG };
