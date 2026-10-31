import { Request, Response, NextFunction } from 'express';
import { proteinService } from './protein.service.js';

export class ProteinController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const measurement = await proteinService.create(req.user!.id, req.params.collectionId, req.body);
      return res.status(201).json({ success: true, data: measurement });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const measurements = await proteinService.list(req.user!.id, req.params.collectionId);
      return res.status(200).json({ success: true, data: measurements });
    } catch (error) {
      next(error);
    }
  }
}

export const proteinController = new ProteinController();
