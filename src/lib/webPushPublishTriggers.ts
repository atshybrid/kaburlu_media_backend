import prisma from './prisma';
import { sendBrowserPushToDomain } from './webPushBrowser';

function trimOrEmpty(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toDateKey(value: Date | string): string {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

function toShortDateLabel(value: Date | string): string {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return toDateKey(value);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function truncateText(value: string, max = 120): string {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
}

async function resolveArticleDomain(params: {
  tenantId: string;
  domainId?: string | null;
}): Promise<{ id: string; domain: string } | null> {
  if (params.domainId) {
    const exact = await (prisma as any).domain.findFirst({
      where: {
        id: params.domainId,
        tenantId: params.tenantId,
        kind: 'NEWS',
        status: 'ACTIVE',
      },
      select: { id: true, domain: true },
    });
    if (exact) return exact;
  }

  const primary = await (prisma as any).domain.findFirst({
    where: {
      tenantId: params.tenantId,
      kind: 'NEWS',
      status: 'ACTIVE',
      isPrimary: true,
    },
    select: { id: true, domain: true },
  });
  if (primary) return primary;

  return (prisma as any).domain.findFirst({
    where: {
      tenantId: params.tenantId,
      kind: 'NEWS',
      status: 'ACTIVE',
    },
    select: { id: true, domain: true },
    orderBy: [{ updatedAt: 'desc' }],
  });
}

export async function triggerPublishedArticleWebPush(params: {
  tenantId: string;
  articleId: string;
  title: string;
  slug?: string | null;
  domainId?: string | null;
  categorySlug?: string | null;
  coverImageUrl?: string | null;
  isBreaking?: boolean;
}) {
  const domain = await resolveArticleDomain({
    tenantId: params.tenantId,
    domainId: params.domainId,
  });

  if (!domain) {
    return { skipped: true, reason: 'NO_ACTIVE_NEWS_DOMAIN' };
  }

  const slug = trimOrEmpty(params.slug);
  const categorySlug = trimOrEmpty(params.categorySlug);
  const articlePath = slug
    ? (categorySlug ? `/${categorySlug}/${slug}` : `/${slug}`)
    : '/';

  return sendBrowserPushToDomain({
    tenantId: params.tenantId,
    domainId: domain.id,
    payload: {
      title: params.isBreaking ? 'Breaking News' : 'New Article Published',
      body: truncateText(params.title || 'A new article is now live.'),
      url: `https://${domain.domain}${articlePath}`,
      icon: trimOrEmpty(params.coverImageUrl) || undefined,
      data: {
        type: 'article_published',
        articleId: params.articleId,
        slug: slug || undefined,
        tenantId: params.tenantId,
        domainId: domain.id,
        isBreaking: Boolean(params.isBreaking),
      },
    },
  });
}

export async function triggerPublishedEpaperWebPush(params: {
  tenantId: string;
  issueId: string;
  issueDate: Date | string;
  editionSlug?: string | null;
  subEditionSlug?: string | null;
  editionName?: string | null;
  subEditionName?: string | null;
  coverImageUrl?: string | null;
}) {
  const domains: Array<{ id: string; domain: string }> = await (prisma as any).domain.findMany({
    where: {
      tenantId: params.tenantId,
      kind: 'EPAPER',
      status: 'ACTIVE',
      verifiedAt: { not: null },
    },
    select: { id: true, domain: true },
  });

  if (!domains.length) {
    return { skipped: true, reason: 'NO_ACTIVE_EPAPER_DOMAIN' };
  }

  const issueDateKey = toDateKey(params.issueDate);
  const issueDateLabel = toShortDateLabel(params.issueDate);
  const editionSlug = trimOrEmpty(params.editionSlug);
  const subEditionSlug = trimOrEmpty(params.subEditionSlug);
  const editionName = trimOrEmpty(params.editionName);
  const subEditionName = trimOrEmpty(params.subEditionName);

  const targetLabel = subEditionName
    ? `${subEditionName}${editionName ? ` - ${editionName}` : ''}`
    : (editionName || 'Today\'s');

  const results = await Promise.allSettled(
    domains.map((domain) => {
      const path = editionSlug
        ? (subEditionSlug
          ? `/epaper/${editionSlug}/${subEditionSlug}/${issueDateKey}/1`
          : `/epaper/${editionSlug}/${issueDateKey}/1`)
        : '/epaper';

      return sendBrowserPushToDomain({
        tenantId: params.tenantId,
        domainId: domain.id,
        payload: {
          title: 'ePaper Published',
          body: `${targetLabel} ePaper for ${issueDateLabel} is now live.`,
          url: `https://${domain.domain}${path}`,
          icon: trimOrEmpty(params.coverImageUrl) || undefined,
          data: {
            type: 'epaper_published',
            issueId: params.issueId,
            issueDate: issueDateKey,
            editionSlug: editionSlug || undefined,
            subEditionSlug: subEditionSlug || undefined,
            tenantId: params.tenantId,
            domainId: domain.id,
          },
        },
      });
    })
  );

  return {
    totalDomains: domains.length,
    sentDomains: results.filter((r) => r.status === 'fulfilled').length,
    failedDomains: results.filter((r) => r.status === 'rejected').length,
  };
}
