import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { MeasurementMethod } from '@prisma/client';

export interface CreateProteinMeasurementInput {
  attendantId: string;
  serviceIntervalId?: string;
  amount: number;
  unit?: string;
  measurementMethod?: MeasurementMethod;
  notes?: string;
}

export class ProteinService {
  async create(userId: string, collectionId: string, input: CreateProteinMeasurementInput) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    if (input.amount <= 0) {
      throw new AppError('A quantidade de proteína deve ser maior que zero.', 400);
    }

    const measurement = await prisma.proteinMeasurement.create({
      data: {
        collectionId,
        attendantId: input.attendantId,
        serviceIntervalId: input.serviceIntervalId || null,
        amount: input.amount,
        unit: input.unit || 'g',
        measurementMethod: input.measurementMethod || MeasurementMethod.MEASURED,
        notes: input.notes,
        recordedAt: new Date(),
      },
      include: { attendant: true },
    });

    return measurement;
  }

  async list(userId: string, collectionId: string) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    return await prisma.proteinMeasurement.findMany({
      where: { collectionId },
      orderBy: { recordedAt: 'desc' },
      include: { attendant: true },
    });
  }
}

export const proteinService = new ProteinService();
