import { Router } from 'express';
import prisma from '../../lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router();

function normalizeHost(raw?: string | string[]): string | null {
  if (!raw) return null;
  const host = Array.isArray(raw) ? raw[0] : raw;
  if (!host) return null;
  return host.toLowerCase().replace(/:\d+$/, '');
}

function asObject(value: any): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as any;
  return {};
}

async function resolveActiveDomain(req: any) {
  if (process.env.MULTI_TENANCY !== 'true') return null;

  const overrideHost = normalizeHost(req.headers['x-tenant-domain'] as any) || normalizeHost(req.query?.domain);
  const host = overrideHost || normalizeHost(req.headers['x-forwarded-host'] || req.headers.host);
  if (!host) return { error: { code: 'HOST_HEADER_REQUIRED', message: 'Host header missing for domain resolution' } };

  const domain = await p.domain.findUnique({ where: { domain: host }, include: { tenant: true } }).catch(() => null);
  if (!domain || domain.status !== 'ACTIVE') {
    return { error: { code: 'DOMAIN_NOT_FOUND_OR_INACTIVE', message: 'Domain not active or unknown' } };
  }

  if (String(domain.kind || '').toUpperCase() !== 'EPAPER') {
    return { error: { code: 'EPAPER_DOMAIN_KIND_REQUIRED', message: 'Domain is not configured as an EPAPER domain.' } };
  }

  if (!domain.verifiedAt) {
    return { error: { code: 'EPAPER_DOMAIN_NOT_VERIFIED', message: 'EPAPER domain is not verified yet (verifiedAt is missing).' } };
  }

  return { domain, tenant: domain.tenant };
}

function buildDefaultRobotsTxt(baseUrl: string): string {
  return [
    'User-agent: *',
    'Disallow: /api',
    'Disallow: /api/v1',
    'Disallow: /public',
    // Admin APIs live under /epaper on this backend
    'Disallow: /epaper',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * @swagger
 * /robots.txt:
 *   get:
 *     summary: robots.txt for EPAPER domain
 *     description: |
 *       Served only when request host resolves to a verified EPAPER domain.
 *
 *       Domain resolution:
 *       - Production: uses `Host` / `X-Forwarded-Host`
 *       - Local testing: you can use `X-Tenant-Domain` header or `?domain=` query
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - $ref: '#/components/parameters/DomainQuery'
 *     responses:
 *       200:
 *         description: robots.txt content
 *         content:
 *           text/plain:
 *             examples:
 *               sample:
 *                 value: |
 *                   User-agent: *
 *                   Disallow: /api
 *                   Disallow: /api/v1
 *                   Disallow: /public
 *                   Disallow: /epaper
 *                   Sitemap: https://epaper.kaburlu.com/sitemap.xml
 *       404:
 *         description: Not an EPAPER domain (or not verified)
 */
router.get('/robots.txt', async (req, res) => {
  const resolved = await resolveActiveDomain(req);
  if (!resolved || (resolved as any).error) {
    return res.status(404).type('text/plain').send('Not Found');
  }

  const { domain, tenant } = resolved as any;
  const baseUrl = `https://${domain.domain}`;

  const [tenantTheme, domainSettings] = await Promise.all([
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
    p.domainSettings?.findUnique?.({ where: { domainId: domain.id } }).catch(() => null),
  ]);

  const ds = asObject(domainSettings?.data);
  const seoConfig = asObject(tenantTheme?.seoConfig);

  const robotsOverride = typeof ds.robotsTxt === 'string' ? ds.robotsTxt : typeof seoConfig.robotsTxt === 'string' ? seoConfig.robotsTxt : null;
  const robots = robotsOverride || buildDefaultRobotsTxt(baseUrl);

  return res.type('text/plain').send(robots);
});

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function toIsoDate(d: Date): string {
  return d.toISOString();
}

function parseSitemapRoutesFromEnv(): string[] | null {
  const raw = process.env.EPAPER_SITEMAP_ROUTES_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const routes = parsed.map((x: any) => String(x)).filter(Boolean);
    return routes.length ? routes : null;
  } catch {
    return null;
  }
}

function getDefaultEpaperSitemapRoutes(): string[] {
  return ['/', '/epaper/{editionSlug}', '/epaper/{editionSlug}/{subEditionSlug}'];
}

/**
 * @swagger
 * /sitemap.xml:
 *   get:
 *     summary: sitemap.xml for EPAPER domain
 *     description: |
 *       Served only when request host resolves to a verified EPAPER domain.
 *
 *       Domain resolution:
 *       - Production: uses `Host` / `X-Forwarded-Host`
 *       - Local testing: you can use `X-Tenant-Domain` header or `?domain=` query
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - $ref: '#/components/parameters/DomainQuery'
 *     responses:
 *       200:
 *         description: sitemap.xml content
 *         content:
 *           application/xml:
 *             examples:
 *               sample:
 *                 value: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"><url><loc>https://epaper.kaburlu.com/</loc></url></urlset>"
 *       404:
 *         description: Not an EPAPER domain (or sitemap disabled/not verified)
 */
router.get('/sitemap.xml', async (req, res) => {
  const resolved = await resolveActiveDomain(req);
  if (!resolved || (resolved as any).error) {
    return res.status(404).type('text/plain').send('Not Found');
  }

  const { domain, tenant } = resolved as any;
  const baseUrl = `https://${domain.domain}`;

  const [tenantTheme, domainSettings] = await Promise.all([
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
    p.domainSettings?.findUnique?.({ where: { domainId: domain.id } }).catch(() => null),
  ]);

  const ds = asObject(domainSettings?.data);
  const seoConfig = asObject(tenantTheme?.seoConfig);

  const sitemapEnabled = ds.sitemapEnabled === undefined ? (seoConfig.sitemapEnabled === undefined ? true : Boolean(seoConfig.sitemapEnabled)) : Boolean(ds.sitemapEnabled);
  if (!sitemapEnabled) {
    return res.status(404).type('text/plain').send('Not Found');
  }

  // Configurable route templates (first match wins):
  // 1) DomainSettings.data.epaperSeo.sitemap.routes
  // 2) EPAPER_SITEMAP_ROUTES_JSON env (JSON array of strings)
  // 3) defaults matching current frontend routes
  // Tokens supported: {editionSlug} {subEditionSlug} {issueDate}
  const epaperSeo = asObject(ds.epaperSeo);
  const sitemapCfg = asObject(epaperSeo.sitemap);

  const routesFromDb: string[] | null = Array.isArray(sitemapCfg.routes)
    ? sitemapCfg.routes.map((x: any) => String(x)).filter(Boolean)
    : null;

  const routesFromEnv = parseSitemapRoutesFromEnv();
  const routes = (routesFromDb && routesFromDb.length ? routesFromDb : routesFromEnv) || getDefaultEpaperSitemapRoutes();

  const includeLatestIssueDate = routes.some(r => r.includes('{issueDate}'));

  const editions = await p.epaperPublicationEdition.findMany({
    where: { tenantId: tenant.id, isDeleted: false, isActive: true },
    include: {
      subEditions: { where: { tenantId: tenant.id, isDeleted: false, isActive: true }, select: { slug: true } },
    },
    select: { slug: true, subEditions: true },
  });

  // Preload latest issue per target if needed.
  const latestByEditionSlug = new Map<string, string>();
  const latestBySubEditionKey = new Map<string, string>();

  if (includeLatestIssueDate) {
    const latestEditionIssues = await p.epaperPdfIssue.findMany({
      where: { tenantId: tenant.id, editionId: { not: null }, subEditionId: null },
      orderBy: [{ issueDate: 'desc' }],
      distinct: ['editionId'],
      include: { edition: { select: { slug: true } } },
    });
    for (const it of latestEditionIssues) {
      if (it.edition?.slug && it.issueDate) latestByEditionSlug.set(String(it.edition.slug), String(it.issueDate.toISOString().slice(0, 10)));
    }

    const latestSubIssues = await p.epaperPdfIssue.findMany({
      where: { tenantId: tenant.id, subEditionId: { not: null }, editionId: null },
      orderBy: [{ issueDate: 'desc' }],
      distinct: ['subEditionId'],
      include: { subEdition: { select: { slug: true, edition: { select: { slug: true } } } } },
    });
    for (const it of latestSubIssues) {
      const edSlug = it.subEdition?.edition?.slug;
      const subSlug = it.subEdition?.slug;
      if (edSlug && subSlug && it.issueDate) {
        latestBySubEditionKey.set(`${edSlug}/${subSlug}`, String(it.issueDate.toISOString().slice(0, 10)));
      }
    }
  }

  const urls: Array<{ loc: string; lastmod?: string }> = [];
  const seen = new Set<string>();
  const pushUrl = (path: string, lastmod?: string) => {
    const full = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    if (seen.has(full)) return;
    seen.add(full);
    urls.push({ loc: full, lastmod });
  };

  const isStaticRoute = (tpl: string) => !tpl.includes('{editionSlug}') && !tpl.includes('{subEditionSlug}') && !tpl.includes('{issueDate}');

  // Always include base homepage
  pushUrl('/');

  // Add static routes once (ex: '/')
  for (const tpl of routes) {
    if (!isStaticRoute(tpl)) continue;
    pushUrl(tpl);
  }

  for (const ed of editions) {
    const edSlug = String(ed.slug);
    const latestEdDate = latestByEditionSlug.get(edSlug);

    for (const tpl of routes) {
      if (isStaticRoute(tpl)) continue;
      if (tpl.includes('{subEditionSlug}')) continue;
      if (!tpl.includes('{editionSlug}')) continue;

      let path = tpl.replace('{editionSlug}', edSlug);
      if (path.includes('{issueDate}')) {
        if (!latestEdDate) continue;
        path = path.replace('{issueDate}', latestEdDate);
        pushUrl(path, latestEdDate ? `${latestEdDate}T00:00:00.000Z` : undefined);
      } else {
        pushUrl(path, latestEdDate ? `${latestEdDate}T00:00:00.000Z` : undefined);
      }
    }

    for (const sub of ed.subEditions || []) {
      const subSlug = String(sub.slug);
      const latestSubDate = latestBySubEditionKey.get(`${edSlug}/${subSlug}`);

      for (const tpl of routes) {
        if (isStaticRoute(tpl)) continue;
        if (!tpl.includes('{subEditionSlug}')) continue;
        if (!tpl.includes('{editionSlug}')) continue;

        let path = tpl.replace('{editionSlug}', edSlug).replace('{subEditionSlug}', subSlug);
        if (path.includes('{issueDate}')) {
          if (!latestSubDate) continue;
          path = path.replace('{issueDate}', latestSubDate);
          pushUrl(path, latestSubDate ? `${latestSubDate}T00:00:00.000Z` : undefined);
        } else {
          pushUrl(path, latestSubDate ? `${latestSubDate}T00:00:00.000Z` : undefined);
        }
      }
    }
  }

  const nowIso = toIsoDate(new Date());
  const body = urls
    .map(u => {
      const lastmod = u.lastmod || nowIso;
      return `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${xmlEscape(lastmod)}</lastmod></url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  return res.type('application/xml').send(xml);
});

export default router;
