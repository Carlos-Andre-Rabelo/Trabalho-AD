import { Request, Response, NextFunction } from 'express';
import { servicesService } from './services.service.js';

export class ServicesController {
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const interval = await servicesService.startService(req.user!.id, req.params.collectionId, req.body);
      return res.status(201).json({ success: true, data: interval, message: 'Atendimento cronometrado iniciado.' });
    } catch (error) {
      next(error);
    }
  }

  async finish(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await servicesService.finishService(req.user!.id, req.params.collectionId, req.body);
      if (result.isReplay) {
        res.setHeader('X-Idempotent-Replay', 'true');
      }
      return res.status(200).json({ success: true, data: result, message: 'Atendimento cronometrado concluído.' });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await servicesService.cancelActiveService(req.user!.id, req.params.collectionId, req.body.attendantId);
      return res.status(200).json({ success: true, data: result, message: 'Atendimento em andamento cancelado.' });
    } catch (error) {
      next(error);
    }
  }

  async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const active = await servicesService.getActiveServices(req.user!.id, req.params.collectionId);
      return res.status(200).json({ success: true, data: active });
    } catch (error) {
      next(error);
    }
  }
}

export const servicesController = new ServicesController();
