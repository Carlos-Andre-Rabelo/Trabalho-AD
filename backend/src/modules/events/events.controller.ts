import { Request, Response, NextFunction } from 'express';
import { eventsService } from './events.service.js';

export class EventsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { event, isReplay } = await eventsService.createEvent(req.user!.id, req.params.collectionId, req.body);
      if (isReplay) {
        res.setHeader('X-Idempotent-Replay', 'true');
        return res.status(200).json({
          success: true,
          data: event,
          message: 'Evento recuperado por chave de idempotência (já registrado anteriormente).',
        });
      }
      return res.status(201).json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  }

  async voidEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.voidEvent(req.user!.id, req.params.collectionId, req.params.eventId, req.body);
      return res.status(200).json({ success: true, data: event, message: 'Evento anulado com sucesso e registrado na auditoria.' });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await eventsService.listEvents(req.user!.id, req.params.collectionId, {
        eventType: req.query.eventType as any,
        attendantId: req.query.attendantId as string,
        includeVoided: req.query.includeVoided as any,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      return res.status(200).json({ success: true, data: result.events, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async recent(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await eventsService.getRecentEvents(req.user!.id, req.params.collectionId, 10);
      return res.status(200).json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  }
}

export const eventsController = new EventsController();
