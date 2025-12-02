export class CreateArticleDto {
  title!: string;
  content!: string;
  categoryIds!: string[];
  isPublished?: boolean;
  isBreaking?: boolean;
  isFeatured?: boolean;
  // Language of the article (ISO code like 'en', 'te')
  languageCode?: string;
  shortNews?: string;
  longNews?: string;
  headlines?: string[];
  type!: string; // "citizen" or "reporter"
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  slug?: string;
  h1?: string;
  h2?: string;
  h3?: string[];
  // Optional structured content for website rendering
  contentHtml?: string;
  sections?: Array<{
    heading?: string;
    level?: 1 | 2 | 3;
    paragraphs?: string[];
    imageUrl?: string;
  }>;
  styles?: Record<string, any>;
}
