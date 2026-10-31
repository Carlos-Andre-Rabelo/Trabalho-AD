import { Router } from 'express';
import { proteinController } from './protein.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.post('/', (req, res, next) => proteinController.create(req, res, next));
router.get('/', (req, res, next) => proteinController.list(req, res, next));

export const proteinRouter = router;
