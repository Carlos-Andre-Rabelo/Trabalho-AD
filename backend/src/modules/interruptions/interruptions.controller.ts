import { Request, Response, NextFunction } from 'express';
import { interruptionsService } from './interruptions.service.js';

export class InterruptionsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await interruptionsService.create(req.user!.id, req.params.collectionId, req.body);
      return res.status(201).json({ success: true, data: item, message: 'Ocorrência registrada.' });
    } catch (error) {
      next(error);
    }
  }

  async finish(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await interruptionsService.finish(req.user!.id, req.params.collectionId, req.params.interruptionId);
      return res.status(200).json({ success: true, data: item, message: 'Ocorrência finalizada.' });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await interruptionsService.list(req.user!.id, req.params.collectionId);
      return res.status(200).json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
}

export const interruptionsController = new InterruptionsController();
