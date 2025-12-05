// Minimal allowlist HTML sanitizer for server-side cleanup
// Allows only specific tags and strips disallowed attributes.

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'figure', 'img', 'figcaption'
]);

// Allowed attributes per tag
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href']),
  img: new Set(['src', 'alt', 'loading']),
  figure: new Set([]),
  figcaption: new Set([]),
  p: new Set([]),
  h1: new Set([]),
  h2: new Set([]),
  h3: new Set([]),
  ul: new Set([]),
  ol: new Set([]),
  li: new Set([]),
  strong: new Set([]),
  em: new Set([])
};

function stripDisallowedTags(input: string): string {
  // Remove tags not in allowlist
  return input.replace(/<\/?([a-zA-Z0-9]+)(\s+[^>]*?)?>/g, (match, tagName: string, attrs: string) => {
    const tag = String(tagName || '').toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    // Keep tag, but sanitize attributes separately
    if (!attrs) return `<${match.startsWith('</') ? '/' : ''}${tag}>`;
    return match; // attributes will be cleaned in a second pass
  });
}

function sanitizeAttributes(input: string): string {
  return input.replace(/<([a-zA-Z0-9]+)(\s+[^>]*?)?>/g, (_m, tagName: string, rawAttrs: string) => {
    const tag = String(tagName || '').toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    const allow = ALLOWED_ATTRS[tag] || new Set<string>();
    if (!rawAttrs || rawAttrs.trim() === '') return `<${tag}>`;
    // Extract key="value" pairs; drop event handlers and styles entirely
    const attrs: string[] = [];
    const attrRe = /(\w[\w-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(rawAttrs))) {
      const name = m[1].toLowerCase();
      const value = m[2];
      if (!allow.has(name)) continue;
      // Basic href/src sanity: disallow javascript: and data: except images for src
      if ((name === 'href' || name === 'src')) {
        const v = String(value).replace(/^['"]|['"]$/g, '').trim().toLowerCase();
        if (name === 'href' && (v.startsWith('javascript:') || v.startsWith('data:'))) continue;
        if (name === 'src' && v.startsWith('javascript:')) continue;
      }
      attrs.push(`${name}=${value}`);
    }
    const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
    return `<${tag}${attrStr}>`;
  });
}

export function sanitizeHtmlAllowlist(html: string): string {
  if (!html) return '';
  let out = String(html);
  // Remove script/style tags entirely
    // Remove script/style blocks entirely (open tag + contents + closing tag), cross-line safe
    out = out.replace(/<(?:script|style)[^>]*?>[\s\S]*?<\/(?:script|style)>/gi, '');
  // First pass: strip disallowed tags
  out = stripDisallowedTags(out);
  // Second pass: clean attributes on allowed tags
  out = sanitizeAttributes(out);
  return out;
}

export function kebabSlug(input: string, maxLen = 120): string {
  if (!input) return '';
  // Basic transliteration replacement and cleanup
  let s = String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // diacritics
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/-+[^-]*$/, '');
  return s;
}

// Prefer robust transliteration via 'transliteration' package when available.
export function slugFromAnyLanguage(input: string, maxLen = 120): string {
  if (!input) return '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tr = require('transliteration');
    const slug = tr.slugify(String(input), { lowercase: true, separator: '-', trim: true });
    const clipped = slug.length > maxLen ? slug.slice(0, maxLen).replace(/-+[^-]*$/, '') : slug;
    return clipped;
  } catch {
    return kebabSlug(input, maxLen);
  }
}

export function trimWords(input: string, maxWords: number): string {
  if (!input) return '';
  const words = input.trim().split(/\s+/);
  if (words.length <= maxWords) return input.trim();
  return words.slice(0, maxWords).join(' ');
}
