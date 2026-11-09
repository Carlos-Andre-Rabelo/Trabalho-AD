import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { EventLogQuickView } from '../components/operational/EventLogQuickView.js';
import { useOperationalLedger } from '../hooks/useOperationalLedger.js';
import {
  playSuccessBeep,
  playArrivalClick,
  playTimerEndAlert,
  triggerHaptic,
} from '../utils/sound.js';
import { formatSecondsToStopwatch } from '../utils/formatters.js';
import { serverNow } from '../operational/clock.js';
import { RotateCcw, Volume2, VolumeX, AlertCircle, Play, CheckCircle2 } from 'lucide-react';

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

  useEffect(() => {
    if (queryToken && queryToken !== token) {
      setToken(queryToken);
      localStorage.setItem('ru_metrics_token', queryToken);
    }
  }, [queryToken, token]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aferidorLabel, setAferidorLabel] = useState(() => {
    return localStorage.getItem('ru_aferidor_label') || 'Celular';
  });
  const [selectedFocus, setSelectedFocus] = useState<string>('all');
  const [isVoidingLast, setIsVoidingLast] = useState(false);

  const defaultMetadata = useMemo(
    () => ({
      remote: true,
      device: 'mobile',
      aferidor: aferidorLabel,
    }),
    [aferidorLabel]
  );

  const {
    collection,
    isLoading,
    loadError,
    reloadInitialData,
    isConnected,
    totalArrivals,
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
  } = useOperationalLedger({
    collectionId: id,
    token,
    defaultMetadata,
  });

  // Relógio sincronizado com o servidor para atendimentos ativos e cronômetro regressivo
  const [nowMs, setNowMs] = useState(() => serverNow());
  useEffect(() => {
    if (!collection || collection.status !== 'IN_PROGRESS') return;
    const interval = setInterval(() => setNowMs(serverNow()), 500);
    return () => clearInterval(interval);
  }, [collection?.status]);

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
    if (!collection || collection.status !== 'IN_PROGRESS') return;
    triggerSensoryFeedback('arrival');
    registerArrival(undefined, {
      remote: true,
      device: 'mobile',
      aferidor: aferidorLabel,
    });
  };

  const handleStartService = (attendantId: string) => {
    if (!collection || collection.status !== 'IN_PROGRESS') return;
    triggerSensoryFeedback('arrival');
    startService(attendantId);
  };

  const handleFinishService = (attendantId: string, serviceIntervalId?: string) => {
    if (!collection || collection.status !== 'IN_PROGRESS') return;
    triggerSensoryFeedback('delivery');
    finishService(attendantId, serviceIntervalId);
  };

  const latestUndoableItem = useMemo(() => {
    return logItems.find(
      (item) =>
        item.syncStatus === 'confirmed' &&
        !item.isVoided &&
        Boolean(item.eventId) &&
        (item.kind === 'ARRIVAL' || item.kind === 'DELIVERY')
    );
  }, [logItems]);

  const handleUndoLastEvent = async () => {
    if (!latestUndoableItem || isVoidingLast) return;
    setIsVoidingLast(true);
    triggerHaptic(60);
    try {
      await voidEvent(latestUndoableItem, `Desfeito por ${aferidorLabel}`);
    } finally {
      setIsVoidingLast(false);
    }
  };

  const totalDeliveries = useMemo(() => {
    return Object.values(deliveriesByAttendant).reduce((a, b) => a + b, 0);
  }, [deliveriesByAttendant]);

  const targetDurationMinutes = useMemo(() => {
    if (
      typeof collection?.targetDurationMinutes === 'number' &&
      collection.targetDurationMinutes > 0
    ) {
      return collection.targetDurationMinutes;
    }
    if (collection?.notes) {
      try {
        const parsed = JSON.parse(collection.notes);
        if (
          parsed &&
          typeof parsed.targetDurationMinutes === 'number' &&
          parsed.targetDurationMinutes > 0
        ) {
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
    if (!collection?.startedAt || collection.status === 'DRAFT') {
      return targetDurationMinutes * 60;
    }
    if (collection.status === 'FINISHED') {
      return 0;
    }

    const start = new Date(collection.startedAt).getTime();
    const end = collection.endedAt ? new Date(collection.endedAt).getTime() : nowMs;
    const diffMs = Math.max(0, end - start);

    let pausesMs = 0;
    if (collection.pauses) {
      for (const p of collection.pauses) {
        const pStart = Math.max(start, new Date(p.startedAt).getTime());
        const pEnd = p.endedAt ? Math.min(end, new Date(p.endedAt).getTime()) : end;
        if (pEnd > pStart) pausesMs += pEnd - pStart;
      }
    }

    const elapsedSec = Math.max(0, Math.floor((diffMs - pausesMs) / 1000));
    return Math.max(0, targetDurationMinutes * 60 - elapsedSec);
  }, [
    targetDurationMinutes,
    collection?.startedAt,
    collection?.endedAt,
    collection?.status,
    collection?.pauses,
    nowMs,
  ]);

  const hasExpiredAlertedRef = useRef(false);
  useEffect(() => {
    if (collection?.status === 'DRAFT') {
      hasExpiredAlertedRef.current = false;
      return;
    }
    if (
      collection?.status === 'IN_PROGRESS' &&
      remainingSec !== null &&
      remainingSec <= 0 &&
      !hasExpiredAlertedRef.current
    ) {
      hasExpiredAlertedRef.current = true;
      if (soundEnabled) playTimerEndAlert();
      triggerHaptic(500);
      handleTimerExpiredLocally();
    }
  }, [collection?.status, remainingSec, soundEnabled, handleTimerExpiredLocally]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 text-sm">
        Conectando...
      </div>
    );
  }

  if (loadError || !collection) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <p className="text-xs text-slate-300">{loadError || 'Coleta não encontrada.'}</p>
        <button
          onClick={reloadInitialData}
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
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
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
              soundEnabled
                ? 'text-blue-400 border-blue-800 bg-slate-900'
                : 'text-slate-500 border-slate-700 bg-slate-900'
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
            <span
              className={`w-2 h-2 rounded-full ${
                isCollectionActive ? 'bg-blue-500 animate-pulse' : 'bg-slate-500'
              }`}
            />
            Tempo Restante:
          </span>
          <span
            className={`font-mono font-bold text-sm ${
              remainingSec === 0
                ? 'text-slate-500'
                : remainingSec <= 60
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
              selectedFocus === att.id
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {att.displayName}
          </button>
        ))}
      </div>

      {/* Botões de Registro Livres e Instantâneos */}
      <main className="mx-4 mt-3 flex-1 space-y-2.5">
        {(selectedFocus === 'all' || selectedFocus === 'arrivals') && (
          <button
            onClick={handleRegisterArrival}
            disabled={!isCollectionActive}
            className={`w-full ${
              selectedFocus === 'arrivals' ? 'h-52' : 'h-24'
            } rounded-lg p-3 flex flex-col justify-center items-center text-center transition-transform active:scale-95 ${
              isCollectionActive
                ? 'bg-blue-600 active:bg-blue-700 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span className="text-xl font-bold">+1 CHEGADA</span>
            <span className="text-xs text-blue-100 mt-0.5 font-mono">
              Total: {totalArrivals}
            </span>
          </button>
        )}

        {collection.attendants.map((att) => {
          if (selectedFocus !== 'all' && selectedFocus !== att.id) return null;
          const count = deliveriesByAttendant[att.id] || 0;
          const isSolo = selectedFocus === att.id;
          const active = activeServicesByAttendant[att.id];
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
                disabled={!isCollectionActive}
                className={`w-full ${
                  isSolo ? 'h-52' : 'h-24'
                } rounded-lg p-3 flex flex-col justify-center items-center transition-transform active:scale-95 ${
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
              disabled={!isCollectionActive}
              className={`w-full ${
                isSolo ? 'h-52' : 'h-24'
              } rounded-lg p-3 flex flex-col justify-center items-center transition-transform active:scale-95 ${
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

        {latestUndoableItem && isCollectionActive && (
          <button
            onClick={handleUndoLastEvent}
            disabled={isVoidingLast}
            className="w-full py-2.5 px-4 rounded bg-slate-800 border border-slate-700 text-rose-400 text-xs font-semibold flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {isVoidingLast ? 'Desfazendo...' : 'Desfazer último registro confirmado'}
            </span>
          </button>
        )}
      </main>

      {/* Mini Log Compartilhado ("Registrando..." -> Permanente) no Celular */}
      <EventLogQuickView
        items={logItems}
        onVoidItem={(item, reason) => voidEvent(item, `${reason} (${aferidorLabel})`)}
        onRetryItem={retryOp}
        onDismissItem={dismissOp}
        isCollectionActive={isCollectionActive}
        variant="dark"
      />
    </div>
  );
};
