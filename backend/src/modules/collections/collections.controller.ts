import { Request, Response, NextFunction } from 'express';
import { collectionsService } from './collections.service.js';

export class CollectionsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await collectionsService.listUserCollections(req.user!.id, {
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      return res.status(200).json({ success: true, data: result.collections, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await collectionsService.getCollectionById(req.user!.id, req.params.id);
      return res.status(200).json({ success: true, data: collection });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await collectionsService.createCollection(req.user!.id, req.body);
      return res.status(201).json({ success: true, data: collection });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await collectionsService.updateCollection(req.user!.id, req.params.id, req.body);
      return res.status(200).json({ success: true, data: collection });
    } catch (error) {
      next(error);
    }
  }

  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await collectionsService.startCollection(req.user!.id, req.params.id);
      return res.status(200).json({ success: true, data: collection, message: 'Coleta iniciada com sucesso.' });
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await collectionsService.pauseCollection(req.user!.id, req.params.id, req.body.reason);
      return res.status(200).json({ success: true, data: collection, message: 'Coleta pausada.' });
    } catch (error) {
      next(error);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await collectionsService.resumeCollection(req.user!.id, req.params.id);
      return res.status(200).json({ success: true, data: collection, message: 'Coleta retomada.' });
    } catch (error) {
      next(error);
    }
  }

  async finish(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await collectionsService.finishCollection(req.user!.id, req.params.id);
      return res.status(200).json({ success: true, data: collection, message: 'Coleta finalizada.' });
    } catch (error) {
      next(error);
    }
  }

  async reopen(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await collectionsService.reopenCollection(req.user!.id, req.params.id, req.body.reason);
      return res.status(200).json({ success: true, data: collection, message: 'Coleta reaberta com auditoria registrada.' });
    } catch (error) {
      next(error);
    }
  }
}

export const collectionsController = new CollectionsController();
