import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { CreateEventInput, VoidEventInput } from './events.schema.js';
import { CollectionStatus, EventType } from '@prisma/client';
import { sseManager } from './events.sse.js';
import { collectionsService } from '../collections/collections.service.js';

export class EventsService {
  async createEvent(userId: string, collectionId: string, input: CreateEventInput) {
    // 0. Verifica se o prazo da coleta já se esgotou antes de aceitar novos eventos
    await collectionsService.enforceDeadline(collectionId);

    // 1. Checagem rápida de Idempotência (permite replay mesmo após encerramento se já gravado)
    const existing = await prisma.event.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { attendant: true, queue: true },
    });

    if (existing) {
      return { event: existing, isReplay: true };
    }

    // 2. Verificar Coleta e Status
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada ou sem autorização.', 404, 'NOT_FOUND');
    }

    if (collection.status !== CollectionStatus.IN_PROGRESS) {
      throw new AppError(
        `Eventos operacionais só podem ser registrados enquanto a coleta estiver "Em andamento". Estado atual: ${collection.status}`,
        400,
        'INVALID_COLLECTION_STATUS'
      );
    }

    // 3. Validação do Atendente se for DELIVERY e resolução automática Fila <-> Atendente em ARRIVAL
    if (input.eventType === EventType.DELIVERY && !input.attendantId) {
      throw new AppError('O identificador do atendente é obrigatório para eventos de entrega de proteína.', 400);
    }

    let resolvedQueueId = input.queueId;
    let resolvedAttendantId = input.attendantId;

    if (input.eventType === EventType.ARRIVAL) {
      if (resolvedQueueId && !resolvedAttendantId) {
        const links = await prisma.queueAttendant.findMany({
          where: { queueId: resolvedQueueId },
          select: { attendantId: true },
        });
        if (links.length === 1) {
          resolvedAttendantId = links[0].attendantId;
        }
      } else if (resolvedAttendantId && !resolvedQueueId) {
        const link = await prisma.queueAttendant.findFirst({
          where: {
            attendantId: resolvedAttendantId,
            queue: { collectionId },
          },
          select: { queueId: true },
        });
        if (link) {
          resolvedQueueId = link.queueId;
        }
      } else if (!resolvedQueueId && collection.queueMode === 'SINGLE_QUEUE') {
        const singleQueue = await prisma.queue.findFirst({
          where: { collectionId },
          select: { id: true },
        });
        if (singleQueue) {
          resolvedQueueId = singleQueue.id;
        }
      }
    }

    const now = new Date();
    let occurredAt = now;
    if (input.occurredAt) {
      const parsed = new Date(input.occurredAt);
      if (!isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime() + 60000) {
        occurredAt = parsed;
      }
    }
    if (collection.startedAt && occurredAt.getTime() < new Date(collection.startedAt).getTime()) {
      occurredAt = new Date(collection.startedAt);
    }

    // 4. Criação atômica do Evento (trata corrida P2002 na chave de idempotência)
    try {
      const event = await prisma.event.create({
        data: {
          collectionId,
          attendantId: resolvedAttendantId,
          queueId: resolvedQueueId,
          eventType: input.eventType as EventType,
          occurredAt,
          recordedAt: now,
          recordedBy: userId,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata || undefined,
        },
        include: {
          attendant: true,
          queue: true,
        },
      });

      sseManager.broadcast(collectionId, 'event:created', event);

      return { event, isReplay: false };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const replay = await prisma.event.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { attendant: true, queue: true },
        });
        if (replay) {
          return { event: replay, isReplay: true };
        }
      }
      throw err;
    }
  }

  async voidEvent(userId: string, collectionId: string, eventId: string, input: VoidEventInput) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, collectionId },
      include: { collection: true, attendant: true, queue: true },
    });

    if (!event) {
      throw new AppError('Evento não encontrado para esta coleta.', 404, 'EVENT_NOT_FOUND');
    }

    if (event.isVoided) {
      return event;
    }

    const now = new Date();
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        isVoided: true,
        voidedAt: now,
        voidedBy: userId,
        voidReason: input.voidReason,
      },
      include: { attendant: true, queue: true },
    });

    await recordAuditLog({
      userId,
      collectionId,
      action: 'EVENT_VOIDED',
      entityType: 'Event',
      entityId: eventId,
      previousValues: { isVoided: false },
      newValues: { isVoided: true, voidReason: input.voidReason, voidedAt: now },
    });

    sseManager.broadcast(collectionId, 'event:voided', updated);

    return updated;
  }

  async listEvents(
    userId: string,
    collectionId: string,
    filters?: {
      eventType?: EventType;
      attendantId?: string;
      includeVoided?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    // Validar acesso à coleta
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada ou sem autorização.', 404, 'NOT_FOUND');
    }

    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 200);
    const skip = (page - 1) * limit;

    const where: any = { collectionId };
    if (filters?.eventType) where.eventType = filters.eventType;
    if (filters?.attendantId) where.attendantId = filters.attendantId;
    if (!filters?.includeVoided) where.isVoided = false;

    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        include: {
          attendant: true,
          queue: true,
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRecentEvents(_userId: string, collectionId: string, limit = 10) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    return await prisma.event.findMany({
      where: { collectionId },
      take: limit,
      orderBy: { occurredAt: 'desc' },
      include: {
        attendant: true,
        queue: true,
      },
    });
  }
}

export const eventsService = new EventsService();
