import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Collection, collectionsApi } from '../api/collections.js';
import { eventsApi } from '../api/events.js';
import { servicesApi } from '../api/servicesApi.js';
import {
  createInitialLedgerState,
  DerivedActiveService,
  DerivedLogItem,
  LedgerOp,
  normalizeRawSnapshot,
  reduceLedger,
  selectActiveServices,
  selectArrivals,
  selectArrivalsByAttendant,
  selectArrivalsByQueue,
  selectDeliveries,
  selectLogItems,
} from '../operational/ledger.js';
import { serverNowIso } from '../operational/clock.js';
import { SyncStateData, useCollectionSync } from './useCollectionSync.js';

function getStorageKey(collectionId: string) {
  return `ru_ops_ledger_${collectionId}`;
}

function loadPersistedOps(collectionId?: string): LedgerOp[] {
  if (!collectionId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(collectionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((op: any) => op && op.key && op.status !== 'confirmed' && op.status !== 'rejected')
      .map((op: LedgerOp) => ({
        ...op,
        status: op.status === 'sending' ? 'queued' : op.status,
      }));
  } catch {
    return [];
  }
}

function savePersistedOps(collectionId: string | undefined, ops: LedgerOp[]) {
  if (!collectionId || typeof window === 'undefined') return;
  try {
    const toPersist = ops.filter(
      (op) => op.status !== 'confirmed' && op.status !== 'rejected'
    );
    if (toPersist.length === 0) {
      localStorage.removeItem(getStorageKey(collectionId));
    } else {
      localStorage.setItem(getStorageKey(collectionId), JSON.stringify(toPersist));
    }
  } catch {}
}

function isTransientNetworkError(err: any): boolean {
  if (!err) return false;
  if (err.code === 'NETWORK_ERROR' || err.status === 0) return true;
  if (typeof err.status === 'number' && (err.status >= 500 || err.status === 429)) return true;
  return false;
}

export interface UseOperationalLedgerOptions {
  collectionId?: string;
  token?: string;
  defaultMetadata?: Record<string, any>;
}

export function useOperationalLedger({
  collectionId,
  token,
  defaultMetadata,
}: UseOperationalLedgerOptions) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [state, dispatch] = useReducer(
    reduceLedger,
    collectionId,
    (id) => createInitialLedgerState(loadPersistedOps(id))
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const collectionRef = useRef(collection);
  collectionRef.current = collection;

  const isUnmountedRef = useRef(false);
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  // Persiste operações pendentes no localStorage
  useEffect(() => {
    savePersistedOps(collectionId, state.ops);
  }, [collectionId, state.ops]);

  // Filas seriais por atendente e controle de último intervalo real conhecido
  const attendantChainsRef = useRef<Record<string, Promise<void>>>({});
  const latestServerIntervalByAttendantRef = useRef<Record<string, string | undefined>>({});
  const lastAttendantTapMsRef = useRef<Record<string, number>>({});
  const inFlightKeysRef = useRef<Set<string>>(new Set());

  const handleSyncState = useCallback((syncData: SyncStateData, seq: number) => {
    for (const active of syncData.activeServices || []) {
      if (active?.attendantId && active?.id) {
        latestServerIntervalByAttendantRef.current[active.attendantId] = active.id;
      }
    }

    const normalized = normalizeRawSnapshot(syncData, seq);
    dispatch({ type: 'SNAPSHOT_APPLIED', snapshot: normalized });

    setCollection((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: syncData.status || prev.status,
        targetDurationMinutes:
          syncData.targetDurationMinutes !== undefined
            ? syncData.targetDurationMinutes
            : prev.targetDurationMinutes,
        startedAt: syncData.startedAt !== undefined ? syncData.startedAt : prev.startedAt,
        endedAt: syncData.finishedAt !== undefined ? syncData.finishedAt : prev.endedAt,
        pauses: syncData.pauses !== undefined ? syncData.pauses : prev.pauses,
        deadlineAt: syncData.deadlineAt !== undefined ? syncData.deadlineAt : prev.deadlineAt,
        remainingMs: syncData.remainingMs !== undefined ? syncData.remainingMs : prev.remainingMs,
      };
    });
  }, []);

  const { isConnected, connectedClients, lastSyncTime, pollNow } = useCollectionSync({
    collectionId,
    token,
    onSyncState: handleSyncState,
  });

  const reloadInitialData = useCallback(async () => {
    if (!collectionId) return;
    try {
      setLoadError(null);
      const [colData, recent, active] = await Promise.all([
        collectionsApi.getById(collectionId),
        eventsApi.recent(collectionId),
        servicesApi.getActiveServices(collectionId),
      ]);
      if (isUnmountedRef.current) return;

      for (const srv of active || []) {
        if (srv?.attendantId && srv?.id) {
          latestServerIntervalByAttendantRef.current[srv.attendantId] = srv.id;
        }
      }

      setCollection(colData);

      const initialSnapshot = normalizeRawSnapshot(
        {
          status: colData.status,
          targetDurationMinutes: colData.targetDurationMinutes,
          startedAt: colData.startedAt,
          finishedAt: colData.endedAt,
          pauses: colData.pauses,
          deadlineAt: colData.deadlineAt,
          remainingMs: colData.remainingMs,
          serverTime: new Date().toISOString(),
          eventCounts: colData.eventCounts || { arrivals: 0, deliveriesByAttendant: {} },
          activeServices: active,
          recentEvents: recent,
        },
        0
      );

      dispatch({ type: 'SNAPSHOT_APPLIED', snapshot: initialSnapshot });
    } catch (err: any) {
      if (!isUnmountedRef.current) {
        setLoadError(err?.message || 'Erro ao carregar dados operacionais da coleta.');
      }
    } finally {
      if (!isUnmountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [collectionId]);

  useEffect(() => {
    reloadInitialData();
  }, [reloadInitialData]);

  // Executor resiliente de uma operação com retry automático para erros de rede
  const executeOp = useCallback(
    async (op: LedgerOp) => {
      if (!collectionId) return;
      if (inFlightKeysRef.current.has(op.key)) return;
      inFlightKeysRef.current.add(op.key);

      let attempt = 0;
      const maxAutoRetries = 4;

      try {
        while (!isUnmountedRef.current) {
          if (stateRef.current.closed && attempt > 0) {
            dispatch({
              type: 'OP_STATUS_CHANGED',
              key: op.key,
              status: 'rejected',
              error: 'Aferição já encerrada.',
            });
            return;
          }

          dispatch({
            type: 'OP_STATUS_CHANGED',
            key: op.key,
            status: attempt === 0 ? 'sending' : 'retrying',
            retryCount: attempt,
          });

          try {
            if (op.kind === 'ARRIVAL') {
              const created = await eventsApi.create(collectionId, {
                eventType: 'ARRIVAL',
                attendantId: op.attendantId,
                queueId: op.queueId,
                idempotencyKey: op.key,
                occurredAt: op.occurredAt,
                metadata: op.metadata,
              });
              if (isUnmountedRef.current) return;
              dispatch({
                type: 'OP_STATUS_CHANGED',
                key: op.key,
                status: 'confirmed',
                serverEvent: created,
                serverEventId: created.id,
                confirmedAt: Date.now(),
              });
              pollNow();
              return;
            }

            if (op.kind === 'SERVICE_START' && op.attendantId) {
              const interval = await servicesApi.startService(collectionId, {
                attendantId: op.attendantId,
                queueId: op.queueId,
                idempotencyKey: op.key,
                occurredAt: op.occurredAt,
              });
              if (isUnmountedRef.current) return;
              if (interval?.id) {
                latestServerIntervalByAttendantRef.current[op.attendantId] = interval.id;
              }
              dispatch({
                type: 'OP_STATUS_CHANGED',
                key: op.key,
                status: 'confirmed',
                serverIntervalId: interval?.id,
                startedAt: interval?.startedAt || op.startedAt || op.occurredAt,
                confirmedAt: Date.now(),
              });
              pollNow();
              return;
            }

            if (op.kind === 'SERVICE_FINISH' && op.attendantId) {
              const knownIntervalId =
                latestServerIntervalByAttendantRef.current[op.attendantId] ||
                (op.serverIntervalId && !op.serverIntervalId.startsWith('srv-')
                  ? op.serverIntervalId
                  : undefined);

              const result = await servicesApi.finishService(collectionId, {
                attendantId: op.attendantId,
                serviceIntervalId: knownIntervalId,
                idempotencyKey: op.key,
                occurredAt: op.occurredAt,
              });
              if (isUnmountedRef.current) return;
              delete latestServerIntervalByAttendantRef.current[op.attendantId];

              const createdEvent = result?.event;
              dispatch({
                type: 'OP_STATUS_CHANGED',
                key: op.key,
                status: 'confirmed',
                serverEvent: createdEvent,
                serverEventId: createdEvent?.id,
                confirmedAt: Date.now(),
              });
              pollNow();
              return;
            }
            return;
          } catch (err: any) {
            if (isUnmountedRef.current) return;

            // Coleta já encerrada pelo servidor (ex.: fim do tempo)
            if (err?.code === 'INVALID_COLLECTION_STATUS') {
              dispatch({
                type: 'OP_STATUS_CHANGED',
                key: op.key,
                status: 'rejected',
                error: 'Aferição já encerrada.',
              });
              dispatch({ type: 'COLLECTION_CLOSED', reason: 'Aferição já encerrada.' });
              setCollection((prev) => (prev ? { ...prev, status: 'FINISHED', remainingMs: 0 } : prev));
              pollNow();
              return;
            }

            if (isTransientNetworkError(err) && attempt < maxAutoRetries) {
              attempt += 1;
              const backoffMs = Math.min(1200 * attempt, 5000);
              dispatch({
                type: 'OP_STATUS_CHANGED',
                key: op.key,
                status: 'retrying',
                retryCount: attempt,
                error: 'Aguardando conexão para confirmar...',
              });
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
              continue;
            }

            dispatch({
              type: 'OP_STATUS_CHANGED',
              key: op.key,
              status: err?.status && err.status >= 400 && err.status < 500 ? 'rejected' : 'failed',
              error: err?.message || 'Falha ao gravar registro.',
            });
            pollNow();
            return;
          }
        }
      } finally {
        inFlightKeysRef.current.delete(op.key);
      }
    },
    [collectionId, pollNow]
  );

  const enqueueAttendantOp = useCallback(
    (attendantId: string, op: LedgerOp) => {
      const prevChain = attendantChainsRef.current[attendantId] || Promise.resolve();
      const nextChain = prevChain
        .catch(() => {})
        .then(() => executeOp(op));
      attendantChainsRef.current[attendantId] = nextChain;
    },
    [executeOp]
  );

  // Reenvia operações restauradas do localStorage ou quando a conexão do navegador volta
  useEffect(() => {
    const resumePending = () => {
      for (const op of stateRef.current.ops) {
        if (op.status === 'queued' && !inFlightKeysRef.current.has(op.key)) {
          if (op.attendantId) {
            enqueueAttendantOp(op.attendantId, op);
          } else {
            executeOp(op);
          }
        }
      }
    };

    resumePending();
    window.addEventListener('online', resumePending);
    return () => window.removeEventListener('online', resumePending);
  }, [enqueueAttendantOp, executeOp]);

  const registerArrival = useCallback(
    (queueId?: string, extraMetadata?: Record<string, any>, attendantId?: string) => {
      const col = collectionRef.current;
      if (!collectionId || !col || col.status !== 'IN_PROGRESS' || stateRef.current.closed) {
        return;
      }

      const key = `arr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const occurredAt = serverNowIso();

      let resolvedQueueId = queueId;
      let resolvedAttendantId = attendantId;

      let queueObj = resolvedQueueId ? col.queues?.find((q) => q.id === resolvedQueueId) : undefined;

      if (!queueObj && resolvedAttendantId && col.queues) {
        const attForMatch = col.attendants.find((a) => a.id === resolvedAttendantId);
        queueObj =
          col.queues.find((q) => q.attendants?.some((qa) => qa.attendantId === resolvedAttendantId)) ||
          (attForMatch
            ? col.queues.find((q) => q.name.toLowerCase().includes(attForMatch.displayName.toLowerCase()))
            : undefined);
        if (queueObj) {
          resolvedQueueId = queueObj.id;
        }
      }

      if (queueObj && !resolvedAttendantId) {
        if (queueObj.attendants && queueObj.attendants.length === 1) {
          resolvedAttendantId = queueObj.attendants[0].attendantId;
        } else if (col.queueMode === 'SEPARATE_QUEUES') {
          const matchedAtt = col.attendants.find((a) =>
            queueObj!.name.toLowerCase().includes(a.displayName.toLowerCase())
          );
          if (matchedAtt) resolvedAttendantId = matchedAtt.id;
        }
      }

      if (!queueObj && !resolvedQueueId && col.queueMode === 'SINGLE_QUEUE' && col.queues?.length === 1) {
        queueObj = col.queues[0];
        resolvedQueueId = queueObj.id;
      }

      const attObj = resolvedAttendantId
        ? col.attendants.find((a) => a.id === resolvedAttendantId)
        : undefined;

      const resolvedQueueName =
        queueObj?.name || (attObj && col.queueMode === 'SEPARATE_QUEUES' ? `Fila ${attObj.displayName}` : undefined);

      const op: LedgerOp = {
        key,
        kind: 'ARRIVAL',
        collectionId,
        attendantId: resolvedAttendantId,
        attendant: attObj ? { id: attObj.id, code: attObj.code, displayName: attObj.displayName } : undefined,
        queueId: resolvedQueueId,
        queueName: resolvedQueueName,
        occurredAt,
        status: 'sending',
        retryCount: 0,
        metadata: { ...defaultMetadata, ...extraMetadata },
      };

      dispatch({ type: 'OP_ENQUEUED', op });
      executeOp(op);
    },
    [collectionId, defaultMetadata, executeOp]
  );

  const startService = useCallback(
    (attendantId: string) => {
      const col = collectionRef.current;
      if (!collectionId || !col || col.status !== 'IN_PROGRESS' || stateRef.current.closed) {
        return;
      }

      // Guarda anti duplo-toque (600ms) para evitar iniciar+finalizar acidentalmente em 0s
      const nowMs = Date.now();
      const lastTap = lastAttendantTapMsRef.current[attendantId] || 0;
      if (nowMs - lastTap < 600) return;
      lastAttendantTapMsRef.current[attendantId] = nowMs;

      const currentActive = selectActiveServices(stateRef.current);
      if (currentActive[attendantId]) return;

      const att = col.attendants.find((a) => a.id === attendantId);
      const occurredAt = serverNowIso();
      const key = `srv-start-${attendantId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const op: LedgerOp = {
        key,
        kind: 'SERVICE_START',
        collectionId,
        attendantId,
        attendant: att ? { id: att.id, code: att.code, displayName: att.displayName } : undefined,
        occurredAt,
        startedAt: occurredAt,
        status: 'sending',
        retryCount: 0,
      };

      dispatch({ type: 'OP_ENQUEUED', op });
      enqueueAttendantOp(attendantId, op);
    },
    [collectionId, enqueueAttendantOp]
  );

  const finishService = useCallback(
    (attendantId: string, activeServiceId?: string) => {
      const col = collectionRef.current;
      if (!collectionId || !col || col.status !== 'IN_PROGRESS' || stateRef.current.closed) {
        return;
      }

      // Guarda anti duplo-toque (600ms) após iniciar o atendimento
      const nowMs = Date.now();
      const lastTap = lastAttendantTapMsRef.current[attendantId] || 0;
      if (nowMs - lastTap < 600) return;
      lastAttendantTapMsRef.current[attendantId] = nowMs;

      const currentActive = selectActiveServices(stateRef.current);
      const activeForAtt = currentActive[attendantId];
      if (!activeForAtt) return;

      const att = col.attendants.find((a) => a.id === attendantId);
      const occurredAt = serverNowIso();
      const key = `del-${attendantId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const op: LedgerOp = {
        key,
        kind: 'SERVICE_FINISH',
        collectionId,
        attendantId,
        attendant: att ? { id: att.id, code: att.code, displayName: att.displayName } : undefined,
        occurredAt,
        startedAt: activeForAtt.startedAt,
        serverIntervalId: activeServiceId || activeForAtt.id,
        status: 'sending',
        retryCount: 0,
        metadata: defaultMetadata,
      };

      dispatch({ type: 'OP_ENQUEUED', op });
      enqueueAttendantOp(attendantId, op);
    },
    [collectionId, defaultMetadata, enqueueAttendantOp]
  );

  const retryOp = useCallback(
    (key: string) => {
      const op = stateRef.current.ops.find((o) => o.key === key);
      if (!op) return;
      if (op.attendantId) {
        enqueueAttendantOp(op.attendantId, op);
      } else {
        executeOp(op);
      }
    },
    [enqueueAttendantOp, executeOp]
  );

  const dismissOp = useCallback((key: string) => {
    dispatch({ type: 'OP_DISMISSED', key });
  }, []);

  const voidEvent = useCallback(
    async (
      item: {
        key: string;
        eventId?: string;
        kind: 'ARRIVAL' | 'DELIVERY' | 'SERVICE_START';
        attendantId?: string | null;
        queueId?: string | null;
      },
      reason: string
    ) => {
      if (!collectionId) return;
      if (!item.eventId) {
        dispatch({ type: 'OP_DISMISSED', key: item.key });
        return;
      }

      dispatch({
        type: 'VOID_REQUESTED',
        voidItem: {
          key: item.key,
          eventId: item.eventId,
          eventType: item.kind === 'ARRIVAL' ? 'ARRIVAL' : 'DELIVERY',
          attendantId: item.attendantId,
          queueId: item.queueId,
        },
      });

      try {
        await eventsApi.void(collectionId, item.eventId, reason);
        dispatch({ type: 'VOID_CONFIRMED', key: item.key });
        pollNow();
      } catch {
        dispatch({ type: 'VOID_FAILED', key: item.key });
      }
    },
    [collectionId, pollNow]
  );

  const handleTimerExpiredLocally = useCallback(() => {
    dispatch({
      type: 'COLLECTION_CLOSED',
      reason: 'Tempo limite da aferição esgotado.',
    });
    setCollection((prev) => (prev ? { ...prev, status: 'FINISHED', remainingMs: 0 } : prev));
    pollNow();
  }, [pollNow]);

  const totalArrivals = useMemo(() => selectArrivals(state), [state]);
  const arrivalsByQueue = useMemo(() => selectArrivalsByQueue(state), [state]);
  const arrivalsByAttendant = useMemo(() => selectArrivalsByAttendant(state), [state]);
  const deliveriesByAttendant = useMemo(() => selectDeliveries(state), [state]);
  const activeServicesByAttendant = useMemo(
    () => selectActiveServices(state),
    [state]
  );
  const logItems: DerivedLogItem[] = useMemo(() => selectLogItems(state, 12), [state]);

  return {
    collection,
    setCollection,
    isLoading,
    loadError,
    reloadInitialData,
    isConnected,
    connectedClients,
    lastSyncTime,
    pollNow,
    totalArrivals,
    arrivalsByQueue,
    arrivalsByAttendant,
    deliveriesByAttendant,
    activeServicesByAttendant,
    logItems,
    registerArrival,
    startService,
    finishService,
    retryOp,
    dismissOp,
    voidEvent,
    handleTimerExpiredLocally,
  };
}
