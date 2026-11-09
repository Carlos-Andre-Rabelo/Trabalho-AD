import React, { useState } from 'react';
import { Attendant, Queue, QueueMode } from '../../api/collections.js';
import { Button } from '../common/Button.js';
import { UserPlus } from 'lucide-react';
import { playArrivalClick, triggerHaptic } from '../../utils/sound.js';

interface ArrivalButtonProps {
  totalArrivals: number;
  arrivalsByQueue?: Record<string, number>;
  arrivalsByAttendant?: Record<string, number>;
  onRegisterArrival: (queueId?: string, attendantId?: string) => Promise<void> | void;
  isCollectionActive: boolean;
  queueMode?: QueueMode;
  attendants?: Attendant[];
  queues?: Queue[];
  focusedAttendantId?: string | null;
}

export const ArrivalButton: React.FC<ArrivalButtonProps> = ({
  totalArrivals,
  arrivalsByQueue = {},
  arrivalsByAttendant = {},
  onRegisterArrival,
  isCollectionActive,
  queueMode = 'SINGLE_QUEUE',
  attendants = [],
  queues = [],
  focusedAttendantId = null,
}) => {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const triggerClick = (key: string, queueId?: string, attendantId?: string) => {
    if (!isCollectionActive) return;
    triggerHaptic(35);
    playArrivalClick();
    setPressedKey(key);
    setTimeout(() => {
      setPressedKey((prev) => (prev === key ? null : prev));
    }, 100);

    onRegisterArrival(queueId, attendantId);
  };

  // MODO 1: FILAS SEPARADAS POR ATENDENTE (Cria automaticamente "Chegada à Fila A", "Chegada à Fila B", etc.)
  if (queueMode === 'SEPARATE_QUEUES' && attendants.length > 0) {
    const visibleAttendants = focusedAttendantId
      ? attendants.filter((a) => a.id === focusedAttendantId)
      : attendants;

    return (
      <div className="space-y-2">
        {!focusedAttendantId && visibleAttendants.length > 1 && (
          <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px] uppercase tracking-wider">
                Filas Separadas
              </span>
              <span className="text-slate-600 font-medium">
                Registre a chegada individualmente na fila de cada atendente
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Total Chegadas:</span>
              <span className="font-mono font-bold text-sm text-blue-700">{totalArrivals}</span>
            </div>
          </div>
        )}

        <div
          className={
            visibleAttendants.length > 1
              ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
              : 'max-w-2xl mx-auto w-full'
          }
        >
          {visibleAttendants.map((att, idx) => {
            const dedicatedQueue =
              queues.find(
                (q) => q.attendants?.length === 1 && q.attendants[0].attendantId === att.id
              ) ||
              queues.find((q) =>
                q.name.toLowerCase().includes(att.displayName.toLowerCase())
              ) ||
              queues[idx];

            const qId = dedicatedQueue?.id;
            const count =
              arrivalsByAttendant[att.id] ?? (qId ? arrivalsByQueue[qId] ?? 0 : 0);
            const btnKey = `att-${att.id}`;
            const isPressed = pressedKey === btnKey;

            return (
              <div
                key={att.id}
                className="bg-white rounded-lg border border-blue-200 p-3.5 flex flex-col justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                      {att.code}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 text-sm leading-tight">
                        Fila {att.code} ({att.displayName})
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Chegadas exclusivas desta fila
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-bold font-mono text-blue-700">{count}</span>
                    <span className="block text-[10px] text-slate-400 uppercase">Chegadas</span>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="touch"
                  onClick={() => triggerClick(btnKey, qId, att.id)}
                  disabled={!isCollectionActive}
                  className={`w-full font-bold text-sm gap-2 select-none transform transition-all duration-75 active:scale-95 ${
                    isPressed ? 'ring-4 ring-blue-300 scale-95 shadow-inner' : 'shadow-sm'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+1 Chegada à Fila {att.code}</span>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // MODO 2: PERSONALIZADO COM MÚLTIPLAS FILAS
  if (queueMode === 'CUSTOM' && queues.length > 1) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {queues.map((q) => {
            const count = arrivalsByQueue[q.id] ?? 0;
            const btnKey = `q-${q.id}`;
            const isPressed = pressedKey === btnKey;

            return (
              <div
                key={q.id}
                className="bg-white rounded-lg border border-blue-200 p-3.5 flex flex-col justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{q.name}</span>
                  <div className="text-right">
                    <span className="text-xl font-bold font-mono text-blue-700">{count}</span>
                    <span className="block text-[10px] text-slate-400 uppercase">Chegadas</span>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="touch"
                  onClick={() => triggerClick(btnKey, q.id)}
                  disabled={!isCollectionActive}
                  className={`w-full font-bold text-sm gap-2 select-none transform transition-all duration-75 active:scale-95 ${
                    isPressed ? 'ring-4 ring-blue-300 scale-95 shadow-inner' : 'shadow-sm'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+1 Chegada ({q.name})</span>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // MODO 3: FILA ÚNICA COMPARTILHADA
  const singleQueueId = queues.length === 1 ? queues[0].id : undefined;
  const isPressed = pressedKey === 'single';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold font-mono text-slate-900 transition-all">
          {totalArrivals}
        </span>
        <div>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Chegadas (Fila Única)
          </span>
          <span className="text-[11px] text-slate-400">
            Fila compartilhada para todos os atendentes
          </span>
        </div>
      </div>

      <Button
        variant="primary"
        size="touch"
        onClick={() => triggerClick('single', singleQueueId)}
        disabled={!isCollectionActive}
        className={`flex-1 sm:flex-initial min-w-[200px] font-bold text-base gap-2 select-none transform transition-all duration-75 active:scale-95 ${
          isPressed ? 'ring-4 ring-blue-300 scale-95 shadow-inner' : 'shadow-md'
        }`}
      >
        <UserPlus className="w-5 h-5 transition-transform" />
        <span>+1 Chegada</span>
      </Button>
    </div>
  );
};
