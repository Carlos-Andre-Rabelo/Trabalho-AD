import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { openApiSpec } from './docs/swagger.js';

// Routers
import { authRouter } from './modules/auth/auth.routes.js';
import { collectionsRouter } from './modules/collections/collections.routes.js';
import { eventsRouter } from './modules/events/events.routes.js';
import { servicesRouter } from './modules/services/services.routes.js';
import { interruptionsRouter } from './modules/interruptions/interruptions.routes.js';
import { proteinRouter } from './modules/protein/protein.routes.js';
import { metricsRouter } from './modules/metrics/metrics.routes.js';
import { metricsController } from './modules/metrics/metrics.controller.js';
import { authMiddleware } from './middleware/auth.js';

export function createApp() {
  const app = express();

  // CORS
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(null, true); // Permissivo em dev acadêmico
        }
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With'],
    })
  );

  // Parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Parser de cookies simples sem dependência extra
  app.use((req, _res, next) => {
    const rawCookies = req.headers.cookie;
    if (rawCookies) {
      const cookies: Record<string, string> = {};
      rawCookies.split(';').forEach((part) => {
        const [k, v] = part.trim().split('=');
        if (k && v) cookies[k] = decodeURIComponent(v);
      });
      (req as any).cookies = cookies;
    } else {
      (req as any).cookies = {};
    }
    next();
  });

  // Healthcheck
  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'RU Metrics API',
      timestamp: new Date().toISOString(),
    });
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Documentação OpenAPI / Swagger
  app.get('/api-docs/json', (_req, res) => res.json(openApiSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Rotas da API REST
  app.use('/api/auth', authRouter);
  app.use('/api/collections', collectionsRouter);
  app.use('/api/collections/:collectionId/events', eventsRouter);
  app.use('/api/collections/:collectionId/services', servicesRouter);
  app.use('/api/collections/:collectionId/interruptions', interruptionsRouter);
  app.use('/api/collections/:collectionId/protein-measurements', proteinRouter);
  app.use('/api/collections/:collectionId', metricsRouter);

  // Dashboard geral
  app.get('/api/dashboard', authMiddleware, (req, res, next) => metricsController.getDashboard(req, res, next));

  // 404 Handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        message: 'Rota não encontrada na API do RU Metrics.',
        code: 'ROUTE_NOT_FOUND',
      },
    });
  });

  // Tratamento Global de Erros
  app.use(errorHandler);

  return app;
}
