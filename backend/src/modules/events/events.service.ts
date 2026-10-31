import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { CreateEventInput, VoidEventInput } from './events.schema.js';
import { CollectionStatus, EventType } from '@prisma/client';

export class EventsService {
  async createEvent(userId: string, collectionId: string, input: CreateEventInput) {
    // 1. Verificar Coleta e Status
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
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

    // 2. Checagem de Idempotência
    const existing = await prisma.event.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { attendant: true, queue: true },
    });

    if (existing) {
      return { event: existing, isReplay: true };
    }

    // 3. Validação do Atendente se for DELIVERY
    if (input.eventType === EventType.DELIVERY && !input.attendantId) {
      throw new AppError('O identificador do atendente é obrigatório para eventos de entrega de proteína.', 400);
    }

    const now = new Date();
    let occurredAt = now;
    if (input.occurredAt) {
      const parsed = new Date(input.occurredAt);
      // Protege contra datas inválidas ou timestamps muito no futuro (> 1 min)
      if (!isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime() + 60000) {
        occurredAt = parsed;
      }
    }

    // 4. Criação do Evento
    const event = await prisma.event.create({
      data: {
        collectionId,
        attendantId: input.attendantId,
        queueId: input.queueId,
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

    return { event, isReplay: false };
  }

  async voidEvent(userId: string, collectionId: string, eventId: string, input: VoidEventInput) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, collectionId },
      include: { collection: true },
    });

    if (!event) {
      throw new AppError('Evento não encontrado para esta coleta.', 404, 'EVENT_NOT_FOUND');
    }

    if (event.collection.ownerId !== userId) {
      throw new AppError('Você não tem permissão para anular este evento.', 403, 'FORBIDDEN');
    }

    if (event.isVoided) {
      throw new AppError('Este evento já foi previamente anulado.', 400, 'ALREADY_VOIDED');
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
      where: { id: collectionId, ownerId: userId },
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

  async getRecentEvents(userId: string, collectionId: string, limit = 10) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
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
