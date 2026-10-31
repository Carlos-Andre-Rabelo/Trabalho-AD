import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { computeCollectionMetrics } from '../../utils/statistics.js';
import { generateRawEventsCsv, generateAggregatedMetricsCsv } from '../../utils/csvExport.js';

export class MetricsService {
  async getCollectionMetrics(userId: string, collectionId: string) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
      include: {
        attendants: { orderBy: { code: 'asc' } },
        pauses: { orderBy: { startedAt: 'asc' } },
        proteinMeasurements: true,
      },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    const [events, serviceIntervals] = await Promise.all([
      prisma.event.findMany({
        where: { collectionId },
        select: {
          id: true,
          eventType: true,
          attendantId: true,
          isVoided: true,
          occurredAt: true,
        },
      }),
      prisma.serviceInterval.findMany({
        where: { collectionId },
        select: {
          id: true,
          attendantId: true,
          durationMs: true,
          startedAt: true,
          endedAt: true,
          status: true,
        },
      }),
    ]);

    const metrics = computeCollectionMetrics({
      startedAt: collection.startedAt,
      endedAt: collection.endedAt,
      currentStatus: collection.status,
      pauses: collection.pauses,
      events,
      serviceIntervals,
      attendants: collection.attendants,
      proteinMeasurements: collection.proteinMeasurements,
    });

    return {
      collection: {
        id: collection.id,
        title: collection.title,
        status: collection.status,
        queueMode: collection.queueMode,
        startedAt: collection.startedAt,
        endedAt: collection.endedAt,
        location: collection.location,
        timezone: collection.timezone,
      },
      metrics,
    };
  }

  async getTimelineData(userId: string, collectionId: string, bucketMinutes = 5) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
      include: { attendants: { orderBy: { code: 'asc' } } },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    const events = await prisma.event.findMany({
      where: { collectionId, isVoided: false },
      orderBy: { occurredAt: 'asc' },
      include: { attendant: true },
    });

    if (events.length === 0 || !collection.startedAt) {
      return [];
    }

    const startTime = new Date(collection.startedAt).getTime();
    const endTime = collection.endedAt ? new Date(collection.endedAt).getTime() : new Date().getTime();
    const bucketMs = bucketMinutes * 60 * 1000;

    const buckets: Array<{
      timestamp: string;
      label: string;
      arrivals: number;
      totalDeliveries: number;
      cumulativeArrivals: number;
      cumulativeDeliveries: number;
      estimatedQueueLength: number;
      [key: string]: any;
    }> = [];

    let currentBucketStart = startTime;
    let cumArrivals = 0;
    let cumDeliveries = 0;

    while (currentBucketStart <= endTime) {
      const currentBucketEnd = currentBucketStart + bucketMs;
      const bucketEvents = events.filter((e) => {
        const t = new Date(e.occurredAt).getTime();
        return t >= currentBucketStart && t < currentBucketEnd;
      });

      const arrivals = bucketEvents.filter((e) => e.eventType === 'ARRIVAL').length;
      const deliveries = bucketEvents.filter((e) => e.eventType === 'DELIVERY').length;

      cumArrivals += arrivals;
      cumDeliveries += deliveries;
      const queueLen = Math.max(0, cumArrivals - cumDeliveries);

      const bucketDate = new Date(currentBucketStart);
      const timeLabel = bucketDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const bucketData: any = {
        timestamp: bucketDate.toISOString(),
        label: timeLabel,
        arrivals,
        totalDeliveries: deliveries,
        cumulativeArrivals: cumArrivals,
        cumulativeDeliveries: cumDeliveries,
        estimatedQueueLength: queueLen,
      };

      for (const att of collection.attendants) {
        bucketData[`deliveries_${att.code}`] = bucketEvents.filter(
          (e) => e.eventType === 'DELIVERY' && e.attendantId === att.id
        ).length;
      }

      buckets.push(bucketData);
      currentBucketStart = currentBucketEnd;
    }

    return buckets;
  }

  async getDashboardSummary(userId: string) {
    const [totalCollections, inProgressCollections, recentCollections, totalDeliveriesResult] = await Promise.all([
      prisma.collection.count({ where: { ownerId: userId } }),
      prisma.collection.findMany({
        where: { ownerId: userId, status: 'IN_PROGRESS' },
        include: { attendants: true, _count: { select: { events: { where: { isVoided: false } } } } },
      }),
      prisma.collection.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          attendants: true,
          _count: {
            select: {
              events: { where: { isVoided: false } },
            },
          },
        },
      }),
      prisma.event.count({
        where: {
          collection: { ownerId: userId },
          eventType: 'DELIVERY',
          isVoided: false,
        },
      }),
    ]);

    // Última coleta encerrada
    const lastFinished = await prisma.collection.findFirst({
      where: { ownerId: userId, status: 'FINISHED' },
      orderBy: { endedAt: 'desc' },
      include: { attendants: true },
    });

    let lastFinishedMetrics = null;
    if (lastFinished) {
      try {
        lastFinishedMetrics = await this.getCollectionMetrics(userId, lastFinished.id);
      } catch (e) {
        // Ignora se não houver dados suficientes
      }
    }

    return {
      totalCollections,
      inProgressCount: inProgressCollections.length,
      inProgressCollections,
      totalDeliveries: totalDeliveriesResult,
      recentCollections,
      lastFinishedMetrics,
    };
  }

  async exportRawCsv(userId: string, collectionId: string) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
    });

    if (!collection) {
      throw new AppError('Coleta não encontrada.', 404);
    }

    const events = await prisma.event.findMany({
      where: { collectionId },
      orderBy: { occurredAt: 'asc' },
      include: { attendant: true, queue: true },
    });

    return generateRawEventsCsv(events);
  }

  async exportAggregatedCsv(userId: string, collectionId: string) {
    const { collection, metrics } = await this.getCollectionMetrics(userId, collectionId);
    return generateAggregatedMetricsCsv(collection, metrics);
  }
}

export const metricsService = new MetricsService();
