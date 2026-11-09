import { useEffect, useState, useRef } from 'react';
import { API_BASE_URL } from '../api/client.js';
import { collectionsApi } from '../api/collections.js';

export interface SyncStateData {
  status: string;
  targetDurationMinutes?: number | null;
  startedAt?: string | null;
  pausedAt?: string | null;
  finishedAt?: string | null;
  serverTime: string;
  eventCounts: {
    arrivals: number;
    deliveriesByAttendant: Record<string, number>;
  };
  activeServices: any[];
  recentEvents: any[];
}

export interface UseCollectionSyncOptions {
  collectionId?: string;
  token?: string;
  onEventCreated?: (event: any) => void;
  onEventVoided?: (event: any) => void;
  onStatusChanged?: (collection: any) => void;
  onClientsChange?: (count: number) => void;
  onServiceStarted?: (interval: any) => void;
  onServiceFinished?: (data: { interval: any; event: any }) => void;
  onServiceCancelled?: (data: { attendantId: string }) => void;
  onSyncState?: (data: SyncStateData) => void;
}

export function useCollectionSync({
  collectionId,
  token,
  onEventCreated,
  onEventVoided,
  onStatusChanged,
  onClientsChange,
  onServiceStarted,
  onServiceFinished,
  onServiceCancelled,
  onSyncState,
}: UseCollectionSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedClients, setConnectedClients] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Armazena callbacks em refs para evitar reconectar o EventSource ou reiniciar polling
  const callbacksRef = useRef({
    onEventCreated,
    onEventVoided,
    onStatusChanged,
    onClientsChange,
    onServiceStarted,
    onServiceFinished,
    onServiceCancelled,
    onSyncState,
  });

  useEffect(() => {
    callbacksRef.current = {
      onEventCreated,
      onEventVoided,
      onStatusChanged,
      onClientsChange,
      onServiceStarted,
      onServiceFinished,
      onServiceCancelled,
      onSyncState,
    };
  });

  useEffect(() => {
    if (!collectionId) return;
    const activeCollectionId: string = collectionId;

    const activeToken = token || localStorage.getItem('ru_metrics_token');
    if (!activeToken) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let pollTimer: any = null;
    let isUnmounted = false;
    let lastPollTimestamp = new Date(Date.now() - 30000).toISOString();

    // 1. Conexão SSE para ambientes com streaming contínuo
    function connectSSE() {
      if (isUnmounted) return;

      const base = API_BASE_URL.startsWith('http')
        ? API_BASE_URL
        : `${window.location.origin}${API_BASE_URL.startsWith('/') ? '' : '/'}${API_BASE_URL}`;

      const streamUrl = `${base}/collections/${activeCollectionId}/events/stream?token=${encodeURIComponent(activeToken as string)}`;

      try {
        eventSource = new EventSource(streamUrl);

        eventSource.onopen = () => {
          if (!isUnmounted) {
            setIsConnected(true);
            setLastSyncTime(new Date());
          }
        };

        eventSource.addEventListener('connected', () => {
          if (!isUnmounted) {
            setIsConnected(true);
            setLastSyncTime(new Date());
          }
        });

        eventSource.addEventListener('sync:clients', (e: MessageEvent) => {
          if (!isUnmounted && e.data) {
            try {
              const data = JSON.parse(e.data);
              if (typeof data.connectedClients === 'number') {
                setConnectedClients(data.connectedClients);
                callbacksRef.current.onClientsChange?.(data.connectedClients);
              }
            } catch (err) {
              console.error('Erro ao ler sync:clients', err);
            }
          }
        });

        eventSource.addEventListener('event:created', (e: MessageEvent) => {
          if (!isUnmounted && e.data) {
            try {
              const event = JSON.parse(e.data);
              setLastSyncTime(new Date());
              callbacksRef.current.onEventCreated?.(event);
            } catch (err) {
              console.error('Erro ao processar event:created', err);
            }
          }
        });

        eventSource.addEventListener('event:voided', (e: MessageEvent) => {
          if (!isUnmounted && e.data) {
            try {
              const event = JSON.parse(e.data);
              setLastSyncTime(new Date());
              callbacksRef.current.onEventVoided?.(event);
            } catch (err) {
              console.error('Erro ao processar event:voided', err);
            }
          }
        });

        eventSource.addEventListener('collection:status', (e: MessageEvent) => {
          if (!isUnmounted && e.data) {
            try {
              const col = JSON.parse(e.data);
              setLastSyncTime(new Date());
              callbacksRef.current.onStatusChanged?.(col);
            } catch (err) {
              console.error('Erro ao processar collection:status', err);
            }
          }
        });

        eventSource.addEventListener('service:started', (e: MessageEvent) => {
          if (!isUnmounted && e.data) {
            try {
              const interval = JSON.parse(e.data);
              setLastSyncTime(new Date());
              callbacksRef.current.onServiceStarted?.(interval);
            } catch (err) {
              console.error('Erro ao processar service:started', err);
            }
          }
        });

        eventSource.addEventListener('service:finished', (e: MessageEvent) => {
          if (!isUnmounted && e.data) {
            try {
              const payload = JSON.parse(e.data);
              setLastSyncTime(new Date());
              callbacksRef.current.onServiceFinished?.(payload);
            } catch (err) {
              console.error('Erro ao processar service:finished', err);
            }
          }
        });

        eventSource.addEventListener('service:cancelled', (e: MessageEvent) => {
          if (!isUnmounted && e.data) {
            try {
              const payload = JSON.parse(e.data);
              setLastSyncTime(new Date());
              callbacksRef.current.onServiceCancelled?.(payload);
            } catch (err) {
              console.error('Erro ao processar service:cancelled', err);
            }
          }
        });

        eventSource.onerror = () => {
          if (!isUnmounted) {
            setIsConnected(false);
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            reconnectTimeout = setTimeout(connectSSE, 4000);
          }
        };
      } catch (err) {
        console.error('Falha ao iniciar EventSource:', err);
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectSSE, 5000);
      }
    }

    // 2. Polling inteligente de alta frequência (a cada 1200ms)
    // Garante sincronização bidirecional em tempo real perfeita mesmo em plataformas Serverless (como Vercel)
    async function pollSync() {
      if (isUnmounted) return;
      try {
        const syncData = await collectionsApi.getSyncState(activeCollectionId, lastPollTimestamp);
        if (isUnmounted) return;

        setIsConnected(true);
        setLastSyncTime(new Date());
        lastPollTimestamp = syncData.serverTime || new Date().toISOString();

        // Dispara o callback estruturado global
        callbacksRef.current.onSyncState?.(syncData);

        // Dispara eventos novos recebidos de outros dispositivos
        if (syncData.recentEvents && syncData.recentEvents.length > 0) {
          for (const ev of syncData.recentEvents) {
            if (ev.isVoided) {
              callbacksRef.current.onEventVoided?.(ev);
            } else {
              callbacksRef.current.onEventCreated?.(ev);
            }
          }
        }

        // Atualiza status se mudou
        if (syncData.status) {
          callbacksRef.current.onStatusChanged?.({
            status: syncData.status,
            targetDurationMinutes: syncData.targetDurationMinutes,
          });
        }
      } catch (err) {
        // Silencioso em caso de micro-falhas transitórias de rede
      } finally {
        if (!isUnmounted) {
          pollTimer = setTimeout(pollSync, 1200);
        }
      }
    }

    connectSSE();
    pollTimer = setTimeout(pollSync, 600);

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollTimer) clearTimeout(pollTimer);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      setIsConnected(false);
    };
  }, [collectionId, token]);

  return {
    isConnected,
    connectedClients,
    lastSyncTime,
  };
}
