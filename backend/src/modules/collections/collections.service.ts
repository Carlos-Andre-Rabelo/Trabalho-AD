import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { CreateCollectionInput, UpdateCollectionInput } from './collections.schema.js';
import { CollectionStatus, QueueMode } from '@prisma/client';

export class CollectionsService {
  async listUserCollections(userId: string, filter?: { status?: CollectionStatus; page?: number; limit?: number }) {
    const page = filter?.page || 1;
    const limit = filter?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { ownerId: userId };
    if (filter?.status) {
      where.status = filter.status;
    }

    const [total, collections] = await Promise.all([
      prisma.collection.count({ where }),
      prisma.collection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          attendants: true,
          queues: true,
          _count: {
            select: {
              events: { where: { isVoided: false } },
            },
          },
        },
      }),
    ]);

    return {
      collections,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCollectionById(userId: string, collectionId: string) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
      include: {
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

    return collection;
  }

  async createCollection(userId: string, input: CreateCollectionInput) {
    return await prisma.$transaction(async (tx) => {
      // 1. Criar a Coleta
      const collection = await tx.collection.create({
        data: {
          ownerId: userId,
          title: input.title,
          description: input.description,
          location: input.location,
          timezone: input.timezone || 'America/Sao_Paulo',
          queueMode: input.queueMode as QueueMode,
          status: CollectionStatus.DRAFT,
          notes: input.notes,
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

      return tx.collection.findUnique({
        where: { id: collection.id },
        include: { attendants: true, queues: true },
      });
    });
  }

  async updateCollection(userId: string, collectionId: string, input: UpdateCollectionInput) {
    const existing = await this.getCollectionById(userId, collectionId);

    const updated = await prisma.collection.update({
      where: { id: collectionId },
      data: {
        title: input.title,
        description: input.description,
        location: input.location,
        notes: input.notes,
      },
    });

    await recordAuditLog({
      userId,
      collectionId,
      action: 'COLLECTION_UPDATED',
      entityType: 'Collection',
      entityId: collectionId,
      previousValues: { title: existing.title, notes: existing.notes },
      newValues: { title: updated.title, notes: updated.notes },
    });

    return updated;
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
      include: { attendants: true, queues: true },
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

    return updated;
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
        include: { attendants: true, queues: true, pauses: true },
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

      return updated;
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
        include: { attendants: true, queues: true, pauses: true },
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

      return updated;
    });
  }

  async finishCollection(userId: string, collectionId: string) {
    const collection = await this.getCollectionById(userId, collectionId);

    if (collection.status !== CollectionStatus.IN_PROGRESS && collection.status !== CollectionStatus.PAUSED) {
      throw new AppError(`Apenas coletas ativas ou pausadas podem ser finalizadas. Status atual: ${collection.status}`, 400);
    }

    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      // Se estava pausada, encerra a pausa
      if (collection.status === CollectionStatus.PAUSED) {
        await tx.collectionPause.updateMany({
          where: { collectionId, endedAt: null },
          data: { endedAt: now },
        });
      }

      // Cancela quaisquer intervalos de atendimento em andamento
      await tx.serviceInterval.updateMany({
        where: { collectionId, status: 'IN_PROGRESS' },
        data: { status: 'CANCELLED', endedAt: now },
      });

      const updated = await tx.collection.update({
        where: { id: collectionId },
        data: {
          status: CollectionStatus.FINISHED,
          endedAt: now,
        },
        include: { attendants: true, queues: true, pauses: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          collectionId,
          action: 'COLLECTION_FINISHED',
          entityType: 'Collection',
          entityId: collectionId,
          newValues: { status: updated.status, endedAt: updated.endedAt },
        },
      });

      return updated;
    });
  }

  async reopenCollection(userId: string, collectionId: string, reason: string) {
    const collection = await this.getCollectionById(userId, collectionId);

    if (collection.status !== CollectionStatus.FINISHED) {
      throw new AppError(`Apenas coletas encerradas podem ser reabertas. Status atual: ${collection.status}`, 400);
    }

    const updated = await prisma.collection.update({
      where: { id: collectionId },
      data: {
        status: CollectionStatus.IN_PROGRESS,
        endedAt: null,
      },
      include: { attendants: true, queues: true },
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

    return updated;
  }
}

export const collectionsService = new CollectionsService();
