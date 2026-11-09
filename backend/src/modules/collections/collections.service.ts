import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { CreateCollectionInput, UpdateCollectionInput } from './collections.schema.js';
import { CollectionStatus, Prisma, QueueMode } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { sseManager } from '../events/events.sse.js';
import {
  computeDeadline,
  computeOperationalElapsedMs,
  computeRemainingMs,
  isDeadlineExpired,
} from './collectionLifecycle.js';

export function parseCollectionNotes(notes: string | null | undefined): { notesText: string | null; targetDurationMinutes: number | null } {
  if (!notes) return { notesText: null, targetDurationMinutes: null };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object') {
      return {
        notesText: parsed.notesText ?? null,
        targetDurationMinutes: typeof parsed.targetDurationMinutes === 'number' ? parsed.targetDurationMinutes : null,
      };
    }
  } catch {
    // Se não for JSON, checa padrão de tag [DURATION:X]
    const match = notes.match(/\[DURATION:(\d+)\]/);
    if (match) {
      return {
        notesText: notes.replace(/\[DURATION:\d+\]/, '').trim() || null,
        targetDurationMinutes: parseInt(match[1], 10),
      };
    }
  }
  return { notesText: notes, targetDurationMinutes: null };
}

export function serializeCollectionNotes(
  notesText: string | null | undefined,
  targetDurationMinutes: number | null | undefined
): string | null {
  if (!notesText && (targetDurationMinutes === null || targetDurationMinutes === undefined)) return null;
  return JSON.stringify({
    notesText: notesText || null,
    targetDurationMinutes: targetDurationMinutes ?? null,
  });
}

export function formatCollectionResponse<
  T extends {
    notes?: string | null;
    status?: string;
    startedAt?: Date | string | null;
    endedAt?: Date | string | null;
    pauses?: Array<{ startedAt: Date | string; endedAt?: Date | string | null }>;
  }
>(col: T) {
  const { notesText, targetDurationMinutes } = parseCollectionNotes(col.notes);
  const nowMs = Date.now();
  const timing = { ...col, targetDurationMinutes };
  const deadline = computeDeadline(timing, nowMs);
  const remainingMs = computeRemainingMs(timing, nowMs);
  return {
    ...col,
    notes: notesText,
    targetDurationMinutes,
    deadlineAt: deadline ? deadline.toISOString() : null,
    remainingMs,
  };
}

export class CollectionsService {
  /**
   * Avalia de forma autoritativa se a coleta atingiu o prazo limite configurado e,
   * caso positivo, encerra-a atomicamente com `endedAt = deadline`.
   */
  async enforceDeadline(collectionId: string) {
    const col = await prisma.collection.findUnique({
      where: { id: collectionId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        startedAt: true,
        endedAt: true,
        notes: true,
        pauses: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });

    if (!col || col.status !== CollectionStatus.IN_PROGRESS) {
      return null;
    }

    const nowMs = Date.now();
    if (!isDeadlineExpired(col, nowMs)) {
      return null;
    }

    const deadline = computeDeadline(col, nowMs) || new Date(nowMs);
    return await this.finishCollection(col.ownerId, collectionId, {
      endedAt: deadline,
      reason: 'TIMER_EXPIRED',
    });
  }

  async listUserCollections(_userId: string, filter?: { status?: CollectionStatus; page?: number; limit?: number }) {
    const page = filter?.page || 1;
    const limit = filter?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filter?.status) {
      where.status = filter.status;
    }

    // Varre coletas em andamento que já expiraram antes de listar
    const activeCandidates = await prisma.collection.findMany({
      where: { status: CollectionStatus.IN_PROGRESS },
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        notes: true,
        pauses: { orderBy: { startedAt: 'asc' } },
      },
    });

    const nowMs = Date.now();
    for (const candidate of activeCandidates) {
      if (isDeadlineExpired(candidate, nowMs)) {
        await this.enforceDeadline(candidate.id);
      }
    }

    const [total, collections] = await Promise.all([
      prisma.collection.count({ where }),
      prisma.collection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          attendants: true,
          queues: true,
          pauses: { orderBy: { startedAt: 'asc' } },
          _count: {
            select: {
              events: { where: { isVoided: false } },
            },
          },
        },
      }),
    ]);

    const formattedCollections = collections.map((col) => formatCollectionResponse(col));

    return {
      collections: formattedCollections,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCollectionById(_userId: string, collectionId: string) {
    await this.enforceDeadline(collectionId);

    const collection = await prisma.collection.findFirst({
      where: { id: collectionId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        attendants: {
          orderBy: { code: 'asc' },
        },
        queues: {
          include: {
            attendants: {
              include: { attendant: true },
            },
          },
        },
        pauses: {
          orderBy: { startedAt: 'asc' },
        },
        interruptions: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            events: { where: { isVoided: false } },
            serviceIntervals: true,
            proteinMeasurements: true,
          },
        },
      },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada ou acesso não autorizado.', 404, 'NOT_FOUND');
    }

    const grouped = await prisma.event.groupBy({
      by: ['eventType', 'attendantId'],
      where: { collectionId, isVoided: false },
      _count: { _all: true },
    });

    let arrivals = 0;
    const deliveriesByAttendant: Record<string, number> = {};
    collection.attendants.forEach((a) => (deliveriesByAttendant[a.id] = 0));

    for (const g of grouped) {
      if (g.eventType === 'ARRIVAL') {
        arrivals += g._count._all;
      } else if (g.eventType === 'DELIVERY' && g.attendantId) {
        deliveriesByAttendant[g.attendantId] = (deliveriesByAttendant[g.attendantId] || 0) + g._count._all;
      }
    }

    return {
      ...formatCollectionResponse(collection),
      eventCounts: {
        arrivals,
        deliveriesByAttendant,
      },
    };
  }

  async createCollection(userId: string, input: CreateCollectionInput) {
    let ownerId = userId;
    if (input.aferidorName && input.aferidorName.trim()) {
      const name = input.aferidorName.trim();
      let user = await prisma.user.findFirst({ where: { name } });
      if (!user) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'aferidor';
        user = await prisma.user.create({
          data: {
            name,
            email: `${slug}-${Date.now()}@aferidor.local`,
            passwordHash: 'NOPASSWORD',
          },
        });
      }
      ownerId = user.id;
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Criar a Coleta
      const serializedNotes = serializeCollectionNotes(input.notes, input.targetDurationMinutes);
      const collection = await tx.collection.create({
        data: {
          ownerId,
          title: input.title,
          description: input.description,
          location: input.location,
          timezone: input.timezone || 'America/Sao_Paulo',
          queueMode: input.queueMode as QueueMode,
          status: CollectionStatus.DRAFT,
          notes: serializedNotes,
        },
      });

      // 2. Criar Atendentes
      const createdAttendants = [];
      for (const att of input.attendants) {
        const created = await tx.attendant.create({
          data: {
            collectionId: collection.id,
            code: att.code.toUpperCase(),
            displayName: att.displayName,
          },
        });
        createdAttendants.push(created);
      }

      // 3. Criar Filas e Associações de acordo com queueMode
      if (input.queueMode === QueueMode.SINGLE_QUEUE) {
        const singleQueue = await tx.queue.create({
          data: {
            collectionId: collection.id,
            name: 'Fila Única Compartilhada',
          },
        });

        // Todos os atendentes atendem à fila única
        for (const att of createdAttendants) {
          await tx.queueAttendant.create({
            data: {
              queueId: singleQueue.id,
              attendantId: att.id,
            },
          });
        }
      } else if (input.queueMode === QueueMode.SEPARATE_QUEUES) {
        // Cada atendente possui sua própria fila
        for (const att of createdAttendants) {
          const queue = await tx.queue.create({
            data: {
              collectionId: collection.id,
              name: `Fila ${att.displayName}`,
            },
          });

          await tx.queueAttendant.create({
            data: {
              queueId: queue.id,
              attendantId: att.id,
            },
          });
        }
      } else if (input.queues && input.queues.length > 0) {
        for (const qName of input.queues) {
          await tx.queue.create({
            data: {
              collectionId: collection.id,
              name: qName,
            },
          });
        }
      }

      // 4. Log de Auditoria
      await tx.auditLog.create({
        data: {
          userId,
          collectionId: collection.id,
          action: 'COLLECTION_CREATED',
          entityType: 'Collection',
          entityId: collection.id,
          newValues: {
            title: collection.title,
            queueMode: collection.queueMode,
            attendantsCount: createdAttendants.length,
          },
        },
      });

      const created = await tx.collection.findUnique({
        where: { id: collection.id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          attendants: true,
          queues: true,
        },
      });

      const remoteToken = jwt.sign(
        {
          userId,
          collectionId: collection.id,
          role: 'REMOTE_AFERIDOR',
        },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return {
        ...created,
        notes: input.notes || null,
        targetDurationMinutes: input.targetDurationMinutes ?? null,
        remoteToken,
      };
    });
  }

  async generateRemoteToken(userId: string, collectionId: string) {
    const collection = await this.getCollectionById(userId, collectionId);
    const token = jwt.sign(
      {
        userId,
        collectionId: collection.id,
        role: 'REMOTE_AFERIDOR',
      },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return {
      token,
      collectionId: collection.id,
      title: collection.title,
      status: collection.status,
    };
  }

  async updateCollection(userId: string, collectionId: string, input: UpdateCollectionInput) {
    const existing = await this.getCollectionById(userId, collectionId);

    const newNotesText = input.notes !== undefined ? input.notes : (existing.notes ?? null);
    const newDuration =
      input.targetDurationMinutes !== undefined
        ? input.targetDurationMinutes
        : (existing.targetDurationMinutes ?? null);
    const serializedNotes = serializeCollectionNotes(newNotesText, newDuration);

    const updated = await prisma.collection.update({
      where: { id: collectionId },
      data: {
        title: input.title,
        description: input.description,
        location: input.location,
        notes: serializedNotes,
      },
      include: { pauses: { orderBy: { startedAt: 'asc' } } },
    });

    await recordAuditLog({
      userId,
      collectionId,
      action: 'COLLECTION_UPDATED',
      entityType: 'Collection',
      entityId: collectionId,
      previousValues: { title: existing.title, notes: existing.notes, targetDurationMinutes: existing.targetDurationMinutes },
      newValues: { title: updated.title, notes: newNotesText, targetDurationMinutes: newDuration },
    });

    const expired = await this.enforceDeadline(collectionId);
    if (expired) {
      return expired;
    }

    const formatted = formatCollectionResponse(updated);
    sseManager.broadcast(collectionId, 'collection:status', formatted);
    return formatted;
  }

  async startCollection(userId: string, collectionId: string) {
    const collection = await this.getCollectionById(userId, collectionId);

    if (collection.status !== CollectionStatus.DRAFT) {
      throw new AppError(`Apenas coletas em Rascunho podem ser iniciadas. Status atual: ${collection.status}`, 400);
    }

    const now = new Date();
    const updated = await prisma.collection.update({
      where: { id: collectionId },
      data: {
        status: CollectionStatus.IN_PROGRESS,
        startedAt: now,
      },
      include: { attendants: true, queues: true, pauses: { orderBy: { startedAt: 'asc' } } },
    });

    await recordAuditLog({
      userId,
      collectionId,
      action: 'COLLECTION_STARTED',
      entityType: 'Collection',
      entityId: collectionId,
      previousValues: { status: collection.status },
      newValues: { status: updated.status, startedAt: updated.startedAt },
    });

    const formatted = formatCollectionResponse(updated);
    sseManager.broadcast(collectionId, 'collection:status', formatted);

    return formatted;
  }

  async pauseCollection(userId: string, collectionId: string, reason?: string) {
    const collection = await this.getCollectionById(userId, collectionId);

    if (collection.status !== CollectionStatus.IN_PROGRESS) {
      throw new AppError(`Apenas coletas em andamento podem ser pausadas. Status atual: ${collection.status}`, 400);
    }

    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      // Registrar intervalo de pausa
      await tx.collectionPause.create({
        data: {
          collectionId,
          startedAt: now,
          reason: reason || 'Pausa operacional',
        },
      });

      const updated = await tx.collection.update({
        where: { id: collectionId },
        data: { status: CollectionStatus.PAUSED },
        include: { attendants: true, queues: true, pauses: { orderBy: { startedAt: 'asc' } } },
      });

      await tx.auditLog.create({
        data: {
          userId,
          collectionId,
          action: 'COLLECTION_PAUSED',
          entityType: 'Collection',
          entityId: collectionId,
          newValues: { status: updated.status, reason },
        },
      });

      const formatted = formatCollectionResponse(updated);
      sseManager.broadcast(collectionId, 'collection:status', formatted);

      return formatted;
    });
  }

  async resumeCollection(userId: string, collectionId: string) {
    const collection = await this.getCollectionById(userId, collectionId);

    if (collection.status !== CollectionStatus.PAUSED) {
      throw new AppError(`Apenas coletas pausadas podem ser retomadas. Status atual: ${collection.status}`, 400);
    }

    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      // Fechar pausa em aberto
      const openPause = await tx.collectionPause.findFirst({
        where: { collectionId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });

      if (openPause) {
        await tx.collectionPause.update({
          where: { id: openPause.id },
          data: { endedAt: now },
        });
      }

      const updated = await tx.collection.update({
        where: { id: collectionId },
        data: { status: CollectionStatus.IN_PROGRESS },
        include: { attendants: true, queues: true, pauses: { orderBy: { startedAt: 'asc' } } },
      });

      await tx.auditLog.create({
        data: {
          userId,
          collectionId,
          action: 'COLLECTION_RESUMED',
          entityType: 'Collection',
          entityId: collectionId,
          newValues: { status: updated.status, resumedAt: now },
        },
      });

      const formatted = formatCollectionResponse(updated);
      sseManager.broadcast(collectionId, 'collection:status', formatted);

      return formatted;
    });
  }

  async finishCollection(
    userId: string,
    collectionId: string,
    options?: { endedAt?: Date; reason?: string }
  ) {
    const existing = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: { attendants: true, queues: true, pauses: { orderBy: { startedAt: 'asc' } } },
    });

    if (!existing) {
      throw new AppError('Coleta não encontrada ou acesso não autorizado.', 404, 'NOT_FOUND');
    }

    if (existing.status === CollectionStatus.DRAFT) {
      throw new AppError(
        `Apenas coletas ativas ou pausadas podem ser finalizadas. Status atual: ${existing.status}`,
        400
      );
    }

    if (existing.status === CollectionStatus.FINISHED) {
      return formatCollectionResponse(existing);
    }

    const now = new Date();
    const endedAt = options?.endedAt ?? now;
    const reason = options?.reason || 'MANUAL';

    const txResult = await prisma.$transaction(async (tx) => {
      // Transição condicional atômica: apenas um chamador vence a corrida de encerramento
      const claimed = await tx.collection.updateMany({
        where: {
          id: collectionId,
          status: { in: [CollectionStatus.IN_PROGRESS, CollectionStatus.PAUSED] },
        },
        data: {
          status: CollectionStatus.FINISHED,
          endedAt,
        },
      });

      if (claimed.count === 0) {
        const current = await tx.collection.findUnique({
          where: { id: collectionId },
          include: { attendants: true, queues: true, pauses: { orderBy: { startedAt: 'asc' } } },
        });
        return { won: false, updated: current!, cancelledAttendantIds: [] as string[] };
      }

      // Se estava pausada, encerra a pausa aberta
      await tx.collectionPause.updateMany({
        where: { collectionId, endedAt: null },
        data: { endedAt },
      });

      // Localiza e cancela quaisquer intervalos de atendimento em andamento
      const activeIntervals = await tx.serviceInterval.findMany({
        where: { collectionId, status: 'IN_PROGRESS' },
        select: { id: true, attendantId: true },
      });

      if (activeIntervals.length > 0) {
        await tx.serviceInterval.updateMany({
          where: { collectionId, status: 'IN_PROGRESS' },
          data: { status: 'CANCELLED', endedAt },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: userId || existing.ownerId,
          collectionId,
          action: 'COLLECTION_FINISHED',
          entityType: 'Collection',
          entityId: collectionId,
          newValues: { status: CollectionStatus.FINISHED, endedAt, reason },
        },
      });

      const updated = await tx.collection.findUnique({
        where: { id: collectionId },
        include: { attendants: true, queues: true, pauses: { orderBy: { startedAt: 'asc' } } },
      });

      return {
        won: true,
        updated: updated!,
        cancelledAttendantIds: activeIntervals.map((i) => i.attendantId),
      };
    });

    const formatted = formatCollectionResponse(txResult.updated);

    if (txResult.won) {
      for (const attendantId of txResult.cancelledAttendantIds) {
        sseManager.broadcast(collectionId, 'service:cancelled', { attendantId });
      }
      sseManager.broadcast(collectionId, 'collection:status', formatted);
    }

    return formatted;
  }

  async reopenCollection(userId: string, collectionId: string, reason: string) {
    const collection = await this.getCollectionById(userId, collectionId);

    if (collection.status !== CollectionStatus.FINISHED) {
      throw new AppError(`Apenas coletas encerradas podem ser reabertas. Status atual: ${collection.status}`, 400);
    }

    // Se há duração limite e o tempo operacional já atingiu ou superou o limite, exige ajuste prévio
    if (collection.targetDurationMinutes && collection.targetDurationMinutes > 0 && collection.startedAt) {
      const elapsedMs = computeOperationalElapsedMs(collection, Date.now());
      if (elapsedMs >= collection.targetDurationMinutes * 60_000) {
        throw new AppError(
          'O tempo limite desta aferição já se esgotou. Ajuste ou remova o tempo limite antes de reabrir.',
          409,
          'TIMER_EXPIRED'
        );
      }
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      // Registra o período em que esteve encerrada como pausa para não descontar do tempo ativo
      if (collection.endedAt) {
        await tx.collectionPause.create({
          data: {
            collectionId,
            startedAt: new Date(collection.endedAt),
            endedAt: now,
            reason: `Período encerrado antes de reabertura (${reason})`,
          },
        });
      }

      return await tx.collection.update({
        where: { id: collectionId },
        data: {
          status: CollectionStatus.IN_PROGRESS,
          endedAt: null,
        },
        include: { attendants: true, queues: true, pauses: { orderBy: { startedAt: 'asc' } } },
      });
    });

    await recordAuditLog({
      userId,
      collectionId,
      action: 'COLLECTION_REOPENED',
      entityType: 'Collection',
      entityId: collectionId,
      previousValues: { status: CollectionStatus.FINISHED, endedAt: collection.endedAt },
      newValues: { status: updated.status, reason },
    });

    const formatted = formatCollectionResponse(updated);
    sseManager.broadcast(collectionId, 'collection:status', formatted);

    return formatted;
  }

  async deleteCollection(userId: string, collectionId: string) {
    // Garante que a coleta existe e o usuário tem acesso
    await this.getCollectionById(userId, collectionId);

    return await prisma.$transaction(async (tx) => {
      // Deleta entidades vinculadas para garantir integridade referencial
      await tx.auditLog.deleteMany({ where: { collectionId } });
      await tx.event.deleteMany({ where: { collectionId } });
      await tx.proteinMeasurement.deleteMany({ where: { collectionId } });
      await tx.serviceInterval.deleteMany({ where: { collectionId } });
      await tx.interruption.deleteMany({ where: { collectionId } });
      await tx.collectionPause.deleteMany({ where: { collectionId } });
      await tx.queueAttendant.deleteMany({ where: { queue: { collectionId } } });
      await tx.queue.deleteMany({ where: { collectionId } });
      await tx.attendant.deleteMany({ where: { collectionId } });

      const deleted = await tx.collection.delete({
        where: { id: collectionId },
      });

      return deleted;
    });
  }

  async getSyncState(collectionId: string, _since?: string) {
    // 1. Garante encerramento autoritativo caso o prazo tenha expirado
    await this.enforceDeadline(collectionId);

    // 2. Leitura consistente do snapshot em uma única transação RepeatableRead
    const [collection, activeServices, recentEvents, recentKeys, grouped] = await prisma.$transaction(
      [
        prisma.collection.findUnique({
          where: { id: collectionId },
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            notes: true,
            pauses: {
              orderBy: { startedAt: 'asc' },
            },
          },
        }),
        prisma.serviceInterval.findMany({
          where: { collectionId, status: 'IN_PROGRESS' },
          include: { attendant: true },
          orderBy: { startedAt: 'asc' },
        }),
        prisma.event.findMany({
          where: { collectionId },
          orderBy: { occurredAt: 'desc' },
          take: 15,
          include: { attendant: true, queue: true },
        }),
        prisma.event.findMany({
          where: { collectionId },
          orderBy: { recordedAt: 'desc' },
          take: 150,
          select: {
            id: true,
            idempotencyKey: true,
            isVoided: true,
          },
        }),
        prisma.event.groupBy({
          by: ['eventType', 'attendantId'],
          where: { collectionId, isVoided: false },
          OrderBy: undefined,
          _count: { _all: true },
        } as any),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404, 'NOT_FOUND');
    }

    let arrivals = 0;
    const deliveriesByAttendant: Record<string, number> = {};
    for (const g of grouped as any[]) {
      if (g.eventType === 'ARRIVAL') {
        arrivals += g._count._all;
      } else if (g.eventType === 'DELIVERY' && g.attendantId) {
        deliveriesByAttendant[g.attendantId] = (deliveriesByAttendant[g.attendantId] || 0) + g._count._all;
      }
    }

    const now = new Date();
    const { targetDurationMinutes } = parseCollectionNotes(collection.notes);
    const openPause = [...(collection.pauses || [])].reverse().find((p) => !p.endedAt);
    const timing = { ...collection, targetDurationMinutes };
    const deadline = computeDeadline(timing, now.getTime());
    const remainingMs = computeRemainingMs(timing, now.getTime());

    return {
      status: collection.status,
      targetDurationMinutes,
      startedAt: collection.startedAt,
      pausedAt: openPause ? openPause.startedAt : null,
      finishedAt: collection.endedAt,
      pauses: collection.pauses,
      deadlineAt: deadline ? deadline.toISOString() : null,
      remainingMs,
      serverTime: now.toISOString(),
      eventCounts: {
        arrivals,
        deliveriesByAttendant,
      },
      eventStates: recentKeys.map((e) => [e.idempotencyKey, e.isVoided, e.id] as [string, boolean, string]),
      activeServices,
      recentEvents,
    };
  }
}

export const collectionsService = new CollectionsService();
