import prisma from './prisma';
import { transliterate } from 'transliteration';
import { translateAndSaveCategoryInBackground } from '../api/categories/categories.service';

export type ResolveCategoryResult = {
  categoryId: string;
  categoryName: string;
  created: boolean;
  matchScore: number;
};

function normalizeCategoryName(input: string): string {
  const s = String(input || '').trim();
  if (!s) return '';
  // Transliterate to reduce script differences for matching.
  const latin = transliterate(s);
  return latin
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

// Sørensen–Dice coefficient on bigrams. Returns 0..1
function diceSimilarity(aRaw: string, bRaw: string): number {
  const a = normalizeCategoryName(aRaw);
  const b = normalizeCategoryName(bRaw);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return 0;

  const aB = bigrams(a);
  const bB = bigrams(b);
  if (!aB.length || !bB.length) return 0;

  const counts = new Map<string, number>();
  for (const x of aB) counts.set(x, (counts.get(x) || 0) + 1);

  let intersection = 0;
  for (const x of bB) {
    const n = counts.get(x) || 0;
    if (n > 0) {
      intersection++;
      counts.set(x, n - 1);
    }
  }

  return (2 * intersection) / (aB.length + bB.length);
}

function slugifyCategory(name: string): string {
  const base = transliterate(String(name || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'category';
}

export async function resolveOrCreateCategoryIdByName(opts: {
  suggestedName: string;
  languageCode?: string;
  similarityThreshold?: number;
  autoCreate?: boolean;
}): Promise<ResolveCategoryResult | null> {
  const suggestedName = String(opts.suggestedName || '').trim();
  if (!suggestedName) return null;

  const languageCode = String(opts.languageCode || '').trim().toLowerCase() || 'en';
  const threshold = typeof opts.similarityThreshold === 'number' ? opts.similarityThreshold : 0.9;
  const autoCreate = opts.autoCreate !== false;

  // Pull candidates (base names + translations for this language) and compute best match.
  const [cats, trs] = await Promise.all([
    prisma.category.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, slug: true },
      take: 2000,
    }),
    prisma.categoryTranslation.findMany({
      where: { language: languageCode as any },
      select: { categoryId: true, name: true },
      take: 4000,
    }).catch(() => [] as any),
  ]);

  const namesById = new Map<string, string[]>();
  for (const c of cats) namesById.set(c.id, [c.name]);
  for (const t of trs as any[]) {
    const arr = namesById.get(t.categoryId) || [];
    arr.push(String(t.name || ''));
    namesById.set(t.categoryId, arr);
  }

  let best: { id: string; name: string; score: number } | null = null;
  for (const [id, names] of namesById.entries()) {
    for (const n of names) {
      const score = diceSimilarity(suggestedName, n);
      if (!best || score > best.score) best = { id, name: n, score };
    }
  }

  if (best && best.score >= threshold) {
    // Use existing category.
    return { categoryId: best.id, categoryName: best.name, created: false, matchScore: best.score };
  }

  if (!autoCreate) return null;

  // Guardrails to avoid exploding categories from noisy AI.
  const norm = normalizeCategoryName(suggestedName);
  const words = norm.split(' ').filter(Boolean);
  if (!norm || norm.length < 3 || norm.length > 40) return null;
  if (words.length > 4) return null;

  // Create new category (unique slug).
  const baseSlug = slugifyCategory(suggestedName);
  const existingSlugs = new Set(cats.map(c => c.slug));
  let slug = baseSlug;
  let attempt = 1;
  while (existingSlugs.has(slug) && attempt < 50) {
    slug = `${baseSlug}-${attempt++}`;
  }

  const created = await prisma.category.create({
    data: { name: suggestedName, slug },
    select: { id: true, name: true },
  });

  // Ensure CategoryTranslation rows exist for all active languages immediately.
  // (We store the base name as a placeholder; background translation can refine later.)
  try {
    const langs = await prisma.language.findMany({ where: { isDeleted: false }, select: { code: true } });
    const codes = langs.map(l => String(l.code || '').trim()).filter(Boolean);
    if (codes.length) {
      await prisma.categoryTranslation.createMany({
        data: codes.map(code => ({ categoryId: created.id, language: code as any, name: suggestedName })),
        skipDuplicates: true,
      });
    }
  } catch {}

  // Kick off AI translation for all active languages (fire-and-forget; best-effort).
  translateAndSaveCategoryInBackground(created.id, suggestedName).catch(() => {});

  return { categoryId: created.id, categoryName: created.name, created: true, matchScore: 0 };
}

// Seed list to reduce auto-created categories.
export const CORE_NEWS_CATEGORIES: Array<{ name: string; slug: string }> = [
  { name: 'Politics', slug: 'politics' },
  { name: 'State News', slug: 'state-news' },
  { name: 'Crime', slug: 'crime' },
  { name: 'Accident', slug: 'accident' },
  { name: 'Weather', slug: 'weather' },
  { name: 'Sports', slug: 'sports' },
  { name: 'Business', slug: 'business' },
  { name: 'Education', slug: 'education' },
  { name: 'Health', slug: 'health' },
  { name: 'Environment', slug: 'environment' },
  { name: 'Technology', slug: 'technology' },
  { name: 'Entertainment', slug: 'entertainment' },
  { name: 'Devotional', slug: 'devotional' },
  { name: 'Lifestyle', slug: 'lifestyle' },
  { name: 'Community', slug: 'community' },
  { name: 'Traffic', slug: 'traffic' },
  { name: 'Agriculture', slug: 'agriculture' },
  { name: 'National', slug: 'national' },
  { name: 'International', slug: 'international' },
];
