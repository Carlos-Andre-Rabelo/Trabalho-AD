import { Router } from 'express';
import { interruptionsController } from './interruptions.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.post('/', (req, res, next) => interruptionsController.create(req, res, next));
router.get('/', (req, res, next) => interruptionsController.list(req, res, next));
router.post('/:interruptionId/finish', (req, res, next) => interruptionsController.finish(req, res, next));

export const interruptionsRouter = router;
