import { Router } from 'express';
import { collectionsController } from './collections.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createCollectionSchema,
  updateCollectionSchema,
  pauseCollectionSchema,
  reopenCollectionSchema,
  listCollectionsQuerySchema,
} from './collections.schema.js';

const router = Router();

// Todas as rotas de coletas requerem autenticação
router.use(authMiddleware);

router.get('/', validate(listCollectionsQuerySchema), (req, res, next) => collectionsController.list(req, res, next));
router.post('/', validate(createCollectionSchema), (req, res, next) => collectionsController.create(req, res, next));
router.get('/:id', (req, res, next) => collectionsController.getById(req, res, next));
router.patch('/:id', validate(updateCollectionSchema), (req, res, next) => collectionsController.update(req, res, next));
router.post('/:id/start', (req, res, next) => collectionsController.start(req, res, next));
router.post('/:id/pause', validate(pauseCollectionSchema), (req, res, next) => collectionsController.pause(req, res, next));
router.post('/:id/resume', (req, res, next) => collectionsController.resume(req, res, next));
router.post('/:id/finish', (req, res, next) => collectionsController.finish(req, res, next));
router.post('/:id/reopen', validate(reopenCollectionSchema), (req, res, next) => collectionsController.reopen(req, res, next));

export const collectionsRouter = router;
