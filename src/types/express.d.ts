import 'express';

declare global {
  namespace Express {
    interface User {
      // Unified principal: either a real user or a guest device
      kind: 'user' | 'device';
      id: string; // user id or device id
      role?: { name: string; permissions?: any } | null;
      languageId?: string | null;
      userId?: string | null; // when kind === 'device' and later linked
    }
  }
}

export {};