import { useEffect, useState, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../api/client.js';
import { collectionsApi } from '../api/collections.js';
import { updateServerClock } from '../operational/clock.js';

export interface SyncStateData {
  status: 'DRAFT' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED';
  targetDurationMinutes?: number | null;
  startedAt?: string | null;
  pausedAt?: string | null;
  finishedAt?: string | null;
  pauses?: Array<{ id: string; startedAt: string; endedAt: string | null; reason: string | null }>;
  deadlineAt?: string | null;
  remainingMs?: number | null;
  serverTime: string;
  eventCounts: {
    arrivals: number;
    deliveriesByAttendant: Record<string, number>;
  };
  eventStates?: Array<[string, boolean, string]>;
  activeServices: any[];
  recentEvents: any[];
}

export interface UseCollectionSyncOptions {
  collectionId?: string;
  token?: string;
  onSyncState?: (data: SyncStateData, seq: number) => void;
  onStatusChanged?: (collection: any) => void;
  onClientsChange?: (count: number) => void;
}

export function useCollectionSync({
  collectionId,
  token,
  onSyncState,
  onStatusChanged,
  onClientsChange,
}: UseCollectionSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedClients, setConnectedClients] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const callbacksRef = useRef({
    onSyncState,
    onStatusChanged,
    onClientsChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSyncState,
      onStatusChanged,
      onClientsChange,
    };
  });

  const pollNowRef = useRef<() => void>(() => {});

  const pollNow = useCallback(() => {
    pollNowRef.current();
  }, []);

  useEffect(() => {
    if (!collectionId) return;
    const activeCollectionId: string = collectionId;

    const activeToken = token || localStorage.getItem('ru_metrics_token');
    if (!activeToken) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let pollTimer: any = null;
    let sseDebounceTimer: any = null;
    let isUnmounted = false;
    let isPolling = false;
    let pendingImmediatePoll = false;
    let seqCounter = 0;
    let lastKnownStatus = 'IN_PROGRESS';

    function getPollIntervalMs() {
      if (lastKnownStatus === 'IN_PROGRESS') return 1200;
      if (lastKnownStatus === 'FINISHED') return 6000;
      return 3000;
    }

    function scheduleNextPoll(delayMs = getPollIntervalMs()) {
      if (isUnmounted) return;
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(runPoll, delayMs);
    }

    function triggerImmediatePoll() {
      if (isUnmounted) return;
      if (isPolling) {
        pendingImmediatePoll = true;
        return;
      }
      scheduleNextPoll(0);
    }

    function triggerDebouncedPoll() {
      if (isUnmounted) return;
      if (sseDebounceTimer) return;
      sseDebounceTimer = setTimeout(() => {
        sseDebounceTimer = null;
        triggerImmediatePoll();
      }, 60);
    }

    pollNowRef.current = triggerImmediatePoll;

    async function runPoll() {
      if (isUnmounted) return;
      if (isPolling) {
        pendingImmediatePoll = true;
        return;
      }

      isPolling = true;
      const mySeq = ++seqCounter;
      const t0 = Date.now();

      try {
        const syncData = await collectionsApi.getSyncState(activeCollectionId);
        if (isUnmounted) return;

        const rttMs = Date.now() - t0;
        updateServerClock(syncData.serverTime, rttMs);

        setIsConnected(true);
        setLastSyncTime(new Date());
        lastKnownStatus = syncData.status || lastKnownStatus;

        callbacksRef.current.onSyncState?.(syncData, mySeq);

        if (syncData.status) {
          callbacksRef.current.onStatusChanged?.({
            status: syncData.status,
            targetDurationMinutes: syncData.targetDurationMinutes,
            startedAt: syncData.startedAt,
            endedAt: syncData.finishedAt,
            pauses: syncData.pauses,
            deadlineAt: syncData.deadlineAt,
            remainingMs: syncData.remainingMs,
          });
        }
      } catch {
        // Falha transitória de rede tratada silenciosamente
      } finally {
        isPolling = false;
        if (!isUnmounted) {
          if (pendingImmediatePoll) {
            pendingImmediatePoll = false;
            scheduleNextPoll(40);
          } else {
            scheduleNextPoll(getPollIntervalMs());
          }
        }
      }
    }

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
            } catch {}
          }
        });

        // Qualquer evento SSE atua apenas como gatilho imediato de poll (fonte única de verdade = snapshot)
        const triggerEvents = [
          'event:created',
          'event:voided',
          'collection:status',
          'service:started',
          'service:finished',
          'service:cancelled',
        ];
        for (const evName of triggerEvents) {
          eventSource.addEventListener(evName, () => {
            if (!isUnmounted) {
              triggerDebouncedPoll();
            }
          });
        }

        eventSource.onerror = () => {
          if (!isUnmounted) {
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            reconnectTimeout = setTimeout(connectSSE, 4000);
          }
        };
      } catch {
        reconnectTimeout = setTimeout(connectSSE, 5000);
      }
    }

    connectSSE();
    scheduleNextPoll(80);

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollTimer) clearTimeout(pollTimer);
      if (sseDebounceTimer) clearTimeout(sseDebounceTimer);
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
    pollNow,
  };
}
