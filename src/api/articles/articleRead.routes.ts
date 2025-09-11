
import { Router } from 'express';
import passport from 'passport';
import { ArticleReadController } from './articleRead.controller';
import { validationMiddleware } from '../middlewares/validation.middleware';

const router = Router();
const controller = new ArticleReadController();

router.post('/', passport.authenticate('jwt', { session: false }), validationMiddleware, (req, res) => controller.markAsRead(req, res));
router.get('/:articleId', passport.authenticate('jwt', { session: false }), validationMiddleware, (req, res) => controller.getReadStatus(req, res));

export default router;
