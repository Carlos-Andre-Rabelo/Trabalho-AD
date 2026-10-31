import { apiRequest } from './client.js';

export interface EventItem {
  id: string;
  collectionId: string;
  eventType: 'ARRIVAL' | 'DELIVERY' | 'OBSERVATION';
  attendantId?: string | null;
  queueId?: string | null;
  occurredAt: string;
  recordedAt: string;
  idempotencyKey: string;
  isVoided: boolean;
  voidReason?: string | null;
  attendant?: { code: string; displayName: string } | null;
  queue?: { name: string } | null;
  metadata?: any;
}

export const eventsApi = {
  async create(
    collectionId: string,
    data: {
      eventType: 'ARRIVAL' | 'DELIVERY' | 'OBSERVATION';
      attendantId?: string;
      queueId?: string;
      occurredAt?: string;
      idempotencyKey: string;
      metadata?: any;
    }
  ): Promise<EventItem> {
    const res = await apiRequest<{ success: boolean; data: EventItem }>(`/collections/${collectionId}/events`, {
      method: 'POST',
      idempotencyKey: data.idempotencyKey,
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async void(collectionId: string, eventId: string, voidReason: string): Promise<EventItem> {
    const res = await apiRequest<{ success: boolean; data: EventItem }>(
      `/collections/${collectionId}/events/${eventId}/void`,
      {
        method: 'POST',
        body: JSON.stringify({ voidReason }),
      }
    );
    return res.data;
  },

  async list(
    collectionId: string,
    params?: {
      eventType?: string;
      attendantId?: string;
      includeVoided?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const query = new URLSearchParams();
    if (params?.eventType) query.append('eventType', params.eventType);
    if (params?.attendantId) query.append('attendantId', params.attendantId);
    if (params?.includeVoided !== undefined) query.append('includeVoided', String(params.includeVoided));
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiRequest<{ success: boolean; data: EventItem[]; pagination: any }>(
      `/collections/${collectionId}/events${qs}`
    );
    return res;
  },

  async recent(collectionId: string): Promise<EventItem[]> {
    const res = await apiRequest<{ success: boolean; data: EventItem[] }>(`/collections/${collectionId}/events/recent`);
    return res.data;
  },
};
