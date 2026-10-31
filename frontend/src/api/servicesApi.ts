import { apiRequest } from './client.js';

export const servicesApi = {
  async startService(collectionId: string, data: { attendantId: string; queueId?: string }) {
    const res = await apiRequest<{ success: boolean; data: any }>(`/collections/${collectionId}/services/start`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async finishService(
    collectionId: string,
    data: {
      attendantId: string;
      serviceIntervalId?: string;
      idempotencyKey: string;
      proteinAmount?: number;
      measurementMethod?: 'MEASURED' | 'ESTIMATED';
      proteinNotes?: string;
    }
  ) {
    const res = await apiRequest<{ success: boolean; data: any }>(`/collections/${collectionId}/services/finish`, {
      method: 'POST',
      idempotencyKey: data.idempotencyKey,
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async getActiveServices(collectionId: string) {
    const res = await apiRequest<{ success: boolean; data: any[] }>(`/collections/${collectionId}/services/active`);
    return res.data;
  },

  async createInterruption(
    collectionId: string,
    data: { attendantId?: string; interruptionType: string; notes?: string }
  ) {
    const res = await apiRequest<{ success: boolean; data: any }>(`/collections/${collectionId}/interruptions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async listInterruptions(collectionId: string) {
    const res = await apiRequest<{ success: boolean; data: any[] }>(`/collections/${collectionId}/interruptions`);
    return res.data;
  },

  async finishInterruption(collectionId: string, interruptionId: string) {
    const res = await apiRequest<{ success: boolean; data: any }>(
      `/collections/${collectionId}/interruptions/${interruptionId}/finish`,
      { method: 'POST' }
    );
    return res.data;
  },
};
