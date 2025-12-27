import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
 
import { sanitizeHtmlAllowlist, slugFromAnyLanguage, trimWords } from '../../lib/sanitize';
import { buildNewsArticleJsonLd } from '../../lib/seo';
import { resolveOrCreateCategoryIdByName } from '../../lib/categoryAuto';

function wordCount(text: string): number {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function nowIsoIST(): string {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (5.5 * 60 * 60 * 1000));
    return ist.toISOString().replace('Z', '+05:30');
}

function monthNameByLang(monthIndex: number, languageCode?: string): string {
    const lc = String(languageCode || '').trim().toLowerCase();
    // Abbreviations commonly used in Telugu news. (Simple mapping; can be refined later.)
    const te = ['జన', 'ఫిబ్ర', 'మార్చి', 'ఏప్రి', 'మే', 'జూన్', 'జూలై', 'ఆగ', 'సెప్టెం', 'అక్టో', 'నవం', 'డిసెం'];
    const en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const list = lc === 'te' ? te : en;
    return list[monthIndex] || '';
}

function formatDateline(placeLabel: string | null, publishedAtIso?: string, languageCode?: string): string {
    const date = publishedAtIso ? new Date(publishedAtIso) : new Date();
    const d = date.getDate();
    const m = monthNameByLang(date.getMonth(), languageCode);
    const y = date.getFullYear();
    const head = placeLabel ? `${placeLabel}, ` : '';
    return `${head}${m} ${d}, ${y}`.trim();
}

async function resolveLocationRef(location: any): Promise<any> {
    const loc = location && typeof location === 'object' ? location : {};

    const villageId = loc.villageId ? String(loc.villageId) : undefined;
    const stateId = loc.stateId ? String(loc.stateId) : undefined;
    const districtId = loc.districtId ? String(loc.districtId) : undefined;
    const mandalId = loc.mandalId ? String(loc.mandalId) : undefined;
    // Optional fine-grained name only (no DB table for village currently)
    const villageName = loc.villageName ? String(loc.villageName).trim() : undefined;

    const village = villageId
        ? await (prisma as any).village.findUnique({
            where: { id: villageId },
            select: { id: true, name: true, mandal: { select: { id: true, name: true, district: { select: { id: true, name: true, state: { select: { id: true, name: true } } } } } } },
        }).catch(() => null)
        : null;

    const effectiveMandalId = mandalId || village?.mandal?.id;
    const effectiveDistrictId = districtId || village?.mandal?.district?.id;
    const effectiveStateId = stateId || village?.mandal?.district?.state?.id;

    const state = effectiveStateId ? await prisma.state.findUnique({ where: { id: effectiveStateId }, select: { id: true, name: true } }).catch(() => null) : null;
    const district = effectiveDistrictId ? await prisma.district.findUnique({ where: { id: effectiveDistrictId }, select: { id: true, name: true, stateId: true } }).catch(() => null) : null;
    const mandal = effectiveMandalId ? await prisma.mandal.findUnique({ where: { id: effectiveMandalId }, select: { id: true, name: true, districtId: true } }).catch(() => null) : null;

    // Best-effort fallback names from payload
    const fallbackCity = String(loc.city || loc.placeName || loc.place || '').trim() || undefined;

    const stateName = state?.name || (village?.mandal?.district?.state?.name) || (loc.stateName ? String(loc.stateName).trim() : undefined);
    const districtName = district?.name || (village?.mandal?.district?.name) || (loc.districtName ? String(loc.districtName).trim() : undefined);
    const mandalName = mandal?.name || (village?.mandal?.name) || (loc.mandalName ? String(loc.mandalName).trim() : undefined);
    const resolvedVillageName = village?.name || villageName;

    // Prefer most specific name for UI + placeName
    const displayName = resolvedVillageName || mandalName || districtName || stateName || fallbackCity || null;
    const addressParts = [districtName, stateName].filter(Boolean);
    const address = addressParts.length ? addressParts.join(', ') : null;

    // Prefer most specific ID for filtering; for village we only have a name
    const placeId = villageId || effectiveMandalId || effectiveDistrictId || effectiveStateId || (loc.placeId ? String(loc.placeId) : null);

    return {
        villageId: villageId || null,
        villageName: resolvedVillageName || null,
        stateId: effectiveStateId || null,
        stateName: stateName || null,
        districtId: effectiveDistrictId || null,
        districtName: districtName || null,
        mandalId: effectiveMandalId || null,
        mandalName: mandalName || null,
        city: fallbackCity || null,
        placeId,
        displayName,
        address,
    };
}

function normalizeStatus(input: any): string {
    const s = String(input || '').trim().toLowerCase();
    if (s === 'published' || s === 'publish') return 'PUBLISHED';
    if (s === 'pending' || s === 'review') return 'PENDING';
    if (s === 'draft' || !s) return 'DRAFT';
    return s.toUpperCase();
}

function buildWebJsonFromNewspaperPayload(payload: any, opts?: { domain?: string | null; languageCode?: string; categoryIds?: string[]; publishedAt?: string | null }) {
    const title = String(payload?.title || '').trim();
    const subTitle = payload?.subTitle ? String(payload.subTitle).trim() : '';
    const lead = payload?.lead ? String(payload.lead).trim() : '';
    const items = Array.isArray(payload?.content) ? payload.content : [];
    const paragraphs = items
        .filter((x: any) => x && typeof x === 'object' && String(x.type || '').toLowerCase() === 'paragraph')
        .map((x: any) => String(x.text || '').trim())
        .filter(Boolean);
    const bulletPoints = Array.isArray(payload?.bulletPoints) ? payload.bulletPoints.map((s: any) => String(s || '').trim()).filter(Boolean) : [];
    const tags = Array.isArray(payload?.tags) ? payload.tags.map((s: any) => String(s || '').trim()).filter(Boolean) : [];
    const metaTitle = payload?.seo?.metaTitle ? String(payload.seo.metaTitle).trim() : '';
    const metaDescription = payload?.seo?.metaDescription ? String(payload.seo.metaDescription).trim() : '';
    const coverImageUrl = payload?.media?.images?.[0]?.url ? String(payload.media.images[0].url) : '';

    const blocks: any[] = [];
    blocks.push({ type: 'h1', text: title });
    if (subTitle) blocks.push({ type: 'h2', text: subTitle });
    if (lead) blocks.push({ type: 'p', text: lead });
    for (const p of paragraphs) blocks.push({ type: 'p', text: p });
    if (bulletPoints.length) blocks.push({ type: 'list', style: 'unordered', items: bulletPoints });

    const contentHtml = sanitizeHtmlAllowlist(
        [
            `<h1>${title}</h1>`,
            subTitle ? `<h2>${subTitle}</h2>` : '',
            lead ? `<p>${lead}</p>` : '',
            ...paragraphs.map((p: any) => `<p>${p}</p>`),
            bulletPoints.length ? `<ul>${bulletPoints.map((s: any) => `<li>${s}</li>`).join('')}</ul>` : ''
        ].filter(Boolean).join('')
    );
    const plainText = [title, subTitle, lead, ...paragraphs, ...(bulletPoints.length ? bulletPoints.map((s: any) => `- ${s}`) : [])]
        .filter(Boolean)
        .join('\n');

    const domainName = opts?.domain ? String(opts.domain).trim() : '';
    const canonicalUrl = domainName ? `https://${domainName}/articles/${slugFromAnyLanguage(title, 120)}` : `/articles/${slugFromAnyLanguage(title, 120)}`;
    const jsonLd = buildNewsArticleJsonLd({
        headline: title,
        description: metaDescription || trimWords(plainText, 24).slice(0, 160),
        canonicalUrl,
        imageUrls: coverImageUrl ? [coverImageUrl] : [],
        languageCode: opts?.languageCode || undefined,
        datePublished: opts?.publishedAt || undefined,
        dateModified: nowIsoIST(),
        keywords: (tags || []).slice(0, 10),
    });

    return {
        title,
        slug: slugFromAnyLanguage(title, 120),
        contentHtml,
        plainText,
        languageCode: opts?.languageCode || '',
        categories: Array.isArray(opts?.categoryIds) ? opts!.categoryIds : [],
        tags: tags.slice(0, 10),
        meta: {
            seoTitle: metaTitle || title.slice(0, 60),
            metaDescription: metaDescription || trimWords(plainText, 24).slice(0, 160)
        },
        // Keep field shape compatible with existing TenantWebArticle payloads.
        jsonLd,
        coverImage: coverImageUrl ? { url: coverImageUrl } : null,
        blocks,
        audit: {
            createdAt: nowIsoIST(),
            updatedAt: nowIsoIST()
        }
    };
}

async function resolveDomainIdForTenant(tenantId: string, requestedDomainId?: string | null, domainNameFromLocals?: string | null): Promise<{ domainId: string | null; domainName: string | null }> {
    const reqId = requestedDomainId ? String(requestedDomainId).trim() : '';
    if (reqId) {
        const dom = await prisma.domain.findFirst({ where: { id: reqId, tenantId }, select: { id: true, domain: true, status: true } }).catch(() => null);
        if (dom?.id) return { domainId: dom.id, domainName: dom.domain };
    }
    const dn = domainNameFromLocals ? String(domainNameFromLocals).trim() : '';
    if (dn) {
        const dom = await prisma.domain.findFirst({ where: { domain: dn, tenantId }, select: { id: true, domain: true, status: true } }).catch(() => null);
        if (dom?.id) return { domainId: dom.id, domainName: dom.domain };
    }
    const primary = await prisma.domain.findFirst({
        where: { tenantId, status: 'ACTIVE' as any },
        orderBy: [{ isPrimary: 'desc' as any }, { createdAt: 'desc' as any }],
        select: { id: true, domain: true },
    }).catch(() => null);
    if (primary?.id) return { domainId: primary.id, domainName: primary.domain };
    const anyDom = await prisma.domain.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' }, select: { id: true, domain: true } }).catch(() => null);
    return { domainId: anyDom?.id || null, domainName: anyDom?.domain || null };
}

// Helper to check access (similar to articles.ai.controller)
async function resolveTenantScope(req: Request): Promise<{ tenantId?: string, error?: string, status?: number }> {
    const user: any = (req as any).user;
    if (!user || !user.role) return { error: 'Unauthorized', status: 401 };

    // Super Admin can see all if no specific tenant requested, or scope to requested
    if (user.role.name === 'SUPER_ADMIN') {
        const tId = req.query.tenantId as string;
        return { tenantId: tId }; // undefined means global list
    }

    // Reporters/Admins are scoped to their tenant
    if (['TENANT_ADMIN', 'REPORTER', 'ADMIN_EDITOR', 'NEWS_MODERATOR'].includes(user.role.name)) {
        const rep = await (prisma as any).reporter.findFirst({ where: { userId: user.id }, select: { tenantId: true } });
        if (!rep?.tenantId) return { error: 'Reporter profile not linked to tenant', status: 403 };
        return { tenantId: rep.tenantId };
    }

    return { error: 'Forbidden', status: 403 };
}

function generateExternalArticleId(tenantId: string, seq: number): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const n = String(seq).padStart(4, '0');
    // tenantId not embedded to keep id short and user-facing
    return `ART${yyyy}${mm}${dd}${n}`;
}

export const createNewspaperArticle = async (req: Request, res: Response) => {
    try {
        const scope = await resolveTenantScope(req);
        if (scope.error) return res.status(scope.status!).json({ error: scope.error });
        if (!scope.tenantId) return res.status(400).json({ error: 'tenantId scope required' });

        const user: any = (req as any).user;
        const authorId: string = user.id;
        const tenantId = scope.tenantId;

        const body = req.body || {};
        const requestedDomainId = body.domainId != null ? String(body.domainId).trim() : null;
        const domainNameFromLocals = (res as any)?.locals?.domain?.domain ? String((res as any).locals.domain.domain) : null;
        const languageCode = String(body.language || body.languageCode || '').trim() || undefined;
        const title = String(body.title || '').trim();
        const subTitle = body.subTitle != null ? String(body.subTitle).trim() : undefined;
        const heading = String(body.heading || title || '').trim();
        const publishedAt = body.publishedAt ? String(body.publishedAt) : undefined;
        const status = normalizeStatus(body.status);
        const shouldPublish = status === 'PUBLISHED';
        const location = body.location || {};
        const locationRef = await resolveLocationRef(location);
        const placeName = String(locationRef.displayName || '').trim() || null;
        const dateline = String(body.dateLine || body.dateline || '').trim() || formatDateline(placeName, publishedAt, languageCode);
        const bulletPoints = Array.isArray(body.bulletPoints)
            ? body.bulletPoints.map((s: any) => String(s || '').trim()).filter(Boolean)
            : [];
        const contentArr = Array.isArray(body.content) ? body.content : [];
        const paragraphTexts = contentArr
            .filter((x: any) => x && typeof x === 'object' && String(x.type || '').toLowerCase() === 'paragraph')
            .map((x: any) => String(x.text || '').trim())
            .filter(Boolean);
        const lead = body.lead != null ? String(body.lead).trim() : '';
        const contentText = [lead, ...paragraphTexts].filter(Boolean).join('\n\n').trim();

        const callbackUrlRaw = body.callbackUrl != null ? String(body.callbackUrl).trim() : '';
        const callbackUrl = callbackUrlRaw && /^https?:\/\//i.test(callbackUrlRaw) ? callbackUrlRaw : null;
        const callbackUrlAccepted = Boolean(callbackUrl);

        if (!title) return res.status(400).json({ error: 'title is required' });
        if (title.length > 50) return res.status(400).json({ error: 'title max 50 characters' });
        if (subTitle && subTitle.length > 50) return res.status(400).json({ error: 'subTitle max 50 characters' });
        if (!heading) return res.status(400).json({ error: 'heading is required (or provide title)' });

        if (contentText && wordCount(contentText) > 2000) {
            return res.status(400).json({ error: 'content max 2000 words' });
        }

        if (bulletPoints.length > 5) {
            return res.status(400).json({ error: 'bulletPoints max 5 items' });
        }
        for (const p of bulletPoints) {
            const wc = wordCount(p);
            if (wc > 5) return res.status(400).json({ error: 'Each bulletPoint max 5 words', bulletPoint: p });
        }

        // Tenant-level AI feature flag ONLY (no reporter subscription check)
        // Superadmin testing override (does NOT persist):
        //   POST /articles/newspaper?tenantId=...&forceAiRewriteEnabled=true|false
        const forceAiRewriteEnabledRaw = (req.query as any)?.forceAiRewriteEnabled;
        const hasForce = typeof forceAiRewriteEnabledRaw !== 'undefined';
        const forceAiRewriteEnabledStr = hasForce
            ? String(forceAiRewriteEnabledRaw).trim().toLowerCase()
            : undefined;

        const forceParsed = hasForce
            ? (forceAiRewriteEnabledStr === 'true' || forceAiRewriteEnabledStr === '1' || forceAiRewriteEnabledStr === 'yes')
            : undefined;

        // Safety rule:
        // - Anyone can force LIMITED (false) to reduce cost/usage.
        // - Only SUPER_ADMIN can force FULL (true) since it can increase usage/billing.
        if (hasForce && forceParsed === true && user?.role?.name !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'forceAiRewriteEnabled=true is SUPER_ADMIN only' });
        }

        const tenantFlags = await (prisma as any).tenantFeatureFlags.findUnique({ where: { tenantId } }).catch(() => null);
        const storedEnabled = tenantFlags?.aiArticleRewriteEnabled !== false;

        const tenantAiRewriteEnabled = hasForce
            ? Boolean(forceParsed)
            : storedEnabled;

        const aiMode = tenantAiRewriteEnabled ? 'FULL' : 'LIMITED';

        // Resolve languageId
        let languageId: string | undefined;
        if (languageCode) {
            const lang = await prisma.language.findUnique({ where: { code: languageCode } });
            if (!lang) return res.status(400).json({ error: 'Invalid language code' });
            languageId = lang.id;
        }

        // Attempt to infer categoryIds from payload (optional)
        const categoryIds: string[] = [];
        if (body.categoryId) categoryIds.push(String(body.categoryId));
        // category name is optional; we only connect if we can find a matching category
        if (!categoryIds.length && body.category) {
            const name = String(body.category).trim();
            if (name) {
                const resolved = await resolveOrCreateCategoryIdByName({
                    suggestedName: name,
                    languageCode: languageCode || undefined,
                    similarityThreshold: 0.9,
                    autoCreate: true,
                }).catch(() => null);
                if (resolved?.categoryId) categoryIds.push(resolved.categoryId);
            }
        }

        // Always queue shortnews; worker will infer/fallback category when missing.
        const shortQueued = true;
    const domainResolved = await resolveDomainIdForTenant(tenantId, requestedDomainId, domainNameFromLocals);
    const domainId = domainResolved.domainId;
    const domainName = domainResolved.domainName;

        // Collect image/video URLs (optional)
        const mediaUrlsSet = new Set<string>();
        const addUrl = (u: any) => {
            const url = String(u || '').trim();
            if (!url) return;
            if (!/^https?:\/\//i.test(url)) return;
            mediaUrlsSet.add(url);
        };

        // Common payload forms
        addUrl(body.coverImageUrl);
        if (Array.isArray(body.images)) for (const u of body.images) addUrl(u);
        if (Array.isArray(body.mediaUrls)) for (const u of body.mediaUrls) addUrl(u);

        // Structured media
        const mediaImages = Array.isArray(body?.media?.images) ? body.media.images : [];
        for (const img of mediaImages) addUrl(img?.url);
        const mediaVideos = Array.isArray(body?.media?.videos) ? body.media.videos : [];
        for (const v of mediaVideos) addUrl(v?.url);

        // Inline blocks
        for (const item of contentArr) {
            if (!item || typeof item !== 'object') continue;
            const t = String((item as any).type || '').toLowerCase();
            if (t === 'image' || t === 'img') addUrl((item as any).url || (item as any).src);
            if (t === 'video') addUrl((item as any).url || (item as any).src);
        }

        const images: string[] = Array.from(mediaUrlsSet);

        // Generate external ID (best-effort, tenant-local, day-scoped)
        const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
        const todayCount = await (prisma as any).newspaperArticle.count({ where: { tenantId, createdAt: { gte: dayStart, lte: dayEnd } } });
        const externalArticleId = generateExternalArticleId(tenantId, Number(todayCount) + 1);

        // Create base Article for unified pipeline and future web/short outputs
        const baseArticle = await prisma.article.create({
            data: {
                title,
                content: contentText || title,
                type: 'reporter',
                status: shouldPublish ? 'PUBLISHED' : 'DRAFT',
                authorId,
                tenantId,
                languageId,
                images,
                tags: Array.isArray(body.tags) ? body.tags.map((t: any) => String(t || '').trim()).filter(Boolean).slice(0, 10) : [],
                categories: categoryIds.length ? { connect: categoryIds.map(id => ({ id })) } : undefined as any,
                contentJson: {
                    externalArticleId,
                    source: 'newspaper.post',
                    // aiQueue.worker expects a normalized payload in contentJson.raw
                    raw: {
                        title,
                        content: contentText,
                        categoryIds,
                        languageCode: languageCode || '',
                        domainId,
                        images,
                        coverImageUrl: images?.[0] || null,
                        locationRef,
                        publishedAt,
                        dateline,
                        bulletPoints,
                    },
                    rawNewspaper: body,
                    location,
                    locationRef,
                    callbackUrl,
                    aiDecision: {
                        mode: aiMode,
                        tenantAiRewriteEnabled,
                        // Which prompts will run (single call in worker)
                        prompts: {
                            env: ['AI_REWRITE_PROMPT_TRUE', 'AI_REWRITE_PROMPT_FALSE'],
                            dbKey: ['ai_rewrite_prompt_true', 'ai_rewrite_prompt_false'],
                        }
                    },
                    // In FULL: generate newspaper+web+short using TRUE prompt.
                    // In LIMITED: generate SEO+short using FALSE prompt (category may be inferred if missing).
                    aiQueue: { web: true, short: shortQueued, newspaper: aiMode === 'FULL' },
                    aiStatus: 'PENDING',
                    aiSkipReason: null,
                }
            }
        });

        // LIMITED mode: create a TenantWebArticle immediately with the original posted content.
        // The worker will later update SEO fields (and publish/desk status based on base Article status).
        if (aiMode === 'LIMITED') {
            try {
                const webJson = buildWebJsonFromNewspaperPayload(body, { domain: domainName, languageCode, categoryIds, publishedAt: publishedAt || null });
                const web = await prisma.tenantWebArticle.create({
                    data: {
                        tenantId,
                        domainId: domainId || undefined,
                        authorId,
                        languageId,
                        title: String(webJson.title || title),
                        slug: String(webJson.slug || slugFromAnyLanguage(title, 120)),
                        status: shouldPublish ? 'PUBLISHED' : 'DRAFT',
                        categoryId: categoryIds?.[0] ? String(categoryIds[0]) : undefined,
                        contentJson: webJson,
                        seoTitle: webJson?.meta?.seoTitle,
                        metaDescription: webJson?.meta?.metaDescription,
                        jsonLd: webJson?.jsonLd || undefined,
                        tags: Array.isArray(webJson?.tags) ? webJson.tags : [],
                        coverImageUrl: (images?.[0] || undefined),
                        publishedAt: shouldPublish ? (publishedAt ? new Date(publishedAt) as any : new Date()) : null,
                    } as any
                });
                await prisma.article.update({
                    where: { id: baseArticle.id },
                    data: {
                        contentJson: {
                            ...(baseArticle as any).contentJson,
                            webArticleId: web.id,
                        }
                    }
                });
            } catch {
                // best-effort; keep pipeline moving
            }
        }

        // Create NewspaperArticle (print form)
        const created = await (prisma as any).newspaperArticle.create({
            data: {
                tenantId,
                authorId,
                languageId: languageId || undefined,
                baseArticleId: baseArticle.id,
                title,
                subTitle: subTitle || null,
                heading,
                points: bulletPoints,
                dateline,
                content: contentText || title,
                placeName,
                status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
            }
        });

        // Postgres-only queue: aiQueue.worker / aiQueue.cron will pick this up.
        return res.status(202).json({
            success: true,
            message: aiMode === 'FULL'
                ? 'Newspaper article stored; FULL AI rewrite queued'
                : (categoryIds.length ? 'Newspaper article stored; LIMITED AI (SEO + shortnews) queued' : 'Newspaper article stored; LIMITED AI (SEO + shortnews) queued (category will be inferred)'),
            externalArticleId,
            articleId: baseArticle.id,
            baseArticleId: baseArticle.id,
            newspaperArticleId: created.id,
            tenantAiRewriteEnabled,
            aiMode,
            queued: { web: true, short: shortQueued, newspaper: aiMode === 'FULL' },
            statusUrl: `/articles/${baseArticle.id}/ai-status`,
            callbackUrlAccepted,
        });
    } catch (e) {
        console.error('createNewspaperArticle error', e);
        return res.status(500).json({ error: 'Failed to create newspaper article' });
    }
};

export const listNewspaperArticles = async (req: Request, res: Response) => {
    try {
        const scope = await resolveTenantScope(req);
        if (scope.error) return res.status(scope.status!).json({ error: scope.error });

        const { date, status, limit = '50', offset = '0' } = req.query;

        const where: any = {};
        if (scope.tenantId) where.tenantId = scope.tenantId;
        if (status) where.status = String(status).toUpperCase();

        if (date) {
            // Filter by specific date (start to end of day in UTC roughly or exact match if needed)
            // Ideally should accept start/end range, but simple date string match yyyy-mm-dd
            const d = new Date(String(date));
            if (!isNaN(d.getTime())) {
                const next = new Date(d); next.setDate(d.getDate() + 1);
                where.createdAt = { gte: d, lt: next };
            }
        }

        const [total, items] = await Promise.all([
            (prisma as any).newspaperArticle.count({ where }),
            (prisma as any).newspaperArticle.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
                skip: Number(offset),
                include: { author: { select: { id: true, profile: { select: { fullName: true } } } } }
            })
        ]);

        res.json({ total, items });
    } catch (e) {
        console.error('listNewspaperArticles error', e);
        res.status(500).json({ error: 'Failed' });
    }
};

export const getNewspaperArticle = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const scope = await resolveTenantScope(req);
        if (scope.error) return res.status(scope.status!).json({ error: scope.error });

        const item = await (prisma as any).newspaperArticle.findUnique({
            where: { id },
            include: { baseArticle: { select: { contentJson: true } } }
        });

        if (!item) return res.status(404).json({ error: 'Not found' });
        if (scope.tenantId && item.tenantId !== scope.tenantId) return res.status(403).json({ error: 'Access denied' });

        res.json(item);
    } catch (e) {
        console.error('getNewspaperArticle error', e);
        res.status(500).json({ error: 'Failed' });
    }
};

export const updateNewspaperArticle = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const scope = await resolveTenantScope(req);
        if (scope.error) return res.status(scope.status!).json({ error: scope.error });

        const existing = await (prisma as any).newspaperArticle.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (scope.tenantId && existing.tenantId !== scope.tenantId) return res.status(403).json({ error: 'Access denied' });

        const { title, heading, subTitle, points, dateline, placeName, content, status } = req.body;

        const updated = await (prisma as any).newspaperArticle.update({
            where: { id },
            data: {
                title: title !== undefined ? title : undefined,
                heading: heading !== undefined ? heading : undefined,
                subTitle: subTitle !== undefined ? subTitle : undefined,
                points: Array.isArray(points) ? points : undefined,
                dateline: dateline !== undefined ? dateline : undefined,
                placeName: placeName !== undefined ? placeName : undefined,
                content: content !== undefined ? content : undefined,
                status: status !== undefined ? status : undefined,
            }
        });

        res.json(updated);
    } catch (e) {
        console.error('updateNewspaperArticle error', e);
        res.status(500).json({ error: 'Failed' });
    }
};
