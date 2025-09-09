
import { Router } from 'express';
import * as userController from './users.controller';

const router = Router();

router.post('/', userController.createUser);
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.post('/upgrade-guest', userController.upgradeGuest);

export default router;
