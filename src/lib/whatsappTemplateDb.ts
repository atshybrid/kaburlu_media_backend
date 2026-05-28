import prisma from './prisma';
import { parseMetaTemplateRow } from './whatsappMeta';

const p: any = prisma;

export async function upsertTemplateFromMeta(t: any) {
  const data = parseMetaTemplateRow(t);
  const existing = await p.whatsappTemplate.findFirst({
    where: { OR: [{ templateId: data.templateId }, { name: data.name }] },
  });
  if (existing) {
    return p.whatsappTemplate.update({
      where: { id: existing.id },
      data,
    });
  }
  return p.whatsappTemplate.create({ data });
}

export async function syncAllTemplatesFromMeta(templates: any[]) {
  let created = 0;
  let updated = 0;
  for (const t of templates) {
    const data = parseMetaTemplateRow(t);
    const existing = await p.whatsappTemplate.findFirst({
      where: { OR: [{ templateId: data.templateId }, { name: data.name }] },
    });
    if (existing) {
      await p.whatsappTemplate.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await p.whatsappTemplate.create({ data });
      created++;
    }
  }
  const all = await p.whatsappTemplate.findMany({ orderBy: { name: 'asc' } });
  return { created, updated, total: templates.length, templates: all };
}

export async function updateTemplateStatusByName(
  name: string,
  patch: { status?: string; rejectedReason?: string | null; templateId?: string },
) {
  const row = await p.whatsappTemplate.findUnique({ where: { name } });
  if (!row) return null;
  return p.whatsappTemplate.update({
    where: { name },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.rejectedReason !== undefined ? { rejectedReason: patch.rejectedReason } : {}),
      ...(patch.templateId ? { templateId: patch.templateId } : {}),
      lastSyncedAt: new Date(),
    },
  });
}

export async function getApprovedTemplate(name: string, language?: string) {
  const where: any = { name, status: 'APPROVED' };
  if (language) where.language = language;
  return p.whatsappTemplate.findFirst({ where });
}
