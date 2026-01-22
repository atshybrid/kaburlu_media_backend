/**
 * Fetch an article from TenantWebArticle and format it for the Newsroom AI Agent
 * 
 * Usage:
 *   npx ts-node scripts/get_article_for_newsroom_ai.ts <articleId>
 *   npx ts-node scripts/get_article_for_newsroom_ai.ts --slug <slug> --tenant <tenantSlug>
 *   npx ts-node scripts/get_article_for_newsroom_ai.ts --latest --tenant <tenantSlug>
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface NewsroomAIInput {
  RAW_NEWS_TEXT: string;
  AVAILABLE_CATEGORIES: string[];
  NEWSPAPER_NAME: string;
  LANGUAGE: {
    code: string;
    name: string;
    script: string;
    region: string;
  };
}

async function getArticleById(articleId: string) {
  return prisma.tenantWebArticle.findUnique({
    where: { id: articleId },
    include: {
      tenant: true,
      domain: true,
      language: true,
      category: true,
      author: true,
    },
  });
}

async function getArticleBySlug(slug: string, tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  
  return prisma.tenantWebArticle.findFirst({
    where: { tenantId: tenant.id, slug },
    include: {
      tenant: true,
      domain: true,
      language: true,
      category: true,
      author: true,
    },
  });
}

async function getLatestArticle(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  
  return prisma.tenantWebArticle.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    include: {
      tenant: true,
      domain: true,
      language: true,
      category: true,
      author: true,
    },
  });
}

async function getTenantCategories(tenantId: string, domainId?: string | null) {
  // Get categories linked to this domain/tenant
  if (domainId) {
    const domainCategories = await prisma.domainCategory.findMany({
      where: { domainId },
      include: { category: true },
    });
    if (domainCategories.length > 0) {
      return domainCategories.map((dc: any) => dc.category.name);
    }
  }
  
  // Fallback: get all categories
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
  return categories.map((c: any) => c.name);
}

function extractPlainText(contentJson: any): string {
  if (!contentJson) return '';
  
  // If plainText exists, use it
  if (typeof contentJson.plainText === 'string') {
    return contentJson.plainText;
  }
  
  // If blocks array exists, extract text from blocks
  if (Array.isArray(contentJson.blocks)) {
    const texts: string[] = [];
    for (const block of contentJson.blocks) {
      if (block.type === 'paragraph' && block.data?.text) {
        texts.push(block.data.text.replace(/<[^>]*>/g, '')); // Strip HTML
      } else if (block.type === 'header' && block.data?.text) {
        texts.push(block.data.text.replace(/<[^>]*>/g, ''));
      } else if (block.type === 'list' && Array.isArray(block.data?.items)) {
        texts.push(...block.data.items.map((item: string) => item.replace(/<[^>]*>/g, '')));
      }
    }
    return texts.join('\n\n');
  }
  
  // If contentHtml exists, strip HTML
  if (typeof contentJson.contentHtml === 'string') {
    return contentJson.contentHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  return '';
}

function getLanguageInfo(language: any): NewsroomAIInput['LANGUAGE'] {
  if (!language) {
    return {
      code: 'en',
      name: 'English',
      script: 'Latin',
      region: 'India',
    };
  }
  
  const langMap: Record<string, { name: string; script: string; region: string }> = {
    te: { name: 'Telugu', script: 'Telugu', region: 'Telangana' },
    hi: { name: 'Hindi', script: 'Devanagari', region: 'India' },
    en: { name: 'English', script: 'Latin', region: 'India' },
    ta: { name: 'Tamil', script: 'Tamil', region: 'Tamil Nadu' },
    kn: { name: 'Kannada', script: 'Kannada', region: 'Karnataka' },
    ml: { name: 'Malayalam', script: 'Malayalam', region: 'Kerala' },
    mr: { name: 'Marathi', script: 'Devanagari', region: 'Maharashtra' },
    gu: { name: 'Gujarati', script: 'Gujarati', region: 'Gujarat' },
    bn: { name: 'Bengali', script: 'Bengali', region: 'West Bengal' },
    pa: { name: 'Punjabi', script: 'Gurmukhi', region: 'Punjab' },
    or: { name: 'Odia', script: 'Odia', region: 'Odisha' },
  };
  
  const code = language.code || 'en';
  const info = langMap[code] || { name: language.name || 'English', script: 'Latin', region: 'India' };
  
  return {
    code,
    name: info.name,
    script: info.script,
    region: info.region,
  };
}

async function formatForNewsroomAI(article: any): Promise<NewsroomAIInput> {
  const categories = await getTenantCategories(article.tenantId, article.domainId);
  
  // Build raw news text from title + content
  const contentText = extractPlainText(article.contentJson);
  const rawNewsText = `${article.title}\n\n${contentText}`.trim();
  
  // Get newspaper name from tenant
  const newspaperName = article.tenant?.name || article.tenant?.slug || 'News';
  
  return {
    RAW_NEWS_TEXT: rawNewsText,
    AVAILABLE_CATEGORIES: categories,
    NEWSPAPER_NAME: newspaperName,
    LANGUAGE: getLanguageInfo(article.language),
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  let article: any = null;
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  npx ts-node scripts/get_article_for_newsroom_ai.ts <articleId>');
    console.log('  npx ts-node scripts/get_article_for_newsroom_ai.ts --slug <slug> --tenant <tenantSlug>');
    console.log('  npx ts-node scripts/get_article_for_newsroom_ai.ts --latest --tenant <tenantSlug>');
    process.exit(1);
  }
  
  // Parse arguments
  const slugIdx = args.indexOf('--slug');
  const tenantIdx = args.indexOf('--tenant');
  const latestIdx = args.indexOf('--latest');
  
  if (latestIdx !== -1 && tenantIdx !== -1) {
    const tenantSlug = args[tenantIdx + 1];
    article = await getLatestArticle(tenantSlug);
  } else if (slugIdx !== -1 && tenantIdx !== -1) {
    const slug = args[slugIdx + 1];
    const tenantSlug = args[tenantIdx + 1];
    article = await getArticleBySlug(slug, tenantSlug);
  } else {
    // First argument is article ID
    article = await getArticleById(args[0]);
  }
  
  if (!article) {
    console.error('Article not found');
    process.exit(1);
  }
  
  console.log('\n=== ARTICLE DETAILS ===');
  console.log('ID:', article.id);
  console.log('Title:', article.title);
  console.log('Slug:', article.slug);
  console.log('Status:', article.status);
  console.log('Category:', article.category?.name || 'None');
  console.log('Language:', article.language?.code || 'Unknown');
  console.log('Tenant:', article.tenant?.name);
  console.log('Created:', article.createdAt);
  
  console.log('\n=== NEWSROOM AI INPUT ===\n');
  
  const newsroomInput = await formatForNewsroomAI(article);
  console.log(JSON.stringify(newsroomInput, null, 2));
  
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
