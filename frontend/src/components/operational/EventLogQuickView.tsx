import React, { useState } from 'react';
import { EventItem } from '../../api/events.js';
import { DerivedLogItem } from '../../operational/ledger.js';
import { formatTime } from '../../utils/formatters.js';
import { Undo2, Loader2, AlertCircle, RotateCw, X } from 'lucide-react';

interface EventLogQuickViewProps {
  items: DerivedLogItem[];
  onVoidItem?: (item: DerivedLogItem, reason: string) => Promise<void> | void;
  onRetryItem?: (key: string) => void;
  onDismissItem?: (key: string) => void;
  isCollectionActive: boolean;
  variant?: 'light' | 'dark';
}

export function formatExactTime(isoOrDate: string | Date | undefined): string {
  if (!isoOrDate) return '—';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

  return {
    startTimeStr: formatExactTime(startTime),
    endTimeStr: formatExactTime(endTime),
    durationSeconds,
  };
}

export const EventLogQuickView: React.FC<EventLogQuickViewProps> = ({
  items,
  onVoidItem,
  onRetryItem,
  onDismissItem,
  isCollectionActive,
  variant = 'light',
}) => {
  const [voidingKey, setVoidingKey] = useState<string | null>(null);
  const isDark = variant === 'dark';

  const handleQuickVoid = async (item: DerivedLogItem) => {
    if (!onVoidItem || voidingKey === item.key) return;
    setVoidingKey(item.key);
    try {
      await onVoidItem(item, 'Desfeito pelo aferidor');
    } finally {
      setVoidingKey(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <div
      className={
        isDark
          ? 'mx-4 mt-4 pt-3 border-t border-slate-800 text-xs space-y-2'
          : 'bg-white rounded-lg border border-slate-200 p-4'
      }
    >
      <div
        className={
          isDark
            ? 'font-semibold text-[11px] text-slate-400 uppercase tracking-wide'
            : 'text-xs font-semibold text-slate-500 uppercase mb-2.5'
        }
      >
        Últimos Registros
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
        {items.map((item) => {
          const isPending =
            item.syncStatus === 'queued' ||
            item.syncStatus === 'sending' ||
            item.syncStatus === 'retrying';
          const isError =
            item.syncStatus === 'failed' || item.syncStatus === 'rejected';

          // 1. Linha de erro / rejeição com ações de recuperação ou descarte
          if (isError) {
            return (
              <div
                key={item.key}
                className={
                  isDark
                    ? 'border border-rose-800 bg-rose-950/60 rounded-lg p-2.5 text-xs text-rose-200 flex items-center justify-between gap-2'
                    : 'border border-rose-300 bg-rose-50 rounded-lg p-2.5 text-xs text-rose-800 flex items-center justify-between gap-2'
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold">
                      {item.kind === 'ARRIVAL'
                        ? 'Chegada não registrada: '
                        : `Atendimento (${item.attendant?.displayName || 'Atendente'}): `}
                    </span>
                    <span>{item.error || 'Falha ao gravar no servidor.'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.syncStatus === 'failed' && onRetryItem && (
                    <button
                      type="button"
                      onClick={() => onRetryItem(item.key)}
                      className={
                        isDark
                          ? 'px-2 py-1 rounded bg-rose-900 hover:bg-rose-800 text-white font-semibold flex items-center gap-1 text-[11px]'
                          : 'px-2 py-1 rounded bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 font-semibold flex items-center gap-1 text-[11px]'
                      }
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Tentar de novo</span>
                    </button>
                  )}
                  {onDismissItem && (
                    <button
                      type="button"
                      onClick={() => onDismissItem(item.key)}
                      className="p-1 rounded hover:bg-rose-200/40 text-rose-500"
                      title="Descartar aviso"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          }

          // 2. Linha transitória de "Iniciando atendimento..."
          if (item.kind === 'SERVICE_START') {
            return (
              <div
                key={item.key}
                className={
                  isDark
                    ? 'border border-amber-800/80 bg-amber-950/30 rounded-lg p-2.5 text-xs flex items-center justify-between'
                    : 'border border-amber-200 bg-amber-50/60 rounded-lg p-2.5 text-xs flex items-center justify-between'
                }
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                  <span
                    className={
                      isDark
                        ? 'font-semibold text-amber-300'
                        : 'font-semibold text-amber-800'
                    }
                  >
                    Iniciando atendimento...
                  </span>
                  {item.attendant && (
                    <span className={isDark ? 'text-slate-300 font-bold' : 'text-slate-800 font-bold'}>
                      [{item.attendant.code}] {item.attendant.displayName}
                    </span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {formatExactTime(item.occurredAt)}
                </span>
              </div>
            );
          }

          // 3. Card de Entrega / Atendimento Concluído (Pendente "Registrando atendimento..." -> Permanente "Atendimento")
          if (item.kind === 'DELIVERY') {
            const startTimeStr = formatExactTime(item.startedAt || item.occurredAt);
            const endTimeStr = formatExactTime(item.occurredAt);
            const durationSec = item.durationSeconds ?? 0;

            return (
              <div
                key={item.key}
                className={`border rounded-lg p-2.5 text-xs transition-colors ${
                  isDark
                    ? item.isVoided
                      ? 'bg-slate-800/60 border-rose-900/60 opacity-60'
                      : isPending
                      ? 'bg-slate-800/90 border-amber-700/70'
                      : 'bg-slate-800/90 border-slate-700'
                    : item.isVoided
                    ? 'bg-rose-50/40 border-rose-200 text-slate-500'
                    : isPending
                    ? 'bg-amber-50/30 border-amber-200 text-slate-800'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div
                  className={`flex items-center justify-between pb-1.5 border-b mb-2 ${
                    isDark ? 'border-slate-700' : 'border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isPending ? (
                      <span
                        className={
                          isDark
                            ? 'px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-950 text-amber-300 border border-amber-800 uppercase tracking-wide flex items-center gap-1'
                            : 'px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800 uppercase tracking-wide flex items-center gap-1'
                        }
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>
                          {item.syncStatus === 'retrying'
                            ? 'Reenviando atendimento...'
                            : 'Registrando atendimento...'}
                        </span>
                      </span>
                    ) : (
                      <span
                        className={
                          isDark
                            ? 'px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-wide'
                            : 'px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 uppercase tracking-wide'
                        }
                      >
                        Atendimento
                      </span>
                    )}

                    <span className={isDark ? 'font-bold text-white' : 'font-bold text-slate-900'}>
                      [{item.attendant?.code || 'A'}] {item.attendant?.displayName || 'Atendente'}
                    </span>

                    {item.isVoided && (
                      <span className="text-rose-500 font-semibold text-[11px]">
                        {item.isVoidPending ? '(Anulando...)' : '(Anulado)'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={
                        isDark
                          ? 'font-mono text-xs font-bold text-blue-400'
                          : 'font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded'
                      }
                    >
                      Tempo: {durationSec}s
                    </span>

                    {!isPending && !item.isVoided && isCollectionActive && item.eventId && onVoidItem && (
                      <button
                        type="button"
                        onClick={() => handleQuickVoid(item)}
                        disabled={voidingKey === item.key}
                        className={
                          isDark
                            ? 'text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-700 transition-colors'
                            : 'text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors'
                        }
                        title="Desfazer"
                      >
                        {voidingKey === item.key ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Undo2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div
                    className={
                      isDark
                        ? 'bg-slate-900/90 p-1.5 rounded border border-slate-700/80'
                        : 'bg-slate-50 p-1.5 rounded border border-slate-100'
                    }
                  >
                    <span className="text-slate-400 block font-semibold text-[9px] uppercase tracking-wider">
                      Início
                    </span>
                    <span
                      className={
                        isDark ? 'font-mono font-bold text-slate-200' : 'font-mono font-bold text-slate-800'
                      }
                    >
                      {startTimeStr}
                    </span>
                  </div>
                  <div
                    className={
                      isDark
                        ? 'bg-slate-900/90 p-1.5 rounded border border-slate-700/80'
                        : 'bg-slate-50 p-1.5 rounded border border-slate-100'
                    }
                  >
                    <span className="text-slate-400 block font-semibold text-[9px] uppercase tracking-wider">
                      Fim
                    </span>
                    <span
                      className={
                        isDark ? 'font-mono font-bold text-slate-200' : 'font-mono font-bold text-slate-800'
                      }
                    >
                      {endTimeStr}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // 4. Card de Chegada (Pendente "Registrando chegada..." -> Permanente "Chegada de Aluno")
          return (
            <div
              key={item.key}
              className={`border rounded-lg p-2.5 text-xs transition-colors ${
                isDark
                  ? item.isVoided
                    ? 'bg-slate-800/60 border-rose-900/60 opacity-60'
                    : isPending
                    ? 'bg-slate-800/90 border-blue-700/70'
                    : 'bg-slate-800/90 border-slate-700'
                  : item.isVoided
                  ? 'bg-rose-50/40 border-rose-200 text-slate-500'
                  : isPending
                  ? 'bg-blue-50/30 border-blue-200 text-slate-800'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {isPending ? (
                    <span
                      className={
                        isDark
                          ? 'px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-950 text-blue-300 border border-blue-800 uppercase tracking-wide flex items-center gap-1'
                          : 'px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800 uppercase tracking-wide flex items-center gap-1'
                      }
                    >
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>
                        {item.syncStatus === 'retrying'
                          ? 'Reenviando chegada...'
                          : 'Registrando chegada...'}
                      </span>
                    </span>
                  ) : (
                    <span
                      className={
                        isDark
                          ? 'px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-950 text-blue-400 border border-blue-800 uppercase tracking-wide'
                          : 'px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800 uppercase tracking-wide'
                      }
                    >
                      Chegada de Aluno
                    </span>
                  )}

                  <span
                    className={
                      isDark
                        ? 'font-mono text-slate-300 font-semibold'
                        : 'font-mono text-slate-700 font-semibold'
                    }
                  >
                    {formatTime(item.occurredAt)}
                  </span>

                  {item.queue && (
                    <span className="text-slate-400">({item.queue.name})</span>
                  )}

                  {item.isVoided && (
                    <span className="text-rose-500 font-semibold text-[11px]">
                      {item.isVoidPending ? '(Anulando...)' : '(Anulado)'}
                    </span>
                  )}
                </div>

                {!isPending && !item.isVoided && isCollectionActive && item.eventId && onVoidItem && (
                  <button
                    type="button"
                    onClick={() => handleQuickVoid(item)}
                    disabled={voidingKey === item.key}
                    className={
                      isDark
                        ? 'text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-700 transition-colors'
                        : 'text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors'
                    }
                    title="Desfazer"
                  >
                    {voidingKey === item.key ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="w-3.5 h-3.5" />
                    )}
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
