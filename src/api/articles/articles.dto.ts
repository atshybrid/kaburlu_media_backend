export class CreateArticleDto {
  title!: string;
  content!: string;
  categoryIds!: string[];
  isPublished?: boolean;
  isBreaking?: boolean;
  isFeatured?: boolean;
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
  styles?: Record<string, any>;
}
