import { Router } from 'express';
import { metricsController } from './metrics.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/metrics', (req, res, next) => metricsController.getMetrics(req, res, next));
router.get('/timeline', (req, res, next) => metricsController.getTimeline(req, res, next));
router.get('/export/raw.csv', (req, res, next) => metricsController.exportRawCsv(req, res, next));
router.get('/export/aggregated.csv', (req, res, next) => metricsController.exportAggregatedCsv(req, res, next));

export const metricsRouter = router;
