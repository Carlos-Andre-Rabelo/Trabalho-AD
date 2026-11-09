import React, { useState } from 'react';
import { Button } from '../common/Button.js';
import { UserPlus } from 'lucide-react';
import { playArrivalClick, triggerHaptic } from '../../utils/sound.js';

interface ArrivalButtonProps {
  totalArrivals: number;
  onRegisterArrival: (queueId?: string) => Promise<void> | void;
  isCollectionActive: boolean;
  queues?: Array<{ id: string; name: string }>;
}

export const ArrivalButton: React.FC<ArrivalButtonProps> = ({
  totalArrivals,
  onRegisterArrival,
  isCollectionActive,
  queues = [],
}) => {
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    if (!isCollectionActive) return;
    triggerHaptic(35);
    playArrivalClick();
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 100);

    // Disparo imediato e não-bloqueante (0ms latency perceptível)
    onRegisterArrival(selectedQueueId || undefined);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold font-mono text-slate-900 transition-all">{totalArrivals}</span>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Chegadas</span>
      </div>

      <div className="flex items-center gap-2">
        {queues.length > 1 && (
          <select
            value={selectedQueueId}
            onChange={(e) => setSelectedQueueId(e.target.value)}
            className="text-xs px-2.5 py-2 rounded border border-slate-300 bg-white text-slate-700 font-medium"
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
          disabled={!isCollectionActive}
          className={`flex-1 sm:flex-initial min-w-[200px] font-bold text-base gap-2 select-none transform transition-all duration-75 active:scale-95 ${
            isPressed ? 'ring-4 ring-blue-300 scale-95 shadow-inner' : 'shadow-md'
          }`}
        >
          <UserPlus className="w-5 h-5 transition-transform" />
          <span>+1 Chegada</span>
        </Button>
      </div>
    </div>
  );
};
