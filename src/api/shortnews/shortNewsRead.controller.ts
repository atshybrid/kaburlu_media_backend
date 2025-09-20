import { Request, Response } from 'express';
import { ShortNewsReadService } from './shortNewsRead.service';
import prisma from '../../lib/prisma';

function isNotFound(e: any) { return e && typeof e === 'object' && /ShortNews not found:/.test(String(e.message)); }

export class ShortNewsReadController {
  private service = new ShortNewsReadService();

  recordProgress = async (req: Request, res: Response) => {
    try {
      // Resolve userId (device principal fallback)
      let userId: string | undefined;
      if (req.user && typeof req.user === 'object' && 'id' in req.user) {
        const principal: any = req.user;
        userId = principal.kind === 'device' && principal.userId ? principal.userId : principal.id;
      }
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { shortNewsId, deltaTimeMs, maxScrollPercent, ended } = req.body || {};
  if (!shortNewsId) return res.status(400).json({ error: 'shortNewsId required' });
  const result = await this.service.markProgress(userId, { shortNewsId, deltaTimeMs, maxScrollPercent, ended });
  // Attach unified ContentRead snapshot (best effort)
  let contentRead: any = null;
  try {
    contentRead = await (prisma as any).contentRead.findUnique?.({
      where: { userId_contentType_contentId: { userId, contentType: 'SHORTNEWS', contentId: shortNewsId } },
      select: { totalTimeMs: true, maxScrollPercent: true, completed: true, sessionsCount: true, updatedAt: true }
    });
  } catch {}
  return res.status(200).json({ updated: [result], contentRead });
    } catch (e) {
      if (isNotFound(e)) return res.status(404).json({ error: (e as Error).message });
      return res.status(500).json({ error: (e as Error).message });
    }
  };
}

export default ShortNewsReadController;
