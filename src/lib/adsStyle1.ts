export type Style1AdSlotKey =
  | 'home_top_banner'
  | 'home_left_1'
  | 'home_left_2'
  | 'home_right_1'
  | 'home_right_2'
  | 'home_bottom_banner'
  | 'home_horizontal_1'
  | 'home_horizontal_2'
  | 'home_horizontal_3'
  | 'article_sidebar_top'
  | 'article_sidebar_bottom'
  | 'article_inline'
  | 'tv9_top_banner'
  | 'tv9_sidebar_widget'
  | 'style2_article_sidebar';

export const STYLE1_AD_SLOT_KEYS: Style1AdSlotKey[] = [
  'home_top_banner',
  'home_left_1',
  'home_left_2',
  'home_right_1',
  'home_right_2',
  'home_bottom_banner',
  'home_horizontal_1',
  'home_horizontal_2',
  'home_horizontal_3',
  'article_sidebar_top',
  'article_sidebar_bottom',
  'article_inline',
  'tv9_top_banner',
  'tv9_sidebar_widget',
  'style2_article_sidebar'
];

export const STYLE1_AD_SLOT_LABELS: Record<Style1AdSlotKey, string> = {
  home_top_banner: 'Home Top Banner',
  home_left_1: 'Home Left #1',
  home_left_2: 'Home Left #2',
  home_right_1: 'Home Right #1',
  home_right_2: 'Home Right #2',
  home_bottom_banner: 'Home Bottom Banner',
  home_horizontal_1: 'Home Horizontal #1',
  home_horizontal_2: 'Home Horizontal #2',
  home_horizontal_3: 'Home Horizontal #3',
  article_sidebar_top: 'Article Sidebar Top',
  article_sidebar_bottom: 'Article Sidebar Bottom',
  article_inline: 'Article Inline',
  tv9_top_banner: 'TV9 Top Banner',
  tv9_sidebar_widget: 'TV9 Sidebar Widget',
  style2_article_sidebar: 'Style2 Article Sidebar'
};

export type Style1AdsProvider = 'google' | 'local';

export type Style1GoogleSlot = {
  slot?: string | null;
  format?: string | null;
  responsive?: boolean | null;
  client?: string | null;
};

export type Style1LocalSlot = {
  enabled?: boolean | null;
  imageUrl?: string | null;
  clickUrl?: string | null;
  alt?: string | null;
  logoUrl?: string | null;
};

export type Style1AdsSlot = {
  enabled?: boolean;
  provider?: Style1AdsProvider;
  label?: string | null;
  google?: Style1GoogleSlot | null;
  local?: Style1LocalSlot | null;
};

export type Style1AdsConfig = {
  enabled?: boolean;
  debug?: boolean;
  googleAdsense?: { client?: string | null } | null;
  slots?: Partial<Record<Style1AdSlotKey, Style1AdsSlot>>;
};

function isObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function asBool(v: any, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return fallback;
}

function asNullableString(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizeProvider(v: any): Style1AdsProvider {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'google' ? 'google' : 'local';
}

function normalizeSlot(key: Style1AdSlotKey, input: any): Style1AdsSlot {
  const obj = isObject(input) ? input : {};
  const provider = Object.prototype.hasOwnProperty.call(obj, 'provider') ? normalizeProvider(obj.provider) : 'local';
  const enabled = Object.prototype.hasOwnProperty.call(obj, 'enabled') ? asBool(obj.enabled, true) : true;

  const label = Object.prototype.hasOwnProperty.call(obj, 'label') ? asNullableString(obj.label) : STYLE1_AD_SLOT_LABELS[key];

  const googleObj = isObject(obj.google) ? obj.google : {};
  const localObj = isObject(obj.local) ? obj.local : {};

  const google: Style1GoogleSlot | null = provider === 'google'
    ? {
        slot: asNullableString(googleObj.slot),
        format: Object.prototype.hasOwnProperty.call(googleObj, 'format') ? asNullableString(googleObj.format) : 'auto',
        responsive: Object.prototype.hasOwnProperty.call(googleObj, 'responsive') ? asBool(googleObj.responsive, true) : true,
        client: Object.prototype.hasOwnProperty.call(googleObj, 'client') ? asNullableString(googleObj.client) : null,
      }
    : null;

  const local: Style1LocalSlot | null = provider === 'local'
    ? {
        enabled: Object.prototype.hasOwnProperty.call(localObj, 'enabled') ? asBool(localObj.enabled, true) : true,
        imageUrl: asNullableString(localObj.imageUrl),
        clickUrl: asNullableString(localObj.clickUrl),
        alt: Object.prototype.hasOwnProperty.call(localObj, 'alt') ? asNullableString(localObj.alt) : null,
        logoUrl: Object.prototype.hasOwnProperty.call(localObj, 'logoUrl') ? asNullableString(localObj.logoUrl) : null,
      }
    : null;

  return { enabled, provider, label, google, local };
}

export function normalizeStyle1AdsConfig(input: any): Style1AdsConfig {
  const obj = isObject(input) ? input : {};
  const enabled = Object.prototype.hasOwnProperty.call(obj, 'enabled') ? asBool(obj.enabled, true) : true;
  const debug = Object.prototype.hasOwnProperty.call(obj, 'debug') ? asBool(obj.debug, false) : false;

  const ga = isObject(obj.googleAdsense) ? obj.googleAdsense : {};
  const googleAdsense = {
    client: Object.prototype.hasOwnProperty.call(ga, 'client') ? asNullableString(ga.client) : null,
  };

  const slotsIn = isObject(obj.slots) ? obj.slots : {};
  const slots: Partial<Record<Style1AdSlotKey, Style1AdsSlot>> = {};

  for (const key of STYLE1_AD_SLOT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(slotsIn, key)) {
      (slots as any)[key] = normalizeSlot(key, (slotsIn as any)[key]);
    }
  }

  return {
    enabled,
    debug,
    googleAdsense: googleAdsense.client ? googleAdsense : null,
    slots,
  };
}

export function buildEffectiveStyle1AdsResponse(config: Style1AdsConfig, opts?: { includeAllSlots?: boolean }) {
  const includeAllSlots = opts?.includeAllSlots !== false;
  const normalized = normalizeStyle1AdsConfig(config);

  const outSlots: Record<Style1AdSlotKey, Style1AdsSlot> = {} as any;
  for (const key of STYLE1_AD_SLOT_KEYS) {
    const existing = (normalized.slots || ({} as any))[key];
    if (existing) {
      outSlots[key] = existing;
      continue;
    }
    if (!includeAllSlots) continue;
    outSlots[key] = {
      enabled: false,
      provider: 'local',
      label: STYLE1_AD_SLOT_LABELS[key],
      google: null,
      local: { enabled: true, imageUrl: null, clickUrl: null, alt: null, logoUrl: null }
    };
  }

  return {
    enabled: normalized.enabled,
    debug: normalized.debug,
    googleAdsense: normalized.googleAdsense || null,
    slots: outSlots,
  };
}
