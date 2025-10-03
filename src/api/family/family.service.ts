import prisma from '../../lib/prisma';

export type FamilyDirection = 'both' | 'ancestors' | 'descendants';

interface BuildScopeOptions {
  rootUserId: string;
  direction: FamilyDirection;
  maxDepth: number; // any positive integer, we will guard on size not depth
  includeSelf?: boolean;
  hardMemberCap?: number; // optional guard, e.g., 5000
}

/**
 * BFS over FamilyRelation edges with direction-aware neighbor expansion.
 * - both: expands PARENT, CHILD, SIBLING, SPOUSE
 * - ancestors: expands CHILD only (move upwards)
 * - descendants: expands PARENT only (move downwards)
 */
export async function buildFamilyScopeUserIds(opts: BuildScopeOptions): Promise<{ members: string[]; truncated: boolean; depthReached: number; }>{
  const { rootUserId, direction, maxDepth, includeSelf = true, hardMemberCap = 10000 } = opts;
  if (maxDepth < 1) return { members: includeSelf ? [rootUserId] : [], truncated: false, depthReached: 0 };

  const seen = new Set<string>();
  const members: string[] = [];
  const queue: Array<{ id: string; depth: number }>= [];

  if (includeSelf) {
    seen.add(rootUserId);
    members.push(rootUserId);
  }
  queue.push({ id: rootUserId, depth: 0 });

  let truncated = false;
  let depthReached = 0;

  // Helper to pick which relation types to expand at each direction
  const allowedTypes: ('PARENT'|'CHILD'|'SIBLING'|'SPOUSE')[] =
    direction === 'both' ? ['PARENT','CHILD','SIBLING','SPOUSE'] : direction === 'ancestors' ? ['PARENT'] : ['CHILD'];

  while (queue.length) {
    const batch = queue.splice(0, 50); // process in small batches
    const userIds = batch.map(b => b.id);
    const depthById = new Map(batch.map(b => [b.id, b.depth] as const));

    // Fetch outgoing edges for frontier nodes
    const edges = await (prisma as any)['familyRelation'].findMany({
      where: { userId: { in: userIds }, relationType: { in: allowedTypes as any } },
      select: { userId: true, relatedUserId: true }
    });

    for (const e of edges) {
      const fromDepth = depthById.get(e.userId) || 0;
      const nextDepth = fromDepth + 1;
      if (nextDepth > maxDepth) continue;

      // Siblings/spouse are lateral; they still increase depth by 1 which is acceptable
      if (!seen.has(e.relatedUserId)) {
        seen.add(e.relatedUserId);
        members.push(e.relatedUserId);
        depthReached = Math.max(depthReached, nextDepth);
        if (members.length >= hardMemberCap) { truncated = true; break; }
        queue.push({ id: e.relatedUserId, depth: nextDepth });
      }
    }

    if (truncated) break;
  }

  return { members, truncated, depthReached };
}

export async function getFirebaseUids(userIds: string[]): Promise<{ id: string; firebaseUid: string | null }[]> {
  if (userIds.length === 0) return [];
  const rows = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firebaseUid: true } });
  return rows.map(r => ({ id: r.id, firebaseUid: r.firebaseUid || null }));
}
