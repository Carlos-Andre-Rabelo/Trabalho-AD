import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { collectionsApi, Collection } from '../api/collections.js';
import { eventsApi, EventItem } from '../api/events.js';
import { servicesApi } from '../api/servicesApi.js';
import { useCollectionSync } from '../hooks/useCollectionSync.js';
import { playSuccessBeep, playArrivalClick, triggerHaptic } from '../utils/sound.js';
import { formatSecondsToStopwatch } from '../utils/formatters.js';
import { RotateCcw, Volume2, VolumeX, AlertCircle, Play, CheckCircle2 } from 'lucide-react';
import { getServiceTimes } from '../components/operational/EventLogQuickView.js';

export const RemoteOperationalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get('token');

  const [token, setToken] = useState<string>(() => {
    if (queryToken) {
      localStorage.setItem('ru_metrics_token', queryToken);
      return queryToken;
    }
    return localStorage.getItem('ru_metrics_token') || '';
  });

  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalArrivals, setTotalArrivals] = useState(0);
  const [deliveriesByAttendant, setDeliveriesByAttendant] = useState<Record<string, number>>({});
  const [activeServices, setActiveServices] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<EventItem[]>([]);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isArrivalPending, setIsArrivalPending] = useState(false);
  const [pendingActionByAttendant, setPendingActionByAttendant] = useState<Record<string, boolean>>({});

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aferidorLabel, setAferidorLabel] = useState(() => {
    return localStorage.getItem('ru_aferidor_label') || 'Celular';
  });
  const [selectedFocus, setSelectedFocus] = useState<string>('all');

  // Relógio do cronômetro para atendimentos ativos no celular
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (activeServices.length === 0) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeServices.length]);

  // Deduplicação entre HTTP e SSE + lock contra duplo toque
  const processedEventIds = useRef<Set<string>>(new Set());
  const voidedEventIds = useRef<Set<string>>(new Set());
  const arrivalLockRef = useRef(false);
  const serviceLockRef = useRef<Record<string, boolean>>({});

  const applyEventCreated = useCallback((event: EventItem) => {
    setRecentEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)].slice(0, 10));
    if (processedEventIds.current.has(event.id)) return;
    processedEventIds.current.add(event.id);

    if (!event.isVoided) {
      if (event.eventType === 'ARRIVAL') {
        setTotalArrivals((prev) => prev + 1);
      } else if (event.eventType === 'DELIVERY' && event.attendantId) {
        setDeliveriesByAttendant((prev) => ({
          ...prev,
          [event.attendantId!]: (prev[event.attendantId!] || 0) + 1,
        }));
      }
    }
  }, []);

  const applyEventVoided = useCallback((voidedEvent: EventItem) => {
    setRecentEvents((prev) =>
      prev.map((e) => (e.id === voidedEvent.id ? { ...e, isVoided: true } : e))
    );
    if (voidedEventIds.current.has(voidedEvent.id)) return;
    voidedEventIds.current.add(voidedEvent.id);

    if (voidedEvent.eventType === 'ARRIVAL') {
      setTotalArrivals((prev) => Math.max(0, prev - 1));
    } else if (voidedEvent.eventType === 'DELIVERY' && voidedEvent.attendantId) {
      setDeliveriesByAttendant((prev) => ({
        ...prev,
        [voidedEvent.attendantId!]: Math.max(0, (prev[voidedEvent.attendantId!] || 1) - 1),
      }));
    }
  }, []);

  useEffect(() => {
    if (queryToken && queryToken !== token) {
      setToken(queryToken);
      localStorage.setItem('ru_metrics_token', queryToken);
    }
  }, [queryToken, token]);

  const loadInitialData = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [colData, recent, active] = await Promise.all([
        collectionsApi.getById(id),
        eventsApi.recent(id),
        servicesApi.getActiveServices(id),
      ]);

      setCollection(colData);
      setRecentEvents(recent);
      setActiveServices(active);

      recent.forEach((e) => {
        processedEventIds.current.add(e.id);
        if (e.isVoided) voidedEventIds.current.add(e.id);
      });

      const deliveries: Record<string, number> = {};
      colData.attendants.forEach((a) => {
        deliveries[a.id] = colData.eventCounts?.deliveriesByAttendant?.[a.id] ?? 0;
      });

      if (colData.eventCounts) {
        setDeliveriesByAttendant(deliveries);
        setTotalArrivals(colData.eventCounts.arrivals);
      } else {
        let arrivals = 0;
        recent.forEach((e) => {
          if (!e.isVoided) {
            if (e.eventType === 'ARRIVAL') arrivals++;
            if (e.eventType === 'DELIVERY' && e.attendantId) {
              deliveries[e.attendantId] = (deliveries[e.attendantId] || 0) + 1;
            }
          }
        });
        setDeliveriesByAttendant(deliveries);
        setTotalArrivals(arrivals);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao conectar.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSyncState = useCallback((syncData: any) => {
    if (syncData.eventCounts) {
      setTotalArrivals((prev) => Math.max(prev, syncData.eventCounts.arrivals));
      setDeliveriesByAttendant((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(syncData.eventCounts.deliveriesByAttendant as Record<string, number>)) {
          next[k] = Math.max(next[k] || 0, v);
        }
        return next;
      });
    }
    if (syncData.activeServices && Array.isArray(syncData.activeServices)) {
      setActiveServices(syncData.activeServices);
    }
    if (syncData.status) {
      setCollection((prev) => (prev ? { ...prev, status: syncData.status } : prev));
    }
  }, []);

  const { isConnected } = useCollectionSync({
    collectionId: id,
    token,
    onEventCreated: applyEventCreated,
    onEventVoided: applyEventVoided,
    onSyncState: handleSyncState,
    onStatusChanged: (updatedCol) => {
      setCollection((prev) => (prev ? { ...prev, status: updatedCol.status } : updatedCol));
    },
    onServiceStarted: (interval) => {
      setActiveServices((prev) => {
        if (prev.some((s) => s.attendantId === interval.attendantId)) return prev;
        return [...prev, interval];
      });
    },
    onServiceFinished: ({ interval, event }) => {
      setActiveServices((prev) => prev.filter((s) => s.attendantId !== interval.attendantId));
      if (event) applyEventCreated(event);
    },
    onServiceCancelled: ({ attendantId }) => {
      setActiveServices((prev) => prev.filter((s) => s.attendantId !== attendantId));
    },
  });

  const handleAferidorLabelChange = (newLabel: string) => {
    setAferidorLabel(newLabel);
    localStorage.setItem('ru_aferidor_label', newLabel);
  };

  const triggerSensoryFeedback = (type: 'arrival' | 'delivery') => {
    triggerHaptic(type === 'arrival' ? 35 : 55);
    if (soundEnabled) {
      if (type === 'arrival') playArrivalClick();
      else playSuccessBeep();
    }
  };

  const handleRegisterArrival = () => {
    if (!id || !collection || collection.status !== 'IN_PROGRESS') return;
    triggerSensoryFeedback('arrival');

    const idempotencyKey = `mob-arr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();

    // 1. Atualização otimista imediata no celular (0ms delay)
    setTotalArrivals((prev) => prev + 1);

    const optimisticEvent: EventItem = {
      id: idempotencyKey,
      collectionId: id,
      eventType: 'ARRIVAL',
      occurredAt: nowIso,
      recordedAt: nowIso,
      idempotencyKey,
      isVoided: false,
    };
    applyEventCreated(optimisticEvent);
    setLastEventId(idempotencyKey);

    // 2. Disparo assíncrono em background sem travar cliques subsequentes
    eventsApi
      .create(id, {
        eventType: 'ARRIVAL',
        idempotencyKey,
        occurredAt: nowIso,
        metadata: {
          remote: true,
          device: 'mobile',
          aferidor: aferidorLabel,
        },
      })
      .then((newEvent) => {
        processedEventIds.current.add(newEvent.id);
        setRecentEvents((prev) => prev.map((e) => (e.id === idempotencyKey ? newEvent : e)));
        setLastEventId(newEvent.id);
      })
      .catch((err) => {
        console.error('Falha ao registrar chegada:', err);
        setTotalArrivals((prev) => Math.max(0, prev - 1));
        setRecentEvents((prev) => prev.filter((e) => e.id !== idempotencyKey));
      });
  };

  const handleStartService = (attendantId: string) => {
    if (!id || !collection || collection.status !== 'IN_PROGRESS') return;
    triggerSensoryFeedback('arrival');

    const tempIntervalId = `mob-srv-${Date.now()}`;
    const optimisticInterval = {
      id: tempIntervalId,
      collectionId: id,
      attendantId,
      startedAt: new Date().toISOString(),
    };

    // 1. Atualização otimista imediata
    setActiveServices((prev) => {
      if (prev.some((s) => s.attendantId === attendantId)) return prev;
      return [...prev, optimisticInterval];
    });

    // 2. Disparo assíncrono em background
    servicesApi
      .startService(id, { attendantId })
      .then((realInterval) => {
        setActiveServices((prev) =>
          prev.map((s) => (s.id === tempIntervalId ? realInterval : s))
        );
      })
      .catch((err) => {
        console.error('Falha ao iniciar atendimento:', err);
        setActiveServices((prev) => prev.filter((s) => s.id !== tempIntervalId));
      });
  };

  const handleFinishService = (attendantId: string, serviceIntervalId?: string) => {
    if (!id || !collection || collection.status !== 'IN_PROGRESS') return;
    triggerSensoryFeedback('delivery');

    const idempotencyKey = `mob-del-${attendantId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 1. Atualização otimista imediata
    setActiveServices((prev) => prev.filter((s) => s.attendantId !== attendantId));
    setDeliveriesByAttendant((prev) => ({
      ...prev,
      [attendantId]: (prev[attendantId] || 0) + 1,
    }));

    // 2. Disparo assíncrono em background
    servicesApi
      .finishService(id, {
        attendantId,
        serviceIntervalId: serviceIntervalId?.startsWith('mob-') ? undefined : serviceIntervalId,
        idempotencyKey,
      })
      .then((result) => {
        if (result.event) {
          applyEventCreated(result.event);
          setLastEventId(result.event.id);
        }
      })
      .catch((err) => {
        console.error('Falha ao finalizar atendimento:', err);
        setDeliveriesByAttendant((prev) => ({
          ...prev,
          [attendantId]: Math.max(0, (prev[attendantId] || 1) - 1),
        }));
      });
  };

  const handleUndoLastEvent = async () => {
    if (!id || !lastEventId || isVoiding) return;
    setIsVoiding(true);
    triggerHaptic(60);

    try {
      const targetId = lastEventId;
      setLastEventId(null);
      const updated = await eventsApi.void(id, targetId, `Desfeito por ${aferidorLabel}`);
      applyEventVoided(updated);
    } catch (err) {
      console.error('Falha ao desfazer evento:', err);
    } finally {
      setIsVoiding(false);
    }
  };

  const totalDeliveries = useMemo(() => {
    return Object.values(deliveriesByAttendant).reduce((a, b) => a + b, 0);
  }, [deliveriesByAttendant]);

  const targetDurationMinutes = useMemo(() => {
    if (typeof collection?.targetDurationMinutes === 'number' && collection.targetDurationMinutes > 0) {
      return collection.targetDurationMinutes;
    }
    if (collection?.notes) {
      try {
        const parsed = JSON.parse(collection.notes);
        if (parsed && typeof parsed.targetDurationMinutes === 'number' && parsed.targetDurationMinutes > 0) {
          return parsed.targetDurationMinutes;
        }
      } catch {}
      const match = collection.notes.match(/\[DURATION:(\d+)\]/);
      if (match) return parseInt(match[1], 10);
    }
    return null;
  }, [collection?.targetDurationMinutes, collection?.notes]);

  const remainingSec = useMemo(() => {
    if (!targetDurationMinutes) return null;
    if (!collection?.startedAt) return targetDurationMinutes * 60;
    const start = new Date(collection.startedAt).getTime();
    const end = collection.endedAt ? new Date(collection.endedAt).getTime() : nowMs;
    const elapsed = Math.max(0, Math.floor((end - start) / 1000));
    return Math.max(0, targetDurationMinutes * 60 - elapsed);
  }, [targetDurationMinutes, collection?.startedAt, collection?.endedAt, nowMs]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 text-sm">
        Conectando...
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <p className="text-xs text-slate-300">{error || 'Coleta não encontrada.'}</p>
        <button
          onClick={loadInitialData}
          className="px-4 py-2 bg-blue-600 rounded text-xs font-bold text-white"
        >
          Reconectar
        </button>
      </div>
    );
  }

  const isCollectionActive = collection.status === 'IN_PROGRESS';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none pb-6">
      {/* Header Plano */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="truncate">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <h1 className="font-bold text-xs text-white truncate">{collection.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={aferidorLabel}
            onChange={(e) => handleAferidorLabelChange(e.target.value)}
            className="bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-700 w-24 text-center focus:outline-none focus:border-blue-500"
            placeholder="Aferidor"
          />
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded border ${
              soundEnabled ? 'text-blue-400 border-blue-800 bg-slate-900' : 'text-slate-500 border-slate-700 bg-slate-900'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {!isCollectionActive && (
        <div className="mx-4 mt-3 p-2.5 rounded bg-amber-950 border border-amber-800 text-amber-200 text-xs text-center font-medium">
          {collection.status === 'DRAFT' && 'Aguardando início da coleta no computador.'}
          {collection.status === 'PAUSED' && 'Coleta pausada.'}
          {collection.status === 'FINISHED' && 'Coleta encerrada.'}
        </div>
      )}

      {/* Placar Plano */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
        <div className="bg-slate-800 border border-slate-700 rounded p-2.5 flex items-baseline justify-between">
          <span className="text-xs text-slate-400">Chegadas</span>
          <span className="text-xl font-bold text-blue-400 font-mono">{totalArrivals}</span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded p-2.5 flex items-baseline justify-between">
          <span className="text-xs text-slate-400">Entregas</span>
          <span className="text-xl font-bold text-emerald-400 font-mono">{totalDeliveries}</span>
        </div>
      </div>

      {/* Temporizador Regressivo em Caso de Duração Definida */}
      {remainingSec !== null && (
        <div className="mx-4 mt-2 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Tempo Restante:
          </span>
          <span
            className={`font-mono font-bold text-sm ${
              remainingSec <= 60
                ? 'text-rose-400 animate-pulse'
                : remainingSec <= 300
                ? 'text-amber-400'
                : 'text-white'
            }`}
          >
            {formatSecondsToStopwatch(remainingSec)}
          </span>
        </div>
      )}

      {/* Filtro de Foco */}
      <div className="mx-4 mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedFocus('all')}
          className={`px-2.5 py-1 rounded font-semibold whitespace-nowrap ${
            selectedFocus === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setSelectedFocus('arrivals')}
          className={`px-2.5 py-1 rounded font-semibold whitespace-nowrap ${
            selectedFocus === 'arrivals' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          Chegadas
        </button>
        {collection.attendants.map((att) => (
          <button
            key={att.id}
            onClick={() => setSelectedFocus(att.id)}
            className={`px-2.5 py-1 rounded font-semibold whitespace-nowrap ${
              selectedFocus === att.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {att.displayName}
          </button>
        ))}
      </div>

      {/* Botões de Registro com Estados Iniciar e Finalizou Atendimento */}
      <main className="mx-4 mt-3 flex-1 space-y-2.5">
        {(selectedFocus === 'all' || selectedFocus === 'arrivals') && (
          <button
            onClick={handleRegisterArrival}
            disabled={!isCollectionActive || isArrivalPending}
            className={`w-full ${
              selectedFocus === 'arrivals' ? 'h-52' : 'h-24'
            } rounded-lg p-3 flex flex-col justify-center items-center text-center transition-colors ${
              isCollectionActive
                ? 'bg-blue-600 active:bg-blue-700 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span className="text-xl font-bold">+1 CHEGADA</span>
            <span className="text-xs text-blue-100 mt-0.5 font-mono">Total: {totalArrivals}</span>
          </button>
        )}

        {collection.attendants.map((att) => {
          if (selectedFocus !== 'all' && selectedFocus !== att.id) return null;
          const count = deliveriesByAttendant[att.id] || 0;
          const isSolo = selectedFocus === att.id;
          const isPending = !!pendingActionByAttendant[att.id];
          const active = activeServices.find((s) => s.attendantId === att.id);
          const isBusy = !!active;

          let elapsedSec = 0;
          if (active) {
            const start = new Date(active.startedAt).getTime();
            elapsedSec = Math.max(0, Math.floor((nowMs - start) / 1000));
          }

          if (!isBusy) {
            return (
              <button
                key={att.id}
                onClick={() => handleStartService(att.id)}
                disabled={!isCollectionActive || isPending}
                className={`w-full ${
                  isSolo ? 'h-52' : 'h-24'
                } rounded-lg p-3 flex flex-col justify-center items-center transition-colors ${
                  isCollectionActive
                    ? 'bg-blue-700 active:bg-blue-800 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Play className="w-5 h-5 fill-current" />
                  <span className="text-lg font-bold">
                    Iniciar Atendimento ({att.displayName})
                  </span>
                </div>
                <span className="text-xs text-blue-200 mt-1 font-mono">
                  Concluídos: {count}
                </span>
              </button>
            );
          }

          return (
            <button
              key={att.id}
              onClick={() => handleFinishService(att.id, active?.id)}
              disabled={!isCollectionActive || isPending}
              className={`w-full ${
                isSolo ? 'h-52' : 'h-24'
              } rounded-lg p-3 flex flex-col justify-center items-center transition-colors ${
                isCollectionActive
                  ? 'bg-emerald-600 active:bg-emerald-700 text-white ring-2 ring-emerald-400'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-lg font-bold">
                  Finalizou Atendimento ({att.displayName})
                </span>
              </div>
              <span className="text-xs text-emerald-100 font-mono font-bold mt-1 bg-black/20 px-2 py-0.5 rounded">
                Em andamento: {formatSecondsToStopwatch(elapsedSec)}
              </span>
            </button>
          );
        })}

        {lastEventId && (
          <button
            onClick={handleUndoLastEvent}
            disabled={isVoiding}
            className="w-full py-2.5 px-4 rounded bg-slate-800 border border-slate-700 text-rose-400 text-xs font-semibold flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isVoiding ? 'Desfazendo...' : 'Desfazer último registro'}</span>
          </button>
        )}
      </main>

      {/* Histórico em Retângulos de Atendimento no Mobile */}
      {recentEvents.length > 0 && (
        <footer className="mx-4 mt-4 pt-3 border-t border-slate-800 text-xs space-y-2">
          <span className="font-semibold text-[11px] text-slate-400 uppercase tracking-wide">
            Últimos Registros
          </span>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
            {recentEvents.slice(0, 5).map((ev) => {
              if (ev.eventType === 'DELIVERY') {
                const times = getServiceTimes(ev);
                return (
                  <div
                    key={ev.id}
                    className={`border rounded-lg p-2.5 bg-slate-800/90 text-xs space-y-2 ${
                      ev.isVoided ? 'border-rose-900/60 opacity-60' : 'border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                          Atendimento
                        </span>
                        <span className="font-bold text-white text-xs">
                          {ev.attendant?.displayName || 'Atendente'}
                        </span>
                        {ev.isVoided && <span className="text-rose-400 text-[10px]">(Anulado)</span>}
                      </div>
                      <span className="font-mono text-xs font-bold text-blue-400">
                        Tempo: {times.durationSeconds}s
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-slate-900/90 p-1.5 rounded border border-slate-700/80">
                        <span className="text-slate-400 block font-semibold text-[9px] uppercase tracking-wider">
                          Início
                        </span>
                        <span className="font-mono font-bold text-slate-200">
                          {times.startTimeStr}
                        </span>
                      </div>
                      <div className="bg-slate-900/90 p-1.5 rounded border border-slate-700/80">
                        <span className="text-slate-400 block font-semibold text-[9px] uppercase tracking-wider">
                          Fim
                        </span>
                        <span className="font-mono font-bold text-slate-200">
                          {times.endTimeStr}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={ev.id}
                  className={`border rounded-lg p-2.5 bg-slate-800/90 flex items-center justify-between ${
                    ev.isVoided ? 'border-rose-900/60 opacity-60' : 'border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-950 text-blue-400 border border-blue-800 uppercase">
                      Chegada
                    </span>
                    <span className="font-mono text-slate-300 text-xs">
                      {new Date(ev.occurredAt).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
};
