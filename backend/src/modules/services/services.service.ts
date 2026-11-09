import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { CollectionStatus, EventType, ServiceIntervalStatus, MeasurementMethod } from '@prisma/client';
import { sseManager } from '../events/events.sse.js';
import { collectionsService } from '../collections/collections.service.js';

export interface StartServiceInput {
  attendantId: string;
  queueId?: string;
  idempotencyKey?: string;
  occurredAt?: string;
}

export interface FinishServiceInput {
  attendantId: string;
  serviceIntervalId?: string;
  idempotencyKey: string;
  occurredAt?: string;
  proteinAmount?: number;
  measurementMethod?: 'MEASURED' | 'ESTIMATED';
  proteinNotes?: string;
}

export class ServicesService {
  async startService(_userId: string, collectionId: string, input: StartServiceInput) {
    if (!input?.attendantId) {
      throw new AppError('O identificador do atendente é obrigatório.', 400, 'VALIDATION_ERROR');
    }

    // 0. Garante que o prazo não tenha expirado antes de iniciar atendimento
    await collectionsService.enforceDeadline(collectionId);

    const txResult = await prisma.$transaction(async (tx) => {
      const collection = await tx.collection.findFirst({
        where: { id: collectionId },
      });

      if (!collection) {
        throw new AppError('Coleta não encontrada.', 404, 'NOT_FOUND');
      }

      if (collection.status !== CollectionStatus.IN_PROGRESS) {
        throw new AppError(
          `A coleta precisa estar em andamento para iniciar atendimentos. Status atual: ${collection.status}`,
          400,
          'INVALID_COLLECTION_STATUS'
        );
      }

      // Serializa operações por atendente no nível de linha do PostgreSQL
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM attendants
        WHERE id = ${input.attendantId}::uuid AND collection_id = ${collectionId}::uuid
        FOR UPDATE
      `;

      if (!locked || locked.length === 0) {
        throw new AppError('Atendente não encontrado nesta coleta.', 404, 'ATTENDANT_NOT_FOUND');
      }

      // Se já houver atendimento em andamento para este atendente, retorna-o de forma idempotente
      const active = await tx.serviceInterval.findFirst({
        where: {
          collectionId,
          attendantId: input.attendantId,
          status: ServiceIntervalStatus.IN_PROGRESS,
        },
        include: { attendant: true },
      });

      if (active) {
        return { interval: active, isReplay: true };
      }

      const now = new Date();
      let startedAt = now;
      if (input.occurredAt) {
        const parsed = new Date(input.occurredAt);
        if (!isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime() + 60000) {
          startedAt = parsed;
        }
      }
      if (collection.startedAt && startedAt.getTime() < new Date(collection.startedAt).getTime()) {
        startedAt = new Date(collection.startedAt);
      }

      const interval = await tx.serviceInterval.create({
        data: {
          collectionId,
          attendantId: input.attendantId,
          queueId: input.queueId,
          startedAt,
          status: ServiceIntervalStatus.IN_PROGRESS,
        },
        include: { attendant: true },
      });

      return { interval, isReplay: false };
    });

    if (!txResult.isReplay) {
      sseManager.broadcast(collectionId, 'service:started', txResult.interval);
    }

    return txResult.interval;
  }

  async finishService(userId: string, collectionId: string, input: FinishServiceInput) {
    if (!input?.attendantId || !input?.idempotencyKey) {
      throw new AppError('Atendente e chave de idempotência são obrigatórios.', 400, 'VALIDATION_ERROR');
    }

    // 0. Garante que o prazo não tenha expirado antes de concluir atendimento
    await collectionsService.enforceDeadline(collectionId);

    // 1. Checagem rápida de idempotência antes da transação
    const existingEvent = await prisma.event.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { attendant: true, queue: true },
    });

    if (existingEvent) {
      return { event: existingEvent, isReplay: true };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Serializa operações por atendente no nível de linha do PostgreSQL
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM attendants
        WHERE id = ${input.attendantId}::uuid AND collection_id = ${collectionId}::uuid
        FOR UPDATE
      `;

      if (!locked || locked.length === 0) {
        throw new AppError('Atendente não encontrado nesta coleta.', 404, 'ATTENDANT_NOT_FOUND');
      }

      // Recheca idempotência dentro do lock
      const replayInsideLock = await tx.event.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { attendant: true, queue: true },
      });
      if (replayInsideLock) {
        return { event: replayInsideLock, interval: null, isReplay: true };
      }

      const collection = await tx.collection.findFirst({
        where: { id: collectionId },
      });

      if (!collection) {
        throw new AppError('Coleta não encontrada.', 404, 'NOT_FOUND');
      }

      if (collection.status !== CollectionStatus.IN_PROGRESS) {
        throw new AppError(
          `A coleta precisa estar em andamento para concluir atendimentos. Status atual: ${collection.status}`,
          400,
          'INVALID_COLLECTION_STATUS'
        );
      }

      // Localizar o intervalo ativo
      let interval = null;
      if (input.serviceIntervalId) {
        interval = await tx.serviceInterval.findFirst({
          where: {
            id: input.serviceIntervalId,
            collectionId,
            attendantId: input.attendantId,
          },
        });
        if (interval && interval.status !== ServiceIntervalStatus.IN_PROGRESS) {
          throw new AppError('Este atendimento já foi encerrado ou cancelado.', 409, 'INTERVAL_NOT_ACTIVE');
        }
      }

      if (!interval) {
        interval = await tx.serviceInterval.findFirst({
          where: {
            collectionId,
            attendantId: input.attendantId,
            status: ServiceIntervalStatus.IN_PROGRESS,
          },
          orderBy: { startedAt: 'desc' },
        });
      }

      if (!interval) {
        throw new AppError('Nenhum atendimento em andamento para este atendente.', 404, 'NO_ACTIVE_INTERVAL');
      }

      const now = new Date();
      const startedAt = new Date(interval.startedAt);
      let endedAt = now;
      if (input.occurredAt) {
        const parsed = new Date(input.occurredAt);
        if (!isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime() + 60000) {
          endedAt = parsed;
        }
      }
      if (endedAt.getTime() < startedAt.getTime()) {
        endedAt = startedAt;
      }

      const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
      const durationSeconds = Math.round(durationMs / 1000);

      // 1. Concluir o intervalo atomicamente garantindo que ainda estava IN_PROGRESS
      const claimed = await tx.serviceInterval.updateMany({
        where: { id: interval.id, status: ServiceIntervalStatus.IN_PROGRESS },
        data: {
          endedAt,
          durationMs,
          status: ServiceIntervalStatus.COMPLETED,
        },
      });

      if (claimed.count === 0) {
        throw new AppError('Este atendimento já foi encerrado concorrentemente.', 409, 'INTERVAL_NOT_ACTIVE');
      }

      const updatedInterval = {
        ...interval,
        endedAt,
        durationMs,
        status: ServiceIntervalStatus.COMPLETED,
      };

      // 2. Criar o evento correspondente de entrega
      const event = await tx.event.create({
        data: {
          collectionId,
          attendantId: input.attendantId,
          queueId: interval.queueId,
          eventType: EventType.DELIVERY,
          occurredAt: endedAt,
          recordedAt: now,
          recordedBy: userId,
          idempotencyKey: input.idempotencyKey,
          metadata: {
            serviceIntervalId: updatedInterval.id,
            startedAt: startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            durationMs,
            durationSeconds,
            isTimed: true,
          },
        },
        include: { attendant: true, queue: true },
      });

      // 3. Registrar medição de proteína se enviada
      if (input.proteinAmount !== undefined && input.proteinAmount !== null) {
        await tx.proteinMeasurement.create({
          data: {
            collectionId,
            attendantId: input.attendantId,
            serviceIntervalId: updatedInterval.id,
            amount: input.proteinAmount,
            unit: 'g',
            measurementMethod: (input.measurementMethod as MeasurementMethod) || MeasurementMethod.MEASURED,
            notes: input.proteinNotes,
            recordedAt: now,
          },
        });
      }

      return {
        event,
        interval: updatedInterval,
        isReplay: false,
      };
    });

    if (!result.isReplay && result.event) {
      sseManager.broadcast(collectionId, 'event:created', result.event);
      sseManager.broadcast(collectionId, 'service:finished', {
        interval: result.interval,
        event: result.event,
      });
    }

    return result;
  }

  async cancelActiveService(_userId: string, collectionId: string, attendantId: string) {
    await collectionsService.enforceDeadline(collectionId);
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    const active = await prisma.serviceInterval.findFirst({
      where: {
        collectionId,
        attendantId,
        status: ServiceIntervalStatus.IN_PROGRESS,
      },
    });

    if (!active) {
      throw new AppError('Nenhum atendimento em andamento para cancelar.', 404);
    }

    const cancelled = await prisma.serviceInterval.update({
      where: { id: active.id },
      data: {
        status: ServiceIntervalStatus.CANCELLED,
        endedAt: new Date(),
      },
    });

    sseManager.broadcast(collectionId, 'service:cancelled', { attendantId });

    return cancelled;
  }

  async getActiveServices(_userId: string, collectionId: string) {
    await collectionsService.enforceDeadline(collectionId);
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    return await prisma.serviceInterval.findMany({
      where: {
        collectionId,
        status: ServiceIntervalStatus.IN_PROGRESS,
      },
      include: { attendant: true },
    });
  }
}

export const servicesService = new ServicesService();
