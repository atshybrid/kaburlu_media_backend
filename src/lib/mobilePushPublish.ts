import { sendSmartPush, resolveAuthorAudience, SmartPushAudience } from './smartPush';
import type { PushPayload, PushResult } from './push';

export async function triggerPublishedArticleMobilePush(params: {
  tenantId: string;
  articleId: string;
  title: string;
  authorId?: string | null;
  languageId?: string | null;
  coverImageUrl?: string | null;
  isBreaking?: boolean;
  stateId?: string | null;
  districtId?: string | null;
  mandalId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<PushResult & { targeted?: number; skipped?: number }> {
  let audience: SmartPushAudience = {
    tenantId: params.tenantId,
    languageId: params.languageId || undefined,
    stateId: params.stateId,
    districtId: params.districtId,
    mandalId: params.mandalId,
    latitude: params.latitude,
    longitude: params.longitude,
    isBreaking: params.isBreaking,
    priority: params.isBreaking ? 'breaking' : 'normal',
  };

  if (params.authorId) {
    const fromAuthor = await resolveAuthorAudience(params.authorId, params.tenantId);
    audience = { ...fromAuthor, ...audience, languageId: params.languageId || fromAuthor.languageId };
  }

  const payload: PushPayload = {
    title: params.isBreaking ? '🔴 బ్రేకింగ్ న్యూస్' : '📰 కొత్త వార్త',
    body: truncate(params.title, 100),
    image: params.coverImageUrl || undefined,
    color: params.isBreaking ? '#FF0000' : '#1565C0',
    data: {
      type: params.isBreaking ? 'breaking_news' : 'article_published',
      articleId: params.articleId,
      action: 'view',
    },
  };

  return sendSmartPush(audience, payload, {
    dedupeKey: `article:${params.articleId}`,
    minScore: params.isBreaking ? 40 : 55,
  });
}

export async function triggerShortNewsMobilePush(params: {
  shortNewsId: string;
  title: string;
  body: string;
  image?: string | null;
  languageId?: string | null;
  categoryId?: string | null;
  authorId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeName?: string | null;
  isBreaking?: boolean;
  canonicalUrl?: string;
}): Promise<PushResult & { targeted?: number; skipped?: number }> {
  let audience: SmartPushAudience = {
    languageId: params.languageId || undefined,
    latitude: params.latitude,
    longitude: params.longitude,
    placeName: params.placeName,
    isBreaking: params.isBreaking,
    priority: params.isBreaking ? 'breaking' : 'normal',
  };

  if (params.authorId) {
    const fromAuthor = await resolveAuthorAudience(params.authorId);
    audience = { ...fromAuthor, ...audience, languageId: params.languageId || fromAuthor.languageId };
  }

  const payload: PushPayload = {
    title: params.isBreaking ? '🔴 బ్రేకింగ్' : '📱 షార్ట్ న్యూస్',
    body: truncate(params.title || params.body, 100),
    image: params.image || undefined,
    data: {
      type: 'shortnews',
      shortNewsId: params.shortNewsId,
      ...(params.canonicalUrl ? { url: params.canonicalUrl } : {}),
      action: 'view',
    },
  };

  return sendSmartPush(audience, payload, {
    dedupeKey: `shortnews:${params.shortNewsId}`,
    minScore: params.isBreaking ? 40 : 58,
  });
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}
