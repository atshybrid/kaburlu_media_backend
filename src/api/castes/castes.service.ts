import prisma from '../../lib/prisma';

export async function listCastes() {
  return (prisma as any)['caste'].findMany({ orderBy: { name: 'asc' } });
}

export async function createCaste(name: string) {
  return (prisma as any)['caste'].create({ data: { name } });
}

export async function updateCaste(id: string, name?: string) {
  return (prisma as any)['caste'].update({ where: { id }, data: { name } });
}

export async function deleteCaste(id: string) {
  const count = await (prisma as any)['userProfile'].count({ where: { casteId: id } as any });
  if (count > 0) throw new Error('Cannot delete caste: profiles reference it');
  return (prisma as any)['caste'].delete({ where: { id } });
}

export async function listSubCastes(casteId?: string) {
  return (prisma as any)['subCaste'].findMany({
    where: casteId ? ({ casteId } as any) : {},
    orderBy: [{ casteId: 'asc' }, { name: 'asc' }]
  });
}

export async function createSubCaste(casteId: string, name: string) {
  return (prisma as any)['subCaste'].create({ data: { casteId, name } });
}

export async function updateSubCaste(id: string, name?: string) {
  return (prisma as any)['subCaste'].update({ where: { id }, data: { name } });
}

export async function deleteSubCaste(id: string) {
  const count = await (prisma as any)['userProfile'].count({ where: { subCasteId: id } as any });
  if (count > 0) throw new Error('Cannot delete subcaste: profiles reference it');
  return (prisma as any)['subCaste'].delete({ where: { id } });
}
