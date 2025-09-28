// Reusable helper encapsulating AI short news generation & retry logic.
// This isolates side-effect free logic for easier unit testing.
// It does NOT perform DB writes; controller handles category mapping/creation.

export interface GeneratedShortNewsDraft {
  title: string;
  content: string;
  suggestedCategoryName: string;
  attempts: number;
  fallbackUsed: boolean;
  headings?: {
    h2?: { text: string; color?: string; bgColor?: string };
    h3?: { text: string; color?: string; bgColor?: string };
  };
}

export interface GenerateShortNewsOptions {
  minWords?: number; // minimum acceptable content words before retry
  maxWords?: number; // absolute cap (hard trimmed after success)
  maxAttempts?: number; // AI attempts before fallback
}

interface InternalResult {
  parsed: any | null;
  attempts: number;
  fallbackUsed: boolean;
}

/**
 * Core loop for generating a short news draft from an AI provider.
 * @param rawText original user field note (used for fallback derivation)
 * @param prompt rendered prompt string with placeholders already substituted
 * @param aiFn provider adapter returning raw string (possibly fenced JSON)
 */
export async function generateAiShortNewsFromPrompt(
  rawText: string,
  prompt: string,
  aiFn: (prompt: string) => Promise<string>,
  opts: GenerateShortNewsOptions = {}
): Promise<GeneratedShortNewsDraft> {
  const { minWords = 58, maxWords = 60, maxAttempts = 3 } = opts;
  let attempts = 0;
  let parsed: any = null;

  while (attempts < maxAttempts) {
    attempts++;
    const attemptPrompt = attempts === 1
      ? prompt
      : `${prompt}\n\nIMPORTANT: Previous attempt had only ${parsed?.content?.trim()?.split(/\s+/).length || 'too few'} words. Regenerate with BETWEEN ${minWords} and ${maxWords} WORDS EXACTLY for the content body (not counting title).`;
    const aiRaw = await aiFn(attemptPrompt);
    if (!aiRaw) {
      continue; // try again (empty response)
    }
    let jsonText = aiRaw.trim();
    jsonText = jsonText.replace(/^```(json)?/i, '').replace(/```$/,'').trim();
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // invalid JSON; retry unless out of attempts
      continue;
    }
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.content !== 'string') {
      continue;
    }
    const wc = parsed.content.trim().split(/\s+/).length;
    if (wc < minWords && attempts < maxAttempts) {
      // under min, retry
      continue;
    }
    break; // success
  }

  let fallbackUsed = false;
  if (!parsed || typeof parsed.title !== 'string' || typeof parsed.content !== 'string') {
    // Build deterministic fallback from rawText
    const words = rawText.trim().split(/\s+/).filter(Boolean);
    const contentWords = words.slice(0, maxWords);
    const content = contentWords.join(' ');
    // Title: first 6 words (or fewer) joined, then truncated to 35 chars
    const titleSeed = words.slice(0, 6).join(' ');
    let title = titleSeed.replace(/(^.|\s+.)/g, m => m.toUpperCase());
    if (title.length > 35) title = title.slice(0, 35).trim();
    parsed = { title, content, suggestedCategoryName: 'Community' };
    fallbackUsed = true;
  }

  // Enforce final caps (title <= 35 chars, content <= maxWords)
  if (parsed.title.length > 35) parsed.title = parsed.title.slice(0, 35).trim();
  const finalWords = parsed.content.trim().split(/\s+/);
  if (finalWords.length > maxWords) parsed.content = finalWords.slice(0, maxWords).join(' ');
  if (typeof parsed.suggestedCategoryName !== 'string' || !parsed.suggestedCategoryName.trim()) {
    parsed.suggestedCategoryName = 'Community';
  }

  // Normalize optional headings if present
  const clip = (s: any) => (typeof s === 'string' ? s.trim().slice(0, 50) : undefined);
  const normHead = (obj: any) => {
    if (!obj || typeof obj !== 'object') return undefined;
    const text = clip(obj.text ?? obj.content);
    if (!text) return undefined;
    const color = typeof obj.color === 'string' && obj.color.trim() ? obj.color.trim() : undefined;
    const bgColorRaw = obj.bgColor ?? obj.backgroundColor;
    const bgColor = typeof bgColorRaw === 'string' && bgColorRaw.trim() ? bgColorRaw.trim() : 'transparent';
    return { text, color, bgColor };
  };
  let headings: any = undefined;
  if (parsed.headings && typeof parsed.headings === 'object') {
    const h2 = normHead(parsed.headings.h2);
    const h3 = normHead(parsed.headings.h3);
    if (h2 || h3) headings = { ...(h2 ? { h2 } : {}), ...(h3 ? { h3 } : {}) };
  }

  return {
    title: parsed.title,
    content: parsed.content,
    suggestedCategoryName: parsed.suggestedCategoryName.trim(),
    attempts,
    fallbackUsed,
    ...(headings ? { headings } : {}),
  };
}
