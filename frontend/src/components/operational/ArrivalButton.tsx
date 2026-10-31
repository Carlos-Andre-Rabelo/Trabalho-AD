import React, { useState } from 'react';
import { Button } from '../common/Button.js';
import { UserPlus } from 'lucide-react';
import { playArrivalClick, triggerHaptic } from '../../utils/sound.js';

interface ArrivalButtonProps {
  totalArrivals: number;
  arrivalRatePerMinute: number | null;
  onRegisterArrival: (queueId?: string) => Promise<void>;
  isCollectionActive: boolean;
  queues?: Array<{ id: string; name: string }>;
}

export const ArrivalButton: React.FC<ArrivalButtonProps> = ({
  totalArrivals,
  arrivalRatePerMinute,
  onRegisterArrival,
  isCollectionActive,
  queues = [],
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');

  const handleClick = async () => {
    if (isSubmitting || !isCollectionActive) return;
    setIsSubmitting(true);
    triggerHaptic(30);
    playArrivalClick();
    try {
      await onRegisterArrival(selectedQueueId || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900">{totalArrivals}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Chegadas Registradas
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {arrivalRatePerMinute !== null
                ? `Taxa de chegada: ${arrivalRatePerMinute.toFixed(1)} estudantes/min`
                : 'Aguardando tempo operacional...'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {queues.length > 1 && (
            <select
              value={selectedQueueId}
              onChange={(e) => setSelectedQueueId(e.target.value)}
              className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">Fila Geral</option>
              {queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="primary"
            size="touch"
            onClick={handleClick}
            disabled={!isCollectionActive || isSubmitting}
            isLoading={isSubmitting}
            className="flex-1 sm:flex-initial min-w-[200px] font-bold text-base bg-blue-900 hover:bg-blue-950 shadow-md gap-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>Registrar Chegada (+1)</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
