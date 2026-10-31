import { apiRequest } from './client.js';

export interface QueuedEvent {
  id: string; // idempotencyKey
  collectionId: string;
  eventType: 'ARRIVAL' | 'DELIVERY' | 'OBSERVATION';
  attendantId?: string;
  queueId?: string;
  occurredAt: string;
  metadata?: any;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

const STORAGE_KEY = 'ru_metrics_offline_events_queue';

export function getOfflineQueue(): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Falha ao persistir fila offline no armazenamento local', e);
  }
}

export function enqueueOfflineEvent(event: Omit<QueuedEvent, 'status' | 'retryCount'>): QueuedEvent {
  const queue = getOfflineQueue();
  const queuedItem: QueuedEvent = {
    ...event,
    status: 'PENDING',
    retryCount: 0,
  };
  queue.push(queuedItem);
  saveOfflineQueue(queue);
  return queuedItem;
}

export async function flushOfflineQueue(): Promise<{ syncedCount: number; remainingCount: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

  const remaining: QueuedEvent[] = [];
  let syncedCount = 0;

  for (const item of queue) {
    try {
      await apiRequest(`/collections/${item.collectionId}/events`, {
        method: 'POST',
        idempotencyKey: item.id,
        body: JSON.stringify({
          eventType: item.eventType,
          attendantId: item.attendantId,
          queueId: item.queueId,
          occurredAt: item.occurredAt,
          idempotencyKey: item.id,
          metadata: { ...item.metadata, syncedFromOffline: true },
        }),
      });
      syncedCount++;
    } catch (error: any) {
      if (error?.status === 0 || error?.code === 'NETWORK_ERROR') {
        // Ainda offline, interrompe e mantém os demais na fila
        remaining.push({ ...item, status: 'PENDING', retryCount: item.retryCount + 1 });
      } else {
        // Erro de validação ou idempotência (já gravado)
        if (error?.status === 200) {
          syncedCount++;
        } else {
          remaining.push({
            ...item,
            status: 'FAILED',
            lastError: error.message,
            retryCount: item.retryCount + 1,
          });
        }
      }
    }
  }

  saveOfflineQueue(remaining);
  return { syncedCount, remainingCount: remaining.length };
}
