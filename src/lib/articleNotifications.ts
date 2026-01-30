/**
 * Article Workflow Notifications
 * 
 * Handles push notifications for article status changes:
 * - PENDING: Notify admins (Tenant Admin, Chief Editor, Desk Editor)
 * - PUBLISHED: Notify article author (Reporter)
 * - REJECTED: Notify article author (Reporter)
 * - CHANGES_REQUESTED: Notify article author (Reporter)
 */

import { sendPush, sendPushToUser, PushResult } from './push';
import prisma from './prisma';

// Admin roles that should receive pending article notifications
const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'CHIEF_EDITOR', 'DESK_EDITOR'];

export interface ArticleInfo {
  id: string;
  title: string;
  authorId?: string | null;
  tenantId?: string | null;
  domainId?: string | null;
  status: string;
  previousStatus?: string;
  rejectionReason?: string;
}

/**
 * Send notification when article is submitted for review (PENDING)
 * Notifies: TENANT_ADMIN, CHIEF_EDITOR, DESK_EDITOR of that tenant
 */
export async function notifyArticlePending(article: ArticleInfo): Promise<PushResult> {
  console.log(`[ArticleNotify] Article PENDING: ${article.id} - "${article.title}"`);

  if (!article.tenantId) {
    console.log('[ArticleNotify] No tenantId, skipping admin notification');
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  try {
    // Get author name for better notification
    let authorName = 'A reporter';
    if (article.authorId) {
      const author = await (prisma as any).user.findUnique({
        where: { id: article.authorId },
        include: { profile: { select: { fullName: true } } }
      });
      authorName = author?.profile?.fullName || 'A reporter';
    }

    // Find admin users for this tenant via Reporter relation
    const reporters = await (prisma as any).reporter.findMany({
      where: {
        tenantId: article.tenantId,
        active: true,
        user: {
          status: 'ACTIVE',
          role: { name: { in: ADMIN_ROLES } }
        }
      },
      include: {
        user: {
          include: {
            devices: {
              where: { pushToken: { not: null } },
              select: { pushToken: true }
            }
          }
        }
      }
    });

    // Collect all admin push tokens
    const tokens: string[] = [];
    for (const reporter of reporters) {
      if (reporter.user?.devices) {
        for (const device of reporter.user.devices) {
          if (device.pushToken) {
            tokens.push(device.pushToken);
          }
        }
      }
    }

    if (tokens.length === 0) {
      console.log('[ArticleNotify] No admin push tokens found');
      return { successCount: 0, failureCount: 0, errors: [] };
    }

    console.log(`[ArticleNotify] Sending to ${tokens.length} admin device(s)`);

    const result = await sendPush(tokens, {
      title: '📝 New Article for Review',
      body: `${authorName} submitted: "${truncate(article.title, 50)}"`,
      data: {
        type: 'article_pending',
        articleId: article.id,
        action: 'review'
      }
    });

    console.log(`[ArticleNotify] PENDING notification: success=${result.successCount}, failure=${result.failureCount}`);
    return result;
  } catch (e: any) {
    console.error('[ArticleNotify] Error sending PENDING notification:', e);
    return { successCount: 0, failureCount: 1, errors: [e.message] };
  }
}

/**
 * Send notification when article is published
 * Notifies: Article author (Reporter)
 */
export async function notifyArticlePublished(article: ArticleInfo): Promise<PushResult> {
  console.log(`[ArticleNotify] Article PUBLISHED: ${article.id} - "${article.title}"`);

  if (!article.authorId) {
    console.log('[ArticleNotify] No authorId, skipping author notification');
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  try {
    const result = await sendPushToUser(article.authorId, {
      title: '🎉 Article Published!',
      body: `Your article "${truncate(article.title, 50)}" is now live!`,
      data: {
        type: 'article_published',
        articleId: article.id,
        action: 'view'
      }
    });

    console.log(`[ArticleNotify] PUBLISHED notification: success=${result.successCount}, failure=${result.failureCount}`);
    return result;
  } catch (e: any) {
    console.error('[ArticleNotify] Error sending PUBLISHED notification:', e);
    return { successCount: 0, failureCount: 1, errors: [e.message] };
  }
}

/**
 * Send notification when article is rejected
 * Notifies: Article author (Reporter)
 */
export async function notifyArticleRejected(article: ArticleInfo): Promise<PushResult> {
  console.log(`[ArticleNotify] Article REJECTED: ${article.id} - "${article.title}"`);

  if (!article.authorId) {
    console.log('[ArticleNotify] No authorId, skipping author notification');
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  try {
    const body = article.rejectionReason
      ? `Your article was rejected: ${truncate(article.rejectionReason, 50)}`
      : `Your article "${truncate(article.title, 40)}" was rejected`;

    const result = await sendPushToUser(article.authorId, {
      title: '❌ Article Rejected',
      body,
      data: {
        type: 'article_rejected',
        articleId: article.id,
        action: 'edit'
      }
    });

    console.log(`[ArticleNotify] REJECTED notification: success=${result.successCount}, failure=${result.failureCount}`);
    return result;
  } catch (e: any) {
    console.error('[ArticleNotify] Error sending REJECTED notification:', e);
    return { successCount: 0, failureCount: 1, errors: [e.message] };
  }
}

/**
 * Send notification when changes are requested
 * Notifies: Article author (Reporter)
 */
export async function notifyChangesRequested(article: ArticleInfo): Promise<PushResult> {
  console.log(`[ArticleNotify] Changes Requested: ${article.id} - "${article.title}"`);

  if (!article.authorId) {
    console.log('[ArticleNotify] No authorId, skipping author notification');
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  try {
    const result = await sendPushToUser(article.authorId, {
      title: '✏️ Changes Requested',
      body: `Please review feedback on "${truncate(article.title, 45)}"`,
      data: {
        type: 'article_changes_requested',
        articleId: article.id,
        action: 'edit'
      }
    });

    console.log(`[ArticleNotify] CHANGES_REQUESTED notification: success=${result.successCount}, failure=${result.failureCount}`);
    return result;
  } catch (e: any) {
    console.error('[ArticleNotify] Error sending CHANGES_REQUESTED notification:', e);
    return { successCount: 0, failureCount: 1, errors: [e.message] };
  }
}

/**
 * Main handler: Notify based on article status change
 */
export async function notifyArticleStatusChange(
  article: ArticleInfo,
  previousStatus?: string
): Promise<PushResult> {
  const status = article.status.toUpperCase();
  
  console.log(`[ArticleNotify] Status change: ${previousStatus || 'NEW'} → ${status}`);

  switch (status) {
    case 'PENDING':
      return notifyArticlePending(article);
    
    case 'PUBLISHED':
      return notifyArticlePublished(article);
    
    case 'REJECTED':
      return notifyArticleRejected(article);
    
    case 'CHANGES_REQUESTED':
    case 'REVISION_REQUIRED':
      return notifyChangesRequested(article);
    
    default:
      console.log(`[ArticleNotify] No notification for status: ${status}`);
      return { successCount: 0, failureCount: 0, errors: [] };
  }
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
