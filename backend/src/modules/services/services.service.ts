import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { CollectionStatus, EventType, ServiceIntervalStatus, MeasurementMethod } from '@prisma/client';

export interface StartServiceInput {
  attendantId: string;
  queueId?: string;
}

export interface FinishServiceInput {
  attendantId: string;
  serviceIntervalId?: string;
  idempotencyKey: string;
  proteinAmount?: number;
  measurementMethod?: 'MEASURED' | 'ESTIMATED';
  proteinNotes?: string;
}

export class ServicesService {
  async startService(userId: string, collectionId: string, input: StartServiceInput) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    if (collection.status !== CollectionStatus.IN_PROGRESS) {
      throw new AppError(`A coleta precisa estar em andamento para iniciar atendimentos. Status atual: ${collection.status}`, 400);
    }

    // Verificar se atendente já possui atendimento em andamento
    const active = await prisma.serviceInterval.findFirst({
      where: {
        collectionId,
        attendantId: input.attendantId,
        status: ServiceIntervalStatus.IN_PROGRESS,
      },
    });

    if (active) {
      throw new AppError('Este atendente já possui um atendimento cronometrado em andamento. Conclua-o antes de iniciar outro.', 409);
    }

    const now = new Date();
    const interval = await prisma.serviceInterval.create({
      data: {
        collectionId,
        attendantId: input.attendantId,
        queueId: input.queueId,
        startedAt: now,
        status: ServiceIntervalStatus.IN_PROGRESS,
      },
      include: { attendant: true },
    });

    return interval;
  }

  async finishService(userId: string, collectionId: string, input: FinishServiceInput) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    if (collection.status !== CollectionStatus.IN_PROGRESS) {
      throw new AppError(`A coleta precisa estar em andamento para concluir atendimentos. Status atual: ${collection.status}`, 400);
    }

    // Idempotência
    const existingEvent = await prisma.event.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existingEvent) {
      return { event: existingEvent, isReplay: true };
    }

    return await prisma.$transaction(async (tx) => {
      // Localizar o intervalo ativo
      let interval = null;
      if (input.serviceIntervalId) {
        interval = await tx.serviceInterval.findUnique({
          where: { id: input.serviceIntervalId },
        });
      } else {
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
        throw new AppError('Nenhum atendimento cronometrado em andamento para este atendente.', 404);
      }

      const now = new Date();
      const durationMs = Math.max(0, now.getTime() - new Date(interval.startedAt).getTime());

      // 1. Concluir o intervalo
      const updatedInterval = await tx.serviceInterval.update({
        where: { id: interval.id },
        data: {
          endedAt: now,
          durationMs,
          status: ServiceIntervalStatus.COMPLETED,
        },
      });

      // 2. Criar o evento correspondente de entrega
      const event = await tx.event.create({
        data: {
          collectionId,
          attendantId: input.attendantId,
          queueId: interval.queueId,
          eventType: EventType.DELIVERY,
          occurredAt: now,
          recordedAt: now,
          recordedBy: userId,
          idempotencyKey: input.idempotencyKey,
          metadata: {
            serviceIntervalId: updatedInterval.id,
            durationMs,
            durationSeconds: Math.round(durationMs / 1000),
            isTimed: true,
          },
        },
        include: { attendant: true },
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
  }

  async cancelActiveService(userId: string, collectionId: string, attendantId: string) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
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

    return cancelled;
  }

  async getActiveServices(userId: string, collectionId: string) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
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
