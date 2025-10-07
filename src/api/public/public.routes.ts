import { Router } from 'express';
import { tenantResolver } from '../../middleware/tenantResolver';

const router = Router();

// Apply resolver only to this public router
router.use(tenantResolver);

// Placeholder endpoints; real implementations added in next step
router.get('/_health', (req, res) => {
  res.json({ ok: true, domain: (res.locals as any).domain?.domain, tenant: (res.locals as any).tenant?.slug });
});

export default router;