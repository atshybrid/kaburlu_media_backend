// Migration: Old 9 page-based slot keys → New 6 type-based slot keys
// Run: node scripts/migrate_ads_slots.js

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Priority map: new key → old keys to try in order
const MIGRATION_MAP = {
  display_horizontal:   ['home_top',       'category_top', 'article_top'],
  display_square:       ['home_mid',        'category_mid'],
  display_vertical:     ['home_sidebar'],
  in_article:           ['article_mid',     'article_top'],
  multiplex_horizontal: ['home_multiplex'],
  multiplex_vertical:   ['article_multiplex'],
};

const NEW_KEYS = new Set([
  'display_square', 'display_horizontal', 'display_vertical',
  'in_article', 'multiplex_horizontal', 'multiplex_vertical',
]);

const FORMAT_FOR = {
  in_article:           'fluid',
  multiplex_horizontal: 'autorelaxed',
  multiplex_vertical:   'autorelaxed',
};

(async () => {
  const rows = await p.tenantSettings.findMany({});
  let migrated = 0, skipped = 0, alreadyNew = 0;

  for (const row of rows) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    const adsConfig = data.adsConfig;

    if (!adsConfig || !adsConfig.slots) {
      console.log(`  - Tenant ${row.tenantId}: no adsConfig, skip`);
      skipped++;
      continue;
    }

    const slotKeys = Object.keys(adsConfig.slots);
    const hasNewKey = slotKeys.some(k => NEW_KEYS.has(k));
    if (hasNewKey) {
      console.log(`  ~ Tenant ${row.tenantId}: already on new keys, skip`);
      alreadyNew++;
      continue;
    }

    const oldSlots = adsConfig.slots;
    const newSlots = {};

    for (const [newKey, candidates] of Object.entries(MIGRATION_MAP)) {
      for (const oldKey of candidates) {
        const s = oldSlots[oldKey];
        if (s && s.slotId) {
          newSlots[newKey] = {
            slotId: s.slotId,
            format: FORMAT_FOR[newKey] ?? 'auto',
            enabled: typeof s.enabled === 'boolean' ? s.enabled : true,
          };
          break;
        }
      }
    }

    const newAdsConfig = {
      enabled: adsConfig.enabled ?? false,
      adsenseClientId: adsConfig.adsenseClientId ?? null,
      slots: newSlots,
    };

    const nextData = { ...data, adsConfig: newAdsConfig };
    await p.tenantSettings.update({
      where: { tenantId: row.tenantId },
      data: { data: nextData },
    });

    console.log(`  + Migrated tenant ${row.tenantId}`);
    const summary = Object.entries(newSlots)
      .map(([k, v]) => `    ${k}: ${v.slotId} (${v.format}, enabled=${v.enabled})`)
      .join('\n');
    console.log(summary);
    migrated++;
  }

  console.log(`\nDone. Migrated: ${migrated}, Already new: ${alreadyNew}, Skipped (no config): ${skipped}`);
  await p.$disconnect();
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
