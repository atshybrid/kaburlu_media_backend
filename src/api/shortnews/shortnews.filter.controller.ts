import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get short news with filters: read/unread, location, category
export const getFilteredShortNews = async (req: Request, res: Response) => {
  try {
    const { userId, read, categoryId, latitude, longitude, address } = req.query;
    let where: any = {};

    if (categoryId) where.categoryId = categoryId;
    if (address) where.address = address;
    if (latitude && longitude) {
      where.latitude = Number(latitude);
      where.longitude = Number(longitude);
    }

    // Read/unread logic (assumes a join table ShortNewsRead)
    if (read !== undefined && userId) {
      // Read/unread logic using ShortNewsRead join table
      const readIds = await prisma.shortNewsRead.findMany({
        where: { userId: String(userId) },
        select: { shortNewsId: true },
      });
      const ids = readIds.map((r: { shortNewsId: string }) => r.shortNewsId);
      if (read === 'true') {
        where.id = { in: ids };
      } else {
        where.id = { notIn: ids };
      }
    }

    const news = await prisma.shortNews.findMany({ where });
    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch filtered short news' });
  }
};
