import { Router } from 'express';
import { servicesController } from './services.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.post('/start', (req, res, next) => servicesController.start(req, res, next));
router.post('/finish', (req, res, next) => servicesController.finish(req, res, next));
router.post('/cancel', (req, res, next) => servicesController.cancel(req, res, next));
router.get('/active', (req, res, next) => servicesController.getActive(req, res, next));

export const servicesRouter = router;
