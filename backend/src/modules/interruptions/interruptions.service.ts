import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { CollectionStatus, InterruptionType } from '@prisma/client';
import { collectionsService } from '../collections/collections.service.js';

export interface CreateInterruptionInput {
  attendantId?: string;
  interruptionType: InterruptionType;
  notes?: string;
}

export class InterruptionsService {
  async create(userId: string, collectionId: string, input: CreateInterruptionInput) {
    await collectionsService.enforceDeadline(collectionId);

    const collection = await prisma.collection.findFirst({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    if (collection.status !== CollectionStatus.IN_PROGRESS) {
      throw new AppError(
        `Ocorrências só podem ser registradas enquanto a coleta estiver em andamento. Status atual: ${collection.status}`,
        400,
        'INVALID_COLLECTION_STATUS'
      );
    }

    const interruption = await prisma.interruption.create({
      data: {
        collectionId,
        attendantId: input.attendantId || null,
        interruptionType: input.interruptionType,
        startedAt: new Date(),
        notes: input.notes,
        recordedBy: userId,
      },
      include: { attendant: true },
    });

    return interruption;
  }

  async finish(userId: string, collectionId: string, interruptionId: string) {
    const interruption = await prisma.interruption.findFirst({
      where: { id: interruptionId, collectionId },
    });

    if (!interruption) {
      throw new AppError('Ocorrência não encontrada.', 404);
    }

    const updated = await prisma.interruption.update({
      where: { id: interruptionId },
      data: { endedAt: new Date() },
      include: { attendant: true },
    });

    return updated;
  }

  async list(_userId: string, collectionId: string) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    return await prisma.interruption.findMany({
      where: { collectionId },
      orderBy: { startedAt: 'desc' },
      include: { attendant: true },
    });
  }
}

export const interruptionsService = new InterruptionsService();
