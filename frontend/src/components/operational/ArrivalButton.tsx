import React, { useState } from 'react';
import { Button } from '../common/Button.js';
import { UserPlus } from 'lucide-react';
import { playArrivalClick, triggerHaptic } from '../../utils/sound.js';

interface ArrivalButtonProps {
  totalArrivals: number;
  onRegisterArrival: (queueId?: string) => Promise<void>;
  isCollectionActive: boolean;
  queues?: Array<{ id: string; name: string }>;
}

export const ArrivalButton: React.FC<ArrivalButtonProps> = ({
  totalArrivals,
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
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold font-mono text-slate-900">{totalArrivals}</span>
        <span className="text-xs font-medium text-slate-500 uppercase">Chegadas</span>
      </div>

      <div className="flex items-center gap-2">
        {queues.length > 1 && (
          <select
            value={selectedQueueId}
            onChange={(e) => setSelectedQueueId(e.target.value)}
            className="text-xs px-2.5 py-2 rounded border border-slate-300 bg-white text-slate-700"
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
          className="flex-1 sm:flex-initial min-w-[200px] font-bold text-base gap-2"
        >
          <UserPlus className="w-5 h-5" />
          <span>+1 Chegada</span>
        </Button>
      </div>
    </div>
  );
};
