import { transliterate } from 'transliteration';

export type DefaultCategoryNode = {
  name: string;
  slug: string;
  children?: Array<{ name: string; slug: string }>;
};

export function defaultCategorySlugify(input: string): string {
  const base = transliterate(String(input || ''))
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return base || 'category';
}

function makeChildSlug(parentSlug: string, childName: string): string {
  const childPart = defaultCategorySlugify(childName);
  // Prefix with parent to avoid collisions (e.g., "government-schemes" appears in multiple parents)
  const s = `${parentSlug}-${childPart}`.replace(/-+/g, '-').slice(0, 60);
  return s || `${parentSlug}-child`;
}

const RAW_DEFAULTS: Record<string, string[]> = {
  Politics: [
    'National Politics',
    'State Politics',
    'Local Politics',
    'Elections',
    'Political Parties',
    'Government Decisions',
  ],
  'State News': [
    'District News',
    'Mandal News',
    'Village News',
    'Government Schemes',
    'Local Issues',
  ],
  National: [
    'Government News',
    'Parliament',
    'Judiciary',
    'Defence & Security',
    'National Policies',
  ],
  International: [
    'World News',
    'Wars & Conflicts',
    'Global Politics',
    'Foreign Relations',
    'NRI News',
  ],
  Crime: [
    'Murder',
    'Theft & Robbery',
    'Cyber Crime',
    'Fraud & Scams',
    'Court & Legal',
  ],
  Business: [
    'Markets',
    'Startups',
    'Banking & Finance',
    'Corporate News',
    'Agriculture Business',
  ],
  Sports: [
    'Cricket',
    'Football',
    'Olympics',
    'Badminton',
    'Local Sports',
  ],
  Entertainment: [
    'Movies',
    'Cinema News',
    'Movie Reviews',
    'TV & OTT',
    'Celebrity News',
  ],
  Technology: [
    'Mobile & Gadgets',
    'AI & Software',
    'Internet & Apps',
    'Startups (Tech)',
    'Cyber Security',
  ],
  Health: [
    'Health Tips',
    'Diseases & Prevention',
    'Medical News',
    'Government Health Schemes',
    'Mental Health',
  ],
  Education: [
    'Exams & Results',
    'Job Notifications',
    'Admissions',
    'Scholarships',
    'Education Policies',
  ],
  Agriculture: [
    'Crops & Farming',
    'Farmer Issues',
    'Market Prices',
    'Weather Updates',
    'Government Schemes',
  ],
  Devotional: [
    'Temple News',
    'Festivals',
    'Spirituality',
    'Religious Events',
    'Pilgrimages',
  ],
  Lifestyle: [
    'Food & Recipes',
    'Travel',
    'Fashion',
    'Fitness',
    'Culture',
  ],
};

export const DEFAULT_CATEGORY_TREE: DefaultCategoryNode[] = Object.entries(RAW_DEFAULTS).map(([parentName, children]) => {
  const parentSlug = defaultCategorySlugify(parentName);
  return {
    name: parentName,
    slug: parentSlug,
    children: children.map((childName) => ({
      name: childName,
      slug: makeChildSlug(parentSlug, childName),
    })),
  };
});

export function listDefaultCategorySlugs(opts?: { includeChildren?: boolean }): string[] {
  const includeChildren = opts?.includeChildren !== false;
  const slugs: string[] = [];
  for (const p of DEFAULT_CATEGORY_TREE) {
    slugs.push(p.slug);
    if (includeChildren && Array.isArray(p.children)) {
      for (const c of p.children) slugs.push(c.slug);
    }
  }
  return Array.from(new Set(slugs));
}
