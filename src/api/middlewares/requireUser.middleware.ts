import { Request, Response, NextFunction } from 'express';

export function requireRealUser(req: Request, res: Response, next: NextFunction) {
  const principal = req.user as any;
  if (!principal || principal.kind !== 'user') {
    return res.status(403).json({ message: 'Action requires a registered user account.' });
  }
  next();
}