/**
 * ePaper News Block — render + store rendered blocks.
 *
 * POST /epaper/blocks/render       — render article into block HTML/CSS
 * GET  /epaper/news-blocks         — list stored rendered blocks
 * GET  /epaper/news-blocks/:id     — get one stored block
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { resolveAdminTenantContext } from './adminTenantContext';
import { renderEpaperBlock, BLOCK_04A_RULES } from '../../lib/epaper/blocks';

function cleanText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s || null;
}

function articleInputFromBody(body: Record<string, any>) {
  const article = body.article || body;
  return {
    title: cleanText(article.title) || cleanText(article.heading) || '',
    subtitle: cleanText(article.subtitle) || cleanText(article.subTitle),
    image: cleanText(article.image) || cleanText(article.featuredImageUrl) || (Array.isArray(article.mediaUrls) ? article.mediaUrls[0] : null),
    highlights: Array.isArray(article.highlights)
      ? article.highlights.map(String).filter(Boolean)
      : Array.isArray(article.points)
        ? article.points.map(String).filter(Boolean)
        : [],
    content: String(article.content || '').trim(),
    dateline: cleanText(article.dateline),
  };
}

/** POST /epaper/blocks/render */
export async function renderNewsBlock(req: Request, res: Response) {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required (X-Tenant-Id)' });

    const body = req.body || {};
    const blockCode = cleanText(body.blockCode) || 'BLOCK-04A';
    const save = Boolean(body.save);
    const newspaperArticleId = cleanText(body.newspaperArticleId);
    const publicationEditionId = cleanText(body.publicationEditionId);
    const issueDateStr = cleanText(body.issueDate);
    const pageNumber = body.pageNumber != null ? Number(body.pageNumber) : null;

    const input = articleInputFromBody(body);
    if (!input.title) return res.status(400).json({ error: 'article.title is required' });
    if (!input.content) return res.status(400).json({ error: 'article.content is required' });

    // Load from DB if newspaperArticleId provided and article fields omitted
    if (newspaperArticleId && !body.article) {
      const row = await prisma.newspaperArticle.findFirst({
        where: { id: newspaperArticleId, tenantId: ctx.tenantId },
      });
      if (!row) return res.status(404).json({ error: 'NewspaperArticle not found' });
      Object.assign(input, {
        title: input.title || row.heading || row.title,
        subtitle: input.subtitle || row.subTitle,
        image: input.image || row.featuredImageUrl || row.mediaUrls?.[0] || null,
        highlights: input.highlights.length ? input.highlights : row.points || [],
        content: input.content || row.content,
        dateline: input.dateline || row.dateline,
      });
    }

    const rendered = renderEpaperBlock(blockCode, input);

    const template = await prisma.epaperBlockTemplate.findUnique({ where: { code: blockCode } });
    if (!template) {
      return res.status(404).json({
        error: `Block template ${blockCode} not found in DB. Run seed script first.`,
        render: rendered,
      });
    }

    const widthMm = blockCode === 'BLOCK-04A' ? BLOCK_04A_RULES.widthMm : template.widthInches * 25.4;
    const maxHeightMm = blockCode === 'BLOCK-04A' ? BLOCK_04A_RULES.maxHeightMm : template.maxHeightInches * 25.4;

    let saved = null;
    if (save && !rendered.isRejected) {
      const issueDate = issueDateStr ? new Date(`${issueDateStr}T00:00:00.000Z`) : null;
      saved = await prisma.epaperNewsBlock.create({
        data: {
          tenantId: ctx.tenantId,
          newspaperArticleId: newspaperArticleId || null,
          blockTemplateId: template.id,
          blockCode,
          publicationEditionId: publicationEditionId || null,
          issueDate,
          pageNumber: pageNumber && Number.isFinite(pageNumber) ? pageNumber : null,
          title: input.title,
          subtitle: input.subtitle,
          imageUrl: input.image,
          highlights: input.highlights,
          content: input.content,
          dateline: input.dateline,
          wordCount: rendered.wordCount,
          charCount: input.content.length,
          widthMm,
          maxHeightMm,
          estimatedHeightMm: rendered.estimatedHeightMm,
          html: rendered.html,
          css: rendered.css,
          isOverflow: rendered.isOverflow,
          isRejected: rendered.isRejected,
          rejectReason: rendered.rejectReason || null,
          renderMeta: {
            titleFontSizePx: rendered.titleFontSizePx,
            blockType: rendered.blockType,
          },
        },
      });
    }

    return res.json({
      ...rendered,
      saved: saved ? { id: saved.id, createdAt: saved.createdAt } : null,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('Unsupported block code')) return res.status(400).json({ error: msg });
    console.error('renderNewsBlock error:', e);
    return res.status(500).json({ error: 'Failed to render news block', details: msg });
  }
}

/** GET /epaper/news-blocks */
export async function listNewsBlocks(req: Request, res: Response) {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required (X-Tenant-Id)' });

    const q = req.query as any;
    const blockCode = cleanText(q.blockCode);
    const issueDate = cleanText(q.issueDate);
    const publicationEditionId = cleanText(q.publicationEditionId);

    const items = await prisma.epaperNewsBlock.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(blockCode ? { blockCode } : {}),
        ...(publicationEditionId ? { publicationEditionId } : {}),
        ...(issueDate ? { issueDate: new Date(`${issueDate}T00:00:00.000Z`) } : {}),
      },
      orderBy: [{ issueDate: 'desc' }, { pageNumber: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: Math.min(200, Math.max(1, Number(q.limit) || 50)),
    });

    return res.json({ tenantId: ctx.tenantId, total: items.length, items });
  } catch (e: any) {
    console.error('listNewsBlocks error:', e);
    return res.status(500).json({ error: 'Failed to list news blocks' });
  }
}

/** GET /epaper/news-blocks/:id */
export async function getNewsBlockById(req: Request, res: Response) {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    if (!ctx.tenantId) return res.status(400).json({ error: 'Tenant context required (X-Tenant-Id)' });

    const row = await prisma.epaperNewsBlock.findFirst({
      where: { id: String(req.params.id), tenantId: ctx.tenantId },
      include: {
        blockTemplate: { select: { id: true, code: true, name: true, columns: true, widthInches: true, maxHeightInches: true } },
        newspaperArticle: { select: { id: true, title: true, heading: true, status: true } },
      },
    });
    if (!row) return res.status(404).json({ error: 'News block not found' });

    return res.json({ block: row });
  } catch (e: any) {
    console.error('getNewsBlockById error:', e);
    return res.status(500).json({ error: 'Failed to get news block' });
  }
}
