import prisma from '../../lib/prisma';

export async function listInterests(userId: string) {
  return (prisma as any)['chatInterest'].findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { targetUser: { select: { id: true, mobileNumber: true, profile: { select: { fullName: true } } } } }
  });
}

export async function upsertInterest(userId: string, targetUserId: string, data: { followed?: boolean; muted?: boolean; notes?: string }) {
  if (userId === targetUserId) throw new Error('Cannot set interest on self');
  // ensure target exists
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error('Target user not found');
  return (prisma as any)['chatInterest'].upsert({
    where: { userId_targetUserId: { userId, targetUserId } },
    update: { followed: data.followed ?? true, muted: data.muted ?? false, notes: data.notes },
    create: { userId, targetUserId, followed: data.followed ?? true, muted: data.muted ?? false, notes: data.notes }
  });
}

export async function bulkUpsertInterest(userId: string, targetUserIds: string[], overrides: { followed?: boolean; muted?: boolean }) {
  const uniqueIds = Array.from(new Set(targetUserIds.filter(id => id !== userId)));
  if (!uniqueIds.length) return { count: 0 };
  const rows = await prisma.user.findMany({ where: { id: { in: uniqueIds } }, select: { id: true } });
  const existingIds = new Set(rows.map(r => r.id));
  const valid = uniqueIds.filter(id => existingIds.has(id));
  if (!valid.length) return { count: 0 };
  const followed = overrides.followed ?? true;
  const muted = overrides.muted ?? false;
  const ops = valid.map(targetUserId => (prisma as any)['chatInterest'].upsert({
    where: { userId_targetUserId: { userId, targetUserId } },
    update: { followed, muted },
    create: { userId, targetUserId, followed, muted }
  }));
  await prisma.$transaction(ops);
  return { count: valid.length };
}

export async function deleteInterest(userId: string, targetUserId: string) {
  await (prisma as any)['chatInterest'].delete({ where: { userId_targetUserId: { userId, targetUserId } } });
  return { success: true };
}
