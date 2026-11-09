import React, { useState } from 'react';
import { EventItem } from '../../api/events.js';
import { formatTime } from '../../utils/formatters.js';
import { Undo2 } from 'lucide-react';

interface EventLogQuickViewProps {
  events: EventItem[];
  onVoidEvent: (eventId: string, reason: string) => Promise<void>;
  isCollectionActive: boolean;
}

export function getServiceTimes(event: EventItem) {
  const endTime = new Date(event.occurredAt);
  let startTime = endTime;
  let durationSeconds = 0;

  if (event.metadata?.startedAt) {
    startTime = new Date(event.metadata.startedAt);
  } else if (event.metadata?.durationSeconds !== undefined) {
    durationSeconds = event.metadata.durationSeconds;
    startTime = new Date(endTime.getTime() - durationSeconds * 1000);
  } else if (event.metadata?.durationMs !== undefined) {
    durationSeconds = Math.round(event.metadata.durationMs / 1000);
    startTime = new Date(endTime.getTime() - event.metadata.durationMs);
  }

  if (event.metadata?.durationSeconds !== undefined) {
    durationSeconds = event.metadata.durationSeconds;
  } else if (event.metadata?.durationMs !== undefined) {
    durationSeconds = Math.round(event.metadata.durationMs / 1000);
  } else {
    durationSeconds = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));
  }

  const formatExactTime = (d: Date) => {
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return {
    startTimeStr: formatExactTime(startTime),
    endTimeStr: formatExactTime(endTime),
    durationSeconds,
  };
}

export const EventLogQuickView: React.FC<EventLogQuickViewProps> = ({
  events,
  onVoidEvent,
  isCollectionActive,
}) => {
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const handleQuickVoid = async (eventId: string) => {
    if (voidingId) return;
    setVoidingId(eventId);
    try {
      await onVoidEvent(eventId, 'Desfeito pelo aferidor');
    } finally {
      setVoidingId(null);
    }
  };

  if (events.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-xs font-semibold text-slate-500 uppercase mb-2.5">
        Últimos Registros
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
        {events.map((event) => {
          if (event.eventType === 'DELIVERY') {
            const times = getServiceTimes(event);

            return (
              <div
                key={event.id}
                className={`border rounded-lg p-2.5 text-xs transition-colors ${
                  event.isVoided
                    ? 'bg-rose-50/40 border-rose-200 text-slate-500'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                      Atendimento
                    </span>
                    <span className="font-bold text-slate-900">
                      [{event.attendant?.code || 'A'}] {event.attendant?.displayName || 'Atendente'}
                    </span>
                    {event.isVoided && (
                      <span className="text-rose-600 font-semibold text-[11px]">(Anulado)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      Tempo: {times.durationSeconds}s
                    </span>
                    {!event.isVoided && isCollectionActive && (
                      <button
                        type="button"
                        onClick={() => handleQuickVoid(event.id)}
                        disabled={voidingId === event.id}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                        title="Desfazer"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                    <span className="text-slate-400 block font-semibold text-[9px] uppercase tracking-wider">
                      Início
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {times.startTimeStr}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                    <span className="text-slate-400 block font-semibold text-[9px] uppercase tracking-wider">
                      Fim
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {times.endTimeStr}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={event.id}
              className={`border rounded-lg p-2.5 text-xs transition-colors ${
                event.isVoided
                  ? 'bg-rose-50/40 border-rose-200 text-slate-500'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800 uppercase tracking-wide">
                    Chegada de Aluno
                  </span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {formatTime(event.occurredAt)}
                  </span>
                  {event.queue && (
                    <span className="text-slate-400">({event.queue.name})</span>
                  )}
                  {event.isVoided && (
                    <span className="text-rose-600 font-semibold text-[11px]">(Anulado)</span>
                  )}
                </div>

                {!event.isVoided && isCollectionActive && (
                  <button
                    type="button"
                    onClick={() => handleQuickVoid(event.id)}
                    disabled={voidingId === event.id}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                    title="Desfazer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
