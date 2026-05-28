/** Defaults for public ePaper boot when tenant/domain theme colors are unset. */
export const EPAPER_DEFAULT_PRIMARY_COLOR = '#0D47A1';
export const EPAPER_DEFAULT_SECONDARY_COLOR = '#FFB300';
export const EPAPER_DEFAULT_ACCENT_COLOR = '#1976d2';

export function pickHexColor(candidates: unknown[], fallback: string): string {
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return fallback;
}

/** ePaper client Zod schemas require strings, not null, for edition SEO fields. */
export function normalizeEpaperSeoText(value: unknown, fallback: string): string {
  const s = String(value ?? '').trim();
  return s || fallback;
}

export function normalizeEpaperSubEditionForPublic(
  sub: Record<string, unknown>,
  opts?: { parentName?: string }
): Record<string, unknown> {
  const name = String(sub?.name ?? 'Edition').trim() || 'Edition';
  const parentName = opts?.parentName?.trim();
  const label = parentName ? `${name} (${parentName})` : name;
  return {
    ...sub,
    seoTitle: normalizeEpaperSeoText(sub.seoTitle, name),
    seoDescription: normalizeEpaperSeoText(sub.seoDescription, `Read ${label} ePaper online.`),
    seoKeywords: normalizeEpaperSeoText(sub.seoKeywords, `${name}, epaper, news`),
  };
}

export function normalizeEpaperEditionForPublic(edition: Record<string, unknown>): Record<string, unknown> {
  const name = String(edition?.name ?? 'Edition').trim() || 'Edition';
  const subEditions = edition.subEditions;
  return {
    ...edition,
    seoTitle: normalizeEpaperSeoText(edition.seoTitle, name),
    seoDescription: normalizeEpaperSeoText(edition.seoDescription, `Read ${name} ePaper online.`),
    seoKeywords: normalizeEpaperSeoText(edition.seoKeywords, `${name}, epaper, news`),
    subEditions: Array.isArray(subEditions)
      ? subEditions.map((sub) => normalizeEpaperSubEditionForPublic(sub as Record<string, unknown>, { parentName: name }))
      : subEditions,
  };
}

export function resolveEpaperBrandColors(input: {
  tenantTheme?: { primaryColor?: string | null; secondaryColor?: string | null } | null;
  effectiveDomainSettings?: {
    theme?: { colors?: { primary?: string | null; secondary?: string | null; accent?: string | null } };
    branding?: { primaryColor?: string | null; secondaryColor?: string | null };
  } | null;
}) {
  const theme = input.effectiveDomainSettings?.theme;
  const primaryColor = pickHexColor(
    [input.tenantTheme?.primaryColor, theme?.colors?.primary, input.effectiveDomainSettings?.branding?.primaryColor],
    EPAPER_DEFAULT_PRIMARY_COLOR
  );
  const secondaryColor = pickHexColor(
    [input.tenantTheme?.secondaryColor, theme?.colors?.secondary, input.effectiveDomainSettings?.branding?.secondaryColor],
    EPAPER_DEFAULT_SECONDARY_COLOR
  );
  const accentColor = pickHexColor([theme?.colors?.accent], EPAPER_DEFAULT_ACCENT_COLOR);
  return { primaryColor, secondaryColor, accentColor };
}
