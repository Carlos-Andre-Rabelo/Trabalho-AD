import { Request, Response, NextFunction } from 'express';
import { metricsService } from './metrics.service.js';

export class MetricsController {
  async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await metricsService.getCollectionMetrics(req.user!.id, req.params.collectionId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const bucketMinutes = req.query.bucket ? parseInt(req.query.bucket as string, 10) : 5;
      const data = await metricsService.getTimelineData(req.user!.id, req.params.collectionId, bucketMinutes);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await metricsService.getDashboardSummary(req.user!.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async exportRawCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await metricsService.exportRawCsv(req.user!.id, req.params.collectionId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="coleta-${req.params.collectionId}-eventos-brutos.csv"`);
      return res.status(200).send('\uFEFF' + csv); // BOM UTF-8 para Excel
    } catch (error) {
      next(error);
    }
  }

  async exportAggregatedCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await metricsService.exportAggregatedCsv(req.user!.id, req.params.collectionId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="coleta-${req.params.collectionId}-metricas-agregadas.csv"`);
      return res.status(200).send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  }
}

export const metricsController = new MetricsController();
