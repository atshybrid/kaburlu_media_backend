/**
 * Article Quota Management & Validation Library
 * Handles reporter daily article quotas with priority-based limits
 */
import prisma from './prisma';

interface QuotaLimits {
  maxPriority1Daily: number;
  maxPriority2Daily: number;
  maxPriority3Daily: number;
  maxTotalDaily: number;
}

interface QuotaUsage {
  priority1Count: number;
  priority2Count: number;
  priority3Count: number;
  totalCount: number;
}

interface QuotaCheckResult {
  allowed: boolean;
  quota: QuotaLimits;
  usage: QuotaUsage;
  remaining: {
    priority1: number;
    priority2: number;
    priority3: number;
    total: number;
  };
  message?: string;
}

/**
 * Get effective quota limits for a reporter (combines tenant defaults + reporter overrides)
 */
export async function getReporterQuotaLimits(reporterId: string): Promise<QuotaLimits> {
  const reporter = await (prisma as any).reporter.findUnique({
    where: { id: reporterId },
    select: {
      tenantId: true,
      articleQuota: {
        select: {
          maxPriority1Daily: true,
          maxPriority2Daily: true,
          maxPriority3Daily: true,
          maxTotalDaily: true,
          isActive: true
        }
      }
    }
  });

  if (!reporter) {
    throw new Error('Reporter not found');
  }

  // Get tenant defaults
  let tenantQuota = await (prisma as any).tenantArticleQuota.findUnique({
    where: { tenantId: reporter.tenantId },
    select: {
      maxPriority1Daily: true,
      maxPriority2Daily: true,
      maxPriority3Daily: true,
      maxTotalDaily: true,
      enforceQuota: true
    }
  });

  // Create default if doesn't exist
  if (!tenantQuota) {
    tenantQuota = await (prisma as any).tenantArticleQuota.create({
      data: {
        tenantId: reporter.tenantId,
        maxPriority1Daily: 5,
        maxPriority2Daily: 10,
        maxPriority3Daily: 20,
        maxTotalDaily: 30,
        enforceQuota: true
      }
    });
  }

  // If quota not enforced, return unlimited
  if (!tenantQuota.enforceQuota) {
    return {
      maxPriority1Daily: 999999,
      maxPriority2Daily: 999999,
      maxPriority3Daily: 999999,
      maxTotalDaily: 999999
    };
  }

  // If reporter has custom quota and it's active, use reporter overrides
  const reporterQuota = reporter.articleQuota;
  if (reporterQuota && reporterQuota.isActive) {
    return {
      maxPriority1Daily: reporterQuota.maxPriority1Daily ?? tenantQuota.maxPriority1Daily,
      maxPriority2Daily: reporterQuota.maxPriority2Daily ?? tenantQuota.maxPriority2Daily,
      maxPriority3Daily: reporterQuota.maxPriority3Daily ?? tenantQuota.maxPriority3Daily,
      maxTotalDaily: reporterQuota.maxTotalDaily ?? tenantQuota.maxTotalDaily
    };
  }

  // Use tenant defaults
  return {
    maxPriority1Daily: tenantQuota.maxPriority1Daily,
    maxPriority2Daily: tenantQuota.maxPriority2Daily,
    maxPriority3Daily: tenantQuota.maxPriority3Daily,
    maxTotalDaily: tenantQuota.maxTotalDaily
  };
}

/**
 * Get daily article usage count for a reporter
 */
export async function getReporterDailyUsage(reporterId: string, date?: Date): Promise<QuotaUsage> {
  const targetDate = date || new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const articles = await (prisma as any).article.findMany({
    where: {
      authorId: reporterId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    select: {
      priority: true
    }
  });

  return {
    priority1Count: articles.filter((a: any) => a.priority === 1).length,
    priority2Count: articles.filter((a: any) => a.priority === 2).length,
    priority3Count: articles.filter((a: any) => a.priority === 3).length,
    totalCount: articles.length
  };
}

/**
 * Check if reporter can post article with given priority
 */
export async function checkReporterDailyQuota(
  reporterId: string,
  priority: number,
  date?: Date
): Promise<QuotaCheckResult> {
  const quota = await getReporterQuotaLimits(reporterId);
  const usage = await getReporterDailyUsage(reporterId, date);

  const remaining = {
    priority1: Math.max(0, quota.maxPriority1Daily - usage.priority1Count),
    priority2: Math.max(0, quota.maxPriority2Daily - usage.priority2Count),
    priority3: Math.max(0, quota.maxPriority3Daily - usage.priority3Count),
    total: Math.max(0, quota.maxTotalDaily - usage.totalCount)
  };

  // Check total limit first
  if (usage.totalCount >= quota.maxTotalDaily) {
    return {
      allowed: false,
      quota,
      usage,
      remaining,
      message: `Daily total article limit (${quota.maxTotalDaily}) reached`
    };
  }

  // Check priority-specific limit
  const priorityKey = `priority${priority}` as 'priority1' | 'priority2' | 'priority3';
  const priorityCount = usage[`${priorityKey}Count` as keyof QuotaUsage] as number;
  const priorityLimit = quota[`maxPriority${priority}Daily` as keyof QuotaLimits] as number;

  if (priorityCount >= priorityLimit) {
    return {
      allowed: false,
      quota,
      usage,
      remaining,
      message: `Daily priority ${priority} limit (${priorityLimit}) reached`
    };
  }

  return {
    allowed: true,
    quota,
    usage,
    remaining
  };
}
