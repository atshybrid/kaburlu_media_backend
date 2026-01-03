import prisma from '../../lib/prisma';
import { aiEnabledFor } from '../../lib/aiConfig';
import { aiGenerateText } from '../../lib/aiProvider';
import { getPrompt, renderPrompt } from '../../lib/prompts';

type LocationEntityKind = 'STATE' | 'DISTRICT' | 'MANDAL' | 'VILLAGE';

const p: any = prisma;

function looksLatinOnly(s: string) {
  return /^[A-Za-z0-9\s\-_.]+$/.test(String(s || '').trim());
}

async function translatePlaceName(opts: {
  text: string;
  placeType: LocationEntityKind;
  targetLanguageHint: string;
  languageCode: string;
  context?: string;
}) {
  const text = String(opts.text || '').trim();
  if (!text) return '';

  if (!aiEnabledFor('translation')) return text;

  const languageCode = String(opts.languageCode || '').trim().toLowerCase();
  const isEnglishTarget = languageCode === 'en';
  const baseLooksLatin = looksLatinOnly(text);

  // English target: if already Latin, keep as-is.
  if (isEnglishTarget && baseLooksLatin) return text;

  try {
    const tpl = await getPrompt('LOCATION_TRANSLATION');
    const prompt = renderPrompt(tpl, {
      text,
      placeType: opts.placeType,
      context: opts.context || '',
      targetLanguage: opts.targetLanguageHint,
      latinGuard: isEnglishTarget ? '' : ' (do NOT use Latin/English letters)',
    });

    const outRes = await aiGenerateText({ prompt, purpose: 'translation' });
    const out = String(outRes?.text || '').trim();
    if (!out) return text;

    if (!isEnglishTarget) {
      const outLooksLatin = looksLatinOnly(out);
      if (outLooksLatin || out.localeCompare(text, undefined, { sensitivity: 'base' }) === 0) {
        // Stricter second pass
        const strictPrompt = `You are a translator.
Task: Convert a place name into ${opts.targetLanguageHint}.
Rules:
- Output ONLY the place name.
- MUST be in the native script of ${opts.targetLanguageHint}.
- Do NOT output English/Latin letters.
- No quotes, no punctuation, no explanations.
- Do NOT translate meaning; transliterate sound.

PlaceType: ${opts.placeType}
PlaceName: ${text}
Context: ${opts.context || ''}`;
        const strictRes = await aiGenerateText({ prompt: strictPrompt, purpose: 'translation' });
        const strictOut = String(strictRes?.text || '').trim();
        if (strictOut && !looksLatinOnly(strictOut)) return strictOut;
      }
    }

    return out;
  } catch (e) {
    console.error('[LocationTranslation] translatePlaceName failed', e);
    return text;
  }
}

async function getActiveLanguages() {
  return p.language.findMany({ where: { isDeleted: false }, select: { code: true, name: true, nativeName: true } });
}

function langHint(lang: { code: string; name?: string | null; nativeName?: string | null }) {
  return `${lang.name || lang.code} (${lang.nativeName || lang.name || lang.code})`;
}

async function backfillStatesForLanguage(languageCode: string) {
  const lang = await p.language.findFirst({ where: { code: languageCode, isDeleted: false } }).catch(() => null);
  if (!lang) return;

  const batchSize = 500;
  let cursor: string | undefined;

  while (true) {
    const rows = await p.state.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;

    try {
      await p.stateTranslation.createMany({
        data: rows.map((s: any) => ({ stateId: s.id, language: languageCode as any, name: s.name })),
        skipDuplicates: true,
      });
    } catch {
      // ignore
    }

    for (const s of rows) {
      const translated = await translatePlaceName({
        text: s.name,
        placeType: 'STATE',
        context: '',
        targetLanguageHint: langHint(lang),
        languageCode,
      });
      try {
        await p.stateTranslation.upsert({
          where: { stateId_language: { stateId: s.id, language: languageCode } },
          update: { name: translated },
          create: { stateId: s.id, language: languageCode, name: translated },
        });
      } catch {
        // best-effort
      }
    }

    cursor = rows[rows.length - 1].id;
  }
}

async function backfillDistrictsForLanguage(languageCode: string) {
  const lang = await p.language.findFirst({ where: { code: languageCode, isDeleted: false } }).catch(() => null);
  if (!lang) return;

  const batchSize = 500;
  let cursor: string | undefined;

  while (true) {
    const rows = await p.district.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, state: { select: { name: true } } },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;

    try {
      await p.districtTranslation.createMany({
        data: rows.map((d: any) => ({ districtId: d.id, language: languageCode as any, name: d.name })),
        skipDuplicates: true,
      });
    } catch {
      // ignore
    }

    for (const d of rows) {
      const context = d.state?.name ? `State: ${d.state.name}` : '';
      const translated = await translatePlaceName({
        text: d.name,
        placeType: 'DISTRICT',
        context,
        targetLanguageHint: langHint(lang),
        languageCode,
      });
      try {
        await p.districtTranslation.upsert({
          where: { districtId_language: { districtId: d.id, language: languageCode } },
          update: { name: translated },
          create: { districtId: d.id, language: languageCode, name: translated },
        });
      } catch {
        // best-effort
      }
    }

    cursor = rows[rows.length - 1].id;
  }
}

async function backfillMandalsForLanguage(languageCode: string) {
  const lang = await p.language.findFirst({ where: { code: languageCode, isDeleted: false } }).catch(() => null);
  if (!lang) return;

  const batchSize = 500;
  let cursor: string | undefined;

  while (true) {
    const rows = await p.mandal.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, district: { select: { name: true, state: { select: { name: true } } } } },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;

    try {
      await p.mandalTranslation.createMany({
        data: rows.map((m: any) => ({ mandalId: m.id, language: languageCode as any, name: m.name })),
        skipDuplicates: true,
      });
    } catch {
      // ignore
    }

    for (const m of rows) {
      const districtName = m.district?.name ? `District: ${m.district.name}` : '';
      const stateName = m.district?.state?.name ? `State: ${m.district.state.name}` : '';
      const context = [districtName, stateName].filter(Boolean).join(', ');
      const translated = await translatePlaceName({
        text: m.name,
        placeType: 'MANDAL',
        context,
        targetLanguageHint: langHint(lang),
        languageCode,
      });
      try {
        await p.mandalTranslation.upsert({
          where: { mandalId_language: { mandalId: m.id, language: languageCode } },
          update: { name: translated },
          create: { mandalId: m.id, language: languageCode, name: translated },
        });
      } catch {
        // best-effort
      }
    }

    cursor = rows[rows.length - 1].id;
  }
}

async function backfillVillagesForLanguage(languageCode: string) {
  const lang = await p.language.findFirst({ where: { code: languageCode, isDeleted: false } }).catch(() => null);
  if (!lang) return;

  const batchSize = 500;
  let cursor: string | undefined;

  while (true) {
    const rows = await p.village.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        mandal: { select: { name: true, district: { select: { name: true, state: { select: { name: true } } } } } },
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;

    try {
      await p.villageTranslation.createMany({
        data: rows.map((v: any) => ({ villageId: v.id, language: languageCode as any, name: v.name })),
        skipDuplicates: true,
      });
    } catch {
      // ignore
    }

    for (const v of rows) {
      const mandalName = v.mandal?.name ? `Mandal: ${v.mandal.name}` : '';
      const districtName = v.mandal?.district?.name ? `District: ${v.mandal.district.name}` : '';
      const stateName = v.mandal?.district?.state?.name ? `State: ${v.mandal.district.state.name}` : '';
      const context = [mandalName, districtName, stateName].filter(Boolean).join(', ');
      const translated = await translatePlaceName({
        text: v.name,
        placeType: 'VILLAGE',
        context,
        targetLanguageHint: langHint(lang),
        languageCode,
      });
      try {
        await p.villageTranslation.upsert({
          where: { villageId_language: { villageId: v.id, language: languageCode } },
          update: { name: translated },
          create: { villageId: v.id, language: languageCode, name: translated },
        });
      } catch {
        // best-effort
      }
    }

    cursor = rows[rows.length - 1].id;
  }
}

export async function backfillLocationTranslationsForNewLanguageInBackground(languageCodeRaw: string) {
  const languageCode = String(languageCodeRaw || '').trim().toLowerCase();
  if (!languageCode) return;

  try {
    await backfillStatesForLanguage(languageCode);
    await backfillDistrictsForLanguage(languageCode);
    await backfillMandalsForLanguage(languageCode);
    await backfillVillagesForLanguage(languageCode);
  } catch (e) {
    console.error('[Background Job] Failed to backfill location translations for new language:', languageCodeRaw, e);
  }
}

export async function backfillAllLocationTranslationsInBackground() {
  try {
    const languages = await getActiveLanguages();
    const codes = (languages || []).map((l: any) => String(l.code || '').trim().toLowerCase()).filter(Boolean);
    for (const code of codes) {
      await backfillLocationTranslationsForNewLanguageInBackground(code);
    }
  } catch (e) {
    console.error('[Background Job] Failed to backfill all location translations:', e);
  }
}
