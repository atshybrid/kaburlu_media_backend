import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find(a => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function run() {
  const prisma = new PrismaClient();
  const dryRun = hasFlag('dry-run');
  const limit = Number(getArg('limit') || 500);

  try {
    const pairs = await prisma.$queryRaw<Array<{ articleId: string; webId: string }>>`
      select a.id as "articleId", twa.id as "webId"
      from "TenantWebArticle" twa
      join "Article" a on (a."contentJson"->>'webArticleId') = twa.id
      where twa."categoryId" is null
      limit ${limit}
    `;

    let updated = 0;
    let skippedNoCategory = 0;
    let skippedAlreadySet = 0;

    for (const row of pairs) {
      const article = await prisma.article.findUnique({
        where: { id: row.articleId },
        include: { categories: { orderBy: { createdAt: 'asc' } } },
      });

      const categoryId = article?.categories?.[0]?.id;
      if (!categoryId) {
        skippedNoCategory++;
        continue;
      }

      if (dryRun) {
        updated++;
        continue;
      }

      const res = await prisma.tenantWebArticle.updateMany({
        where: { id: row.webId, categoryId: null },
        data: { categoryId },
      });

      if (res.count > 0) {
        updated += res.count;

        // Best-effort: also persist raw.categoryIds into the base article JSON so future steps stay consistent.
        try {
          const cj: any = (article as any)?.contentJson || {};
          const raw = cj.raw || {};
          const rawCatIds = Array.isArray(raw.categoryIds) ? raw.categoryIds : [];
          if (rawCatIds.length === 0) {
            const next = { ...cj, raw: { ...raw, categoryIds: [categoryId] } };
            await prisma.article.update({ where: { id: row.articleId }, data: { contentJson: next } });
          }
        } catch {
          // ignore
        }
      } else {
        skippedAlreadySet++;
      }
    }

    console.log('[backfill_webarticle_category]');
    console.log('dryRun:', dryRun);
    console.log('scanned:', pairs.length);
    console.log('updated:', updated);
    console.log('skippedNoCategory:', skippedNoCategory);
    console.log('skippedAlreadySet:', skippedAlreadySet);

    if (pairs.length === 0) {
      console.log('No TenantWebArticle rows found with categoryId NULL (that are linked via Article.contentJson.webArticleId).');
    }
  } catch (e: any) {
    console.error('Backfill error:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
