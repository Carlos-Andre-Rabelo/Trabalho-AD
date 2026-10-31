import { Router } from 'express';
import { eventsController } from './events.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createEventSchema, voidEventSchema, listEventsQuerySchema } from './events.schema.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.post('/', validate(createEventSchema), (req, res, next) => eventsController.create(req, res, next));
router.get('/', validate(listEventsQuerySchema), (req, res, next) => eventsController.list(req, res, next));
router.get('/recent', (req, res, next) => eventsController.recent(req, res, next));
router.post('/:eventId/void', validate(voidEventSchema), (req, res, next) => eventsController.voidEvent(req, res, next));

export const eventsRouter = router;
