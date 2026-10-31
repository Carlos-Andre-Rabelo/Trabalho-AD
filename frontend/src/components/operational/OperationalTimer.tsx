import React, { useState, useEffect } from 'react';
import { formatSecondsToStopwatch } from '../../utils/formatters.js';
import { Collection, CollectionStatus } from '../../api/collections.js';
import { Play, Pause, Square, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';

interface OperationalTimerProps {
  collection: Collection;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onReopen: () => void;
  isActionLoading?: boolean;
}

export const OperationalTimer: React.FC<OperationalTimerProps> = ({
  collection,
  onPause,
  onResume,
  onFinish,
  onReopen,
  isActionLoading = false,
}) => {
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  useEffect(() => {
    if (!collection.startedAt) {
      setSecondsElapsed(0);
      return;
    }

    const calcSeconds = () => {
      const start = new Date(collection.startedAt!).getTime();
      const end = collection.endedAt ? new Date(collection.endedAt).getTime() : Date.now();
      const diffSec = Math.max(0, Math.floor((end - start) / 1000));

      // Descontar pausas acumuladas
      let pausesSec = 0;
      if (collection.pauses) {
        for (const p of collection.pauses) {
          const pStart = new Date(p.startedAt).getTime();
          const pEnd = p.endedAt ? new Date(p.endedAt).getTime() : Date.now();
          pausesSec += Math.max(0, Math.floor((pEnd - pStart) / 1000));
        }
      }

      setSecondsElapsed(Math.max(0, diffSec - pausesSec));
    };

    calcSeconds();

    if (collection.status === 'IN_PROGRESS') {
      const interval = setInterval(calcSeconds, 1000);
      return () => clearInterval(interval);
    }
  }, [collection.startedAt, collection.endedAt, collection.status, collection.pauses]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {collection.title}
            </h2>
            <Badge status={collection.status} />
          </div>
          <div className="text-xs text-slate-500">
            Modo: {collection.queueMode === 'SEPARATE_QUEUES' ? 'Filas Separadas' : collection.queueMode === 'SINGLE_QUEUE' ? 'Fila Única Compartilhada' : 'Personalizado'}
            {collection.location && ` • Local: ${collection.location}`}
          </div>
        </div>

        {/* Cronômetro e Controles */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="text-left sm:text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tempo Ativo</div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {formatSecondsToStopwatch(secondsElapsed)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {collection.status === 'IN_PROGRESS' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPause}
                  disabled={isActionLoading}
                  className="gap-1.5 text-amber-700 hover:bg-amber-50 border-amber-200"
                >
                  <Pause className="w-4 h-4" />
                  <span className="hidden sm:inline">Pausar</span>
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={onFinish}
                  disabled={isActionLoading}
                  className="gap-1.5"
                >
                  <Square className="w-4 h-4" />
                  <span>Encerrar</span>
                </Button>
              </>
            )}

            {collection.status === 'PAUSED' && (
              <>
                <Button
                  variant="success"
                  size="sm"
                  onClick={onResume}
                  disabled={isActionLoading}
                  className="gap-1.5"
                >
                  <Play className="w-4 h-4" />
                  <span>Retomar</span>
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={onFinish}
                  disabled={isActionLoading}
                  className="gap-1.5"
                >
                  <Square className="w-4 h-4" />
                  <span>Encerrar</span>
                </Button>
              </>
            )}

            {collection.status === 'FINISHED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReopen}
                disabled={isActionLoading}
                className="gap-1.5 text-blue-700 hover:bg-blue-50 border-blue-200"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reabrir</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
