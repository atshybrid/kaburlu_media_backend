/**
 * AI-assisted brand colors for political parties (ECI does not publish hex codes).
 */
import prisma from './prisma';
import { aiGenerateText } from './aiProvider';

const p: any = prisma;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function parseAiColors(text: string): { primaryColor?: string; secondaryColor?: string } | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const obj = JSON.parse(jsonMatch[0]);
    const primary = String(obj.primaryColor || obj.primary || '').trim();
    const secondary = String(obj.secondaryColor || obj.secondary || '').trim();
    if (!HEX_RE.test(primary)) return null;
    return {
      primaryColor: primary.toUpperCase(),
      secondaryColor: HEX_RE.test(secondary) ? secondary.toUpperCase() : '#FFFFFF',
    };
  } catch {
    return null;
  }
}

/** Fill primary/secondary colors using AI for parties that need curation. */
export async function enrichPartyColorsWithAi(opts?: { limit?: number; force?: boolean }) {
  const limit = opts?.limit ?? 30;
  const where: any = { isActive: true };
  if (!opts?.force) {
    where.colorSource = { in: ['MANUAL'] };
    where.OR = [{ primaryColor: '#1A237E' }, { primaryColor: null }];
  }

  const rows = await p.indianPoliticalParty.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: 'asc' },
  });

  let updated = 0;
  for (const party of rows) {
    const prompt = `You are helping a news app UI theme Indian political parties.
Party official name: ${party.name}
ECI election symbol: ${party.symbolName || 'unknown'}
Recognition: ${party.recognition}
States: ${(party.states || []).join(', ') || 'national'}

Return ONLY valid JSON with brand-appropriate hex colors (Indian party conventions, not offensive):
{"primaryColor":"#RRGGBB","secondaryColor":"#RRGGBB","reason":"one short line"}`;

    const { text } = await aiGenerateText({ prompt, purpose: 'rewrite' });

    const colors = parseAiColors(text || '');
    if (!colors) continue;

    await p.indianPoliticalParty.update({
      where: { id: party.id },
      data: {
        primaryColor: colors.primaryColor,
        secondaryColor: colors.secondaryColor,
        colorSource: 'AI_CURATED',
        updatedAt: new Date(),
      },
    });
    updated++;
    console.log(`  AI colors: ${party.shortCode} → ${colors.primaryColor} / ${colors.secondaryColor}`);
  }

  return updated;
}
