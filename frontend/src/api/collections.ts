import { apiRequest } from './client.js';

export type CollectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED';
export type QueueMode = 'SEPARATE_QUEUES' | 'SINGLE_QUEUE' | 'CUSTOM';

export interface Attendant {
  id: string;
  code: string;
  displayName: string;
}

export interface Queue {
  id: string;
  name: string;
}

export interface Collection {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  timezone: string;
  queueMode: QueueMode;
  status: CollectionStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  attendants: Attendant[];
  queues: Queue[];
  pauses?: Array<{ id: string; startedAt: string; endedAt: string | null; reason: string | null }>;
  _count?: {
    events: number;
    serviceIntervals?: number;
    proteinMeasurements?: number;
  };
}

export const collectionsApi = {
  async list(params?: { status?: CollectionStatus; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiRequest<{ success: boolean; data: Collection[]; pagination: any }>(`/collections${qs}`);
    return res;
  },

  async getById(id: string): Promise<Collection> {
    const res = await apiRequest<{ success: boolean; data: Collection }>(`/collections/${id}`);
    return res.data;
  },

  async create(data: {
    title: string;
    description?: string;
    location?: string;
    queueMode: QueueMode;
    attendants: Array<{ code: string; displayName: string }>;
    queues?: string[];
    notes?: string;
  }): Promise<Collection> {
    const res = await apiRequest<{ success: boolean; data: Collection }>('/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async update(id: string, data: { title?: string; description?: string; location?: string; notes?: string }) {
    const res = await apiRequest<{ success: boolean; data: Collection }>(`/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async start(id: string): Promise<Collection> {
    const res = await apiRequest<{ success: boolean; data: Collection }>(`/collections/${id}/start`, {
      method: 'POST',
    });
    return res.data;
  },

  async pause(id: string, reason?: string): Promise<Collection> {
    const res = await apiRequest<{ success: boolean; data: Collection }>(`/collections/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },

  async resume(id: string): Promise<Collection> {
    const res = await apiRequest<{ success: boolean; data: Collection }>(`/collections/${id}/resume`, {
      method: 'POST',
    });
    return res.data;
  },

  async finish(id: string): Promise<Collection> {
    const res = await apiRequest<{ success: boolean; data: Collection }>(`/collections/${id}/finish`, {
      method: 'POST',
    });
    return res.data;
  },

  async reopen(id: string, reason: string): Promise<Collection> {
    const res = await apiRequest<{ success: boolean; data: Collection }>(`/collections/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },
};
