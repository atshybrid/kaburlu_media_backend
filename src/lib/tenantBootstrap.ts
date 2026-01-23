/**
 * Tenant Bootstrap Module
 * 
 * Sample data generation disabled - manage content manually
 */

import prisma from './prisma';

interface BootstrapOptions {
  skipArticles?: boolean;
  skipEpaper?: boolean;
  articleCount?: number;
  articlesPerCategory?: number;
  useAI?: boolean;
  useNewsAPI?: boolean;
  aiRewriteNews?: boolean;
  addImages?: boolean;
  imageSource?: 'placeholder' | 'unsplash';
  uploadImagesToR2?: boolean;
}

/**
 * Bootstrap sample content for a newly verified tenant domain
 * DISABLED - Returns immediately without creating any content
 */
export async function bootstrapTenantContent(
  tenantId: string,
  domainId: string,
  options: BootstrapOptions = {}
): Promise<{ success: boolean; created: { articles: number; epaper: number } }> {
  console.log('[TenantBootstrap] Skipping - sample data generation disabled');
  console.log(`[TenantBootstrap] tenantId=${tenantId}, domainId=${domainId}`);
  return { success: true, created: { articles: 0, epaper: 0 } };
}

export default { bootstrapTenantContent };
