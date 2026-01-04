import { PrismaClient } from '@prisma/client';
import { googleTranslateText } from '../../lib/googleTranslate';

const prisma = new PrismaClient();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

async function translateTenantName(params: { name: string; languageCode: string }): Promise<string> {
  // Prefer Google Translate because user asked for it.
  return googleTranslateText({ text: params.name, target: params.languageCode, source: 'en' });
}

export async function backfillTenantNameTranslationForTenant(tenantId: string) {
  const tenant = await p.tenant.findUnique({
    where: { id: tenantId },
    include: { entity: { include: { language: true } }, translations: true },
  });
  if (!tenant) return { ok: false, error: 'TENANT_NOT_FOUND' };

  const languageCode = tenant?.entity?.language?.code ? String(tenant.entity.language.code) : '';
  const languageName = tenant?.entity?.language?.name ? String(tenant.entity.language.name) : '';
  if (!languageCode) return { ok: false, error: 'TENANT_LANGUAGE_NOT_SET' };

  const baseName = String(tenant.name || '').trim();
  if (!baseName) return { ok: false, error: 'TENANT_NAME_EMPTY' };

  // If language is English, translation doesn't add value.
  if (/^en(-|$)/i.test(languageCode)) {
    return { ok: true, skipped: true, tenantId, languageCode, languageName, name: baseName };
  }

  const translated = (await translateTenantName({ name: baseName, languageCode }))?.trim();
  if (!translated) return { ok: false, error: 'TRANSLATION_FAILED_OR_EMPTY' };

  const row = await p.tenantTranslation.upsert({
    where: { tenantId_language: { tenantId, language: languageCode } },
    update: { name: translated },
    create: { tenantId, language: languageCode, name: translated },
  });

  return {
    ok: true,
    tenantId,
    languageCode,
    languageName,
    baseName,
    translatedName: row.name,
  };
}

export async function backfillTenantNameTranslationsAllTenants() {
  const tenants = await p.tenant.findMany({
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  const results: any[] = [];
  for (const t of tenants) {
    // sequential to avoid rate-limits
    const r = await backfillTenantNameTranslationForTenant(String(t.id));
    results.push(r);
  }
  return { ok: true, total: tenants.length, results };
}
