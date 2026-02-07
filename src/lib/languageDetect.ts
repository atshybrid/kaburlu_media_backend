export type DetectedLanguage = {
  code: string;
  confidence: number; // 0..1 best-effort
};

const SCRIPT_PATTERNS: Array<{ code: string; name: string; re: RegExp }> = [
  { code: 'te', name: 'Telugu', re: /[\u0C00-\u0C7F]/g },
  { code: 'ta', name: 'Tamil', re: /[\u0B80-\u0BFF]/g },
  { code: 'kn', name: 'Kannada', re: /[\u0C80-\u0CFF]/g },
  { code: 'ml', name: 'Malayalam', re: /[\u0D00-\u0D7F]/g },
  { code: 'hi', name: 'Hindi', re: /[\u0900-\u097F]/g }, // Devanagari
  { code: 'bn', name: 'Bengali', re: /[\u0980-\u09FF]/g },
  { code: 'gu', name: 'Gujarati', re: /[\u0A80-\u0AFF]/g },
  { code: 'pa', name: 'Punjabi', re: /[\u0A00-\u0A7F]/g }, // Gurmukhi
  { code: 'or', name: 'Odia', re: /[\u0B00-\u0B7F]/g },
  { code: 'ur', name: 'Urdu', re: /[\u0600-\u06FF\u0750-\u077F]/g }, // Arabic blocks
  { code: 'en', name: 'English', re: /[A-Za-z]/g },
];

export function languageNameFromCode(code: string): string {
  const c = String(code || '').trim().toLowerCase();
  const hit = SCRIPT_PATTERNS.find(x => x.code === c);
  return hit?.name || c || 'English';
}

function countMatches(text: string, re: RegExp): number {
  if (!text) return 0;
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * Heuristic script-based language detection.
 * - Designed to keep the output language aligned with the input script.
 * - Returns null when detection is ambiguous.
 */
export function detectLanguageCodeFromText(text: string): DetectedLanguage | null {
  const input = String(text || '');
  if (!input.trim()) return null;

  const counts = SCRIPT_PATTERNS
    .map(p => ({ code: p.code, count: countMatches(input, p.re) }))
    .filter(x => x.count > 0);

  if (!counts.length) return null;

  counts.sort((a, b) => b.count - a.count);
  const best = counts[0];
  const second = counts[1];

  const total = counts.reduce((s, x) => s + x.count, 0);
  const confidence = total > 0 ? best.count / total : 0;

  // If very close between two scripts, consider ambiguous.
  if (second && best.count <= second.count * 1.1) return null;

  // Require a minimum signal so short mixed strings don't flip language.
  if (best.count < 8 && confidence < 0.6) return null;

  return { code: best.code, confidence };
}

export function normalizeLanguageCode(input: any): string | null {
  if (typeof input !== 'string') return null;
  const code = input.trim().toLowerCase();
  if (!code) return null;
  // Accept common variants.
  if (code === 'in' || code === 'eng') return 'en';
  if (code === 'telugu') return 'te';
  if (code === 'hindi') return 'hi';
  if (code === 'tamil') return 'ta';
  if (code === 'kannada') return 'kn';
  if (code === 'malayalam') return 'ml';
  return code;
}
