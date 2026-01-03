export type Style2AdSlotKey =
  | 'home_left_1'
  | 'home_left_2'
  | 'home_right_1'
  | 'home_right_2'
  | 'style2_article_sidebar';

export const STYLE2_AD_SLOT_KEYS: Style2AdSlotKey[] = [
  'home_left_1',
  'home_left_2',
  'home_right_1',
  'home_right_2',
  'style2_article_sidebar'
];

export const STYLE2_AD_SLOT_LABELS: Record<Style2AdSlotKey, string> = {
  home_left_1: 'Style2 Home Left #1',
  home_left_2: 'Style2 Home Left #2',
  home_right_1: 'Style2 Home Right #1',
  home_right_2: 'Style2 Home Right #2',
  style2_article_sidebar: 'Style2 Article Sidebar'
};

export type Style2AdsProvider = 'google' | 'local';

export type Style2GoogleSlot = {
  slot?: string | null;
  format?: string | null;
  responsive?: boolean | null;
  client?: string | null;
};

export type Style2LocalSlot = {
  enabled?: boolean | null;
  imageUrl?: string | null;
  clickUrl?: string | null;
  alt?: string | null;
  logoUrl?: string | null;
};

export type Style2AdsSlot = {
  enabled?: boolean;
  provider?: Style2AdsProvider;
  label?: string | null;
  google?: Style2GoogleSlot | null;
  local?: Style2LocalSlot | null;
};

export type Style2AdsConfig = {
  enabled?: boolean;
  debug?: boolean;
  googleAdsense?: { client?: string | null } | null;
  slots?: Partial<Record<Style2AdSlotKey, Style2AdsSlot>>;
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

function normalizeProvider(v: any): Style2AdsProvider {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'google' ? 'google' : 'local';
}

function normalizeSlot(key: Style2AdSlotKey, input: any): Style2AdsSlot {
  const obj = isObject(input) ? input : {};
  const provider = Object.prototype.hasOwnProperty.call(obj, 'provider') ? normalizeProvider(obj.provider) : 'local';
  const enabled = Object.prototype.hasOwnProperty.call(obj, 'enabled') ? asBool(obj.enabled, true) : true;

  const label = Object.prototype.hasOwnProperty.call(obj, 'label') ? asNullableString(obj.label) : STYLE2_AD_SLOT_LABELS[key];

  const googleObj = isObject(obj.google) ? obj.google : {};
  const localObj = isObject(obj.local) ? obj.local : {};

  const google: Style2GoogleSlot | null = provider === 'google'
    ? {
        slot: asNullableString(googleObj.slot),
        format: Object.prototype.hasOwnProperty.call(googleObj, 'format') ? asNullableString(googleObj.format) : 'auto',
        responsive: Object.prototype.hasOwnProperty.call(googleObj, 'responsive') ? asBool(googleObj.responsive, true) : true,
        client: Object.prototype.hasOwnProperty.call(googleObj, 'client') ? asNullableString(googleObj.client) : null,
      }
    : null;

  const local: Style2LocalSlot | null = provider === 'local'
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

export function normalizeStyle2AdsConfig(input: any): Style2AdsConfig {
  const obj = isObject(input) ? input : {};
  const enabled = Object.prototype.hasOwnProperty.call(obj, 'enabled') ? asBool(obj.enabled, true) : true;
  const debug = Object.prototype.hasOwnProperty.call(obj, 'debug') ? asBool(obj.debug, false) : false;

  const ga = isObject(obj.googleAdsense) ? obj.googleAdsense : {};
  const googleAdsense = {
    client: Object.prototype.hasOwnProperty.call(ga, 'client') ? asNullableString(ga.client) : null,
  };

  const slotsIn = isObject(obj.slots) ? obj.slots : {};
  const slots: Partial<Record<Style2AdSlotKey, Style2AdsSlot>> = {};

  for (const key of STYLE2_AD_SLOT_KEYS) {
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

export function buildEffectiveStyle2AdsResponse(config: Style2AdsConfig, opts?: { includeAllSlots?: boolean }) {
  const includeAllSlots = opts?.includeAllSlots !== false;
  const normalized = normalizeStyle2AdsConfig(config);

  const outSlots: Record<Style2AdSlotKey, Style2AdsSlot> = {} as any;
  for (const key of STYLE2_AD_SLOT_KEYS) {
    const existing = (normalized.slots || ({} as any))[key];
    if (existing) {
      outSlots[key] = existing;
      continue;
    }
    if (!includeAllSlots) continue;
    outSlots[key] = {
      enabled: false,
      provider: 'local',
      label: STYLE2_AD_SLOT_LABELS[key],
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
