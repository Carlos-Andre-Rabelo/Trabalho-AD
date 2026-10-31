import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';

export async function checkEventIdempotency(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['idempotency-key'] as string || req.body?.idempotencyKey;

  if (!idempotencyKey) {
    return next();
  }

  try {
    const existingEvent = await prisma.event.findUnique({
      where: { idempotencyKey },
    });

    if (existingEvent) {
      // Retorna o evento já registrado previamente com status 200 e header indicativo
      res.setHeader('X-Idempotent-Replay', 'true');
      return res.status(200).json({
        success: true,
        data: existingEvent,
        message: 'Evento já registrado anteriormente (requisição idempotente recuperada).',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
