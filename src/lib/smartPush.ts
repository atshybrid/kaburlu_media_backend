/**
 * Smart mobile push — location + language relevance, rate limits, quiet hours.
 * Targets FCM/APNS/Expo tokens on Device rows (not browser web-push).
 */

import prisma from './prisma';
import { sendPush, PushPayload, PushResult } from './push';
import { subscribeToTopic } from './fcm';

export type SmartPushPriority = 'breaking' | 'high' | 'normal';

export type SmartPushAudience = {
  tenantId?: string;
  languageId?: string;
  stateId?: string | null;
  districtId?: string | null;
  mandalId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeName?: string | null;
  isBreaking?: boolean;
  priority?: SmartPushPriority;
};

type DeviceRow = {
  id: string;
  deviceId: string;
  pushToken: string;
  latitude: number | null;
  longitude: number | null;
  userId: string | null;
  user: {
    id: string;
    languageId: string;
    language?: { code: string | null } | null;
    location?: {
      latitude: number;
      longitude: number;
    } | null;
    profile?: {
      stateId: string | null;
      districtId: string | null;
      mandalId: string | null;
    } | null;
    reporterProfile?: {
      tenantId: string;
      stateId: string | null;
      districtId: string | null;
      mandalId: string | null;
    } | null;
  } | null;
};

const pushTimestamps = new Map<string, number[]>();
const dedupeKeys = new Map<string, number>();

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envFloat(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const MAX_PER_HOUR_NORMAL = () => envInt('SMART_PUSH_MAX_PER_HOUR', 4);
const MAX_PER_DAY_NORMAL = () => envInt('SMART_PUSH_MAX_PER_DAY', 15);
const MAX_PER_HOUR_BREAKING = () => envInt('SMART_PUSH_BREAKING_MAX_PER_HOUR', 6);
const MAX_PER_DAY_BREAKING = () => envInt('SMART_PUSH_BREAKING_MAX_PER_DAY', 20);
const RADIUS_KM = () => envFloat('SMART_PUSH_RADIUS_KM', 45);
const BATCH_SIZE = () => envInt('SMART_PUSH_BATCH_SIZE', 500);
const QUIET_START = () => envInt('SMART_PUSH_QUIET_START_HOUR_IST', 22);
const QUIET_END = () => envInt('SMART_PUSH_QUIET_END_HOUR_IST', 7);

function nowIstHour(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
}

function isQuietHours(): boolean {
  const h = nowIstHour();
  const start = QUIET_START();
  const end = QUIET_END();
  if (start === end) return false;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function pruneHistory(deviceId: string): number[] {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const prev = pushTimestamps.get(deviceId) || [];
  const next = prev.filter((t) => t > dayAgo);
  pushTimestamps.set(deviceId, next);
  return next;
}

function withinRateLimit(deviceId: string, breaking: boolean): boolean {
  const history = pruneHistory(deviceId);
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const inHour = history.filter((t) => t > hourAgo).length;
  const inDay = history.length;
  const maxHour = breaking ? MAX_PER_HOUR_BREAKING() : MAX_PER_HOUR_NORMAL();
  const maxDay = breaking ? MAX_PER_DAY_BREAKING() : MAX_PER_DAY_NORMAL();
  return inHour < maxHour && inDay < maxDay;
}

function recordPush(deviceId: string): void {
  const history = pruneHistory(deviceId);
  history.push(Date.now());
  pushTimestamps.set(deviceId, history);
}

function wasDedupedRecently(key: string): boolean {
  const prev = dedupeKeys.get(key);
  if (!prev) return false;
  return Date.now() - prev < 60 * 60 * 1000;
}

function markDedupe(key: string): void {
  dedupeKeys.set(key, Date.now());
}

function locationScore(device: DeviceRow, audience: SmartPushAudience): number {
  const user = device.user;
  if (!user) return 0;

  if (audience.languageId && user.languageId !== audience.languageId) {
    return 0;
  }

  if (audience.tenantId && user.reporterProfile?.tenantId && user.reporterProfile.tenantId !== audience.tenantId) {
    return 0;
  }

  const profile = user.profile;
  const reporter = user.reporterProfile;

  const userMandal = profile?.mandalId || reporter?.mandalId || null;
  const userDistrict = profile?.districtId || reporter?.districtId || null;
  const userState = profile?.stateId || reporter?.stateId || null;

  if (audience.mandalId && userMandal && audience.mandalId === userMandal) return 100;
  if (audience.districtId && userDistrict && audience.districtId === userDistrict) return 85;
  if (audience.stateId && userState && audience.stateId === userState) return 70;

  const contentLat = audience.latitude ?? null;
  const contentLon = audience.longitude ?? null;
  if (contentLat != null && contentLon != null) {
    const points: Array<{ lat: number; lon: number }> = [];
    if (device.latitude != null && device.longitude != null) {
      points.push({ lat: device.latitude, lon: device.longitude });
    }
    if (user.location?.latitude != null && user.location?.longitude != null) {
      points.push({ lat: user.location.latitude, lon: user.location.longitude });
    }
    for (const p of points) {
      const km = haversineKm(contentLat, contentLon, p.lat, p.lon);
      if (km <= RADIUS_KM()) {
        return Math.max(55, 90 - Math.floor(km / 5));
      }
    }
  }

  const hasGeoTarget = !!(audience.mandalId || audience.districtId || audience.stateId || audience.latitude);
  if (!hasGeoTarget) {
    return 50;
  }

  return 0;
}

async function loadDevices(limit: number): Promise<DeviceRow[]> {
  const rows = await prisma.device.findMany({
    where: { pushToken: { not: null }, userId: { not: null } },
    select: {
      id: true,
      deviceId: true,
      pushToken: true,
      latitude: true,
      longitude: true,
      userId: true,
      user: {
        select: {
          id: true,
          languageId: true,
          language: { select: { code: true } },
          location: { select: { latitude: true, longitude: true } },
          profile: { select: { stateId: true, districtId: true, mandalId: true } },
          reporterProfile: { select: { tenantId: true, stateId: true, districtId: true, mandalId: true } },
        },
      },
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  });
  return rows as DeviceRow[];
}

export async function sendSmartPush(
  audience: SmartPushAudience,
  payload: PushPayload,
  options?: { dedupeKey?: string; minScore?: number },
): Promise<PushResult & { targeted: number; skipped: number }> {
  const breaking = audience.isBreaking || audience.priority === 'breaking';
  const priority = audience.priority || (breaking ? 'breaking' : 'normal');
  const minScore =
    options?.minScore ??
    (priority === 'breaking' ? 40 : priority === 'high' ? 50 : 60);

  if (!breaking && isQuietHours()) {
    console.log('[SmartPush] Skipped — quiet hours (IST)');
    return { successCount: 0, failureCount: 0, errors: [], targeted: 0, skipped: 0 };
  }

  if (options?.dedupeKey && wasDedupedRecently(options.dedupeKey)) {
    console.log('[SmartPush] Skipped — dedupe', options.dedupeKey);
    return { successCount: 0, failureCount: 0, errors: [], targeted: 0, skipped: 0 };
  }

  const devices = await loadDevices(BATCH_SIZE());
  const tokens: string[] = [];
  let skipped = 0;

  for (const device of devices) {
    if (!device.pushToken) {
      skipped += 1;
      continue;
    }
    const score = locationScore(device, audience);
    if (score < minScore) {
      skipped += 1;
      continue;
    }
    if (!withinRateLimit(device.deviceId, breaking)) {
      skipped += 1;
      continue;
    }
    tokens.push(device.pushToken);
    recordPush(device.deviceId);
  }

  console.log(
    `[SmartPush] audience=${JSON.stringify({
      tenantId: audience.tenantId,
      languageId: audience.languageId,
      districtId: audience.districtId,
      mandalId: audience.mandalId,
      breaking,
    })} tokens=${tokens.length} skipped=${skipped} minScore=${minScore}`,
  );

  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, errors: [], targeted: 0, skipped };
  }

  const result = await sendPush(tokens, payload);
  if (options?.dedupeKey) markDedupe(options.dedupeKey);

  return { ...result, targeted: tokens.length, skipped };
}

/** Subscribe device token to language FCM topic after registration. */
export async function subscribeDeviceToLanguageTopics(pushToken: string, languageCode?: string | null): Promise<void> {
  if (!pushToken || !languageCode) return;
  const topic = `news-lang-${languageCode.toLowerCase()}`;
  try {
    await subscribeToTopic([pushToken], topic);
    console.log('[SmartPush] Subscribed token to', topic);
  } catch (e: any) {
    console.warn('[SmartPush] Topic subscribe failed (non-fatal):', e?.message || e);
  }
}

export async function resolveAuthorAudience(authorId: string, tenantId?: string): Promise<Partial<SmartPushAudience>> {
  const reporter = await prisma.reporter.findUnique({
    where: { userId: authorId },
    select: { tenantId: true, stateId: true, districtId: true, mandalId: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: authorId },
    select: { languageId: true, profile: { select: { stateId: true, districtId: true, mandalId: true } } },
  });
  return {
    tenantId: tenantId || reporter?.tenantId,
    languageId: user?.languageId,
    stateId: reporter?.stateId || user?.profile?.stateId,
    districtId: reporter?.districtId || user?.profile?.districtId,
    mandalId: reporter?.mandalId || user?.profile?.mandalId,
  };
}
