/**
 * NewsData.io API Client
 * 
 * Fetches real news articles from NewsData.io
 * Supports Telugu, English, Hindi and other Indian languages
 * 
 * Free tier: 200 requests/day
 * API Docs: https://newsdata.io/documentation
 */

interface NewsDataArticle {
  article_id: string;
  title: string;
  link: string;
  description: string | null;
  content: string | null;
  keywords: string[] | null;
  creator: string[] | null;
  language: string;
  country: string[];
  category: string[];
  pubDate: string;
  image_url: string | null;
  video_url: string | null;
  source_name: string;
  source_url: string;
}

interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
  nextPage?: string;
}

interface FetchNewsOptions {
  language?: 'te' | 'en' | 'hi'; // Telugu, English, Hindi
  country?: string; // Default: 'in' (India)
  category?: string; // politics, sports, business, entertainment, health, science, technology
  image?: boolean; // Only articles with images
  limit?: number; // Max results per request (default: 10)
}

/**
 * Fetch news articles from NewsData.io
 */
export async function fetchNewsArticles(options: FetchNewsOptions = {}): Promise<NewsDataArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  
  if (!apiKey) {
    console.warn('[NewsData] API key not configured');
    return [];
  }

  const {
    language = 'te',
    country = 'in',
    category,
    image = true,
    limit = 10
  } = options;

  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      country,
      language,
      ...(category && { category }),
      ...(image && { image: '1' }),
      size: String(Math.min(limit, 10)) // API max is 10 per request
    });

    const url = `https://newsdata.io/api/1/latest?${params.toString()}`;
    
    console.log(`[NewsData] Fetching ${language} news, category: ${category || 'all'}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`NewsData API error: ${response.status} ${response.statusText}`);
    }

    const data: NewsDataResponse = await response.json();

    if (data.status !== 'success') {
      throw new Error('NewsData API returned non-success status');
    }

    console.log(`[NewsData] Fetched ${data.results.length} articles`);
    return data.results || [];
  } catch (error) {
    console.error('[NewsData] Failed to fetch articles:', error);
    return [];
  }
}

/**
 * Map NewsData category to our category slug
 */
export function mapNewsDataCategory(newsCategory: string): string {
  const categoryMap: Record<string, string> = {
    'politics': 'politics',
    'sports': 'sports',
    'business': 'business',
    'entertainment': 'entertainment',
    'health': 'health',
    'science': 'science',
    'technology': 'technology',
    'top': 'national',
    'lifestyle': 'lifestyle',
    'world': 'international'
  };

  return categoryMap[newsCategory.toLowerCase()] || 'national';
}

/**
 * Fetch news for specific category
 */
export async function fetchNewsByCategory(
  categorySlug: string,
  language: 'te' | 'en' | 'hi' = 'te',
  limit: number = 10
): Promise<NewsDataArticle[]> {
  // Map our category slugs to NewsData categories
  const newsDataCategory = mapOurCategoryToNewsData(categorySlug);
  
  if (!newsDataCategory) {
    // Fetch general news if category doesn't map
    return fetchNewsArticles({ language, limit });
  }

  return fetchNewsArticles({
    language,
    category: newsDataCategory,
    limit
  });
}

/**
 * Map our category slug to NewsData category
 */
function mapOurCategoryToNewsData(categorySlug: string): string | null {
  const reverseMap: Record<string, string> = {
    'politics': 'politics',
    'sports': 'sports',
    'business': 'business',
    'entertainment': 'entertainment',
    'health': 'health',
    'science': 'science',
    'technology': 'technology',
    'national': 'top',
    'international': 'world',
    'lifestyle': 'lifestyle'
  };

  return reverseMap[categorySlug] || null;
}

/**
 * Test NewsData.io API connection
 */
export async function testNewsDataConnection(): Promise<boolean> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  
  if (!apiKey) {
    console.error('[NewsData] API key not configured');
    return false;
  }

  try {
    const articles = await fetchNewsArticles({ limit: 1 });
    console.log(`[NewsData] Connection test successful: ${articles.length > 0 ? 'OK' : 'No results'}`);
    return true;
  } catch (error) {
    console.error('[NewsData] Connection test failed:', error);
    return false;
  }
}
