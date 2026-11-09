import React, { useState, useEffect } from 'react';
import { Attendant } from '../../api/collections.js';
import { Button } from '../common/Button.js';
import { playSuccessBeep, playArrivalClick, triggerHaptic } from '../../utils/sound.js';
import { formatSecondsToStopwatch } from '../../utils/formatters.js';
import { serverNow } from '../../operational/clock.js';
import { CheckCircle2, Play } from 'lucide-react';

interface AttendantCardProps {
  attendant: Attendant;
  deliveriesCount: number;
  activeService?: {
    id: string;
    startedAt: string;
  } | null;
  onStartService: (attendantId: string) => void | Promise<void>;
  onFinishService: (attendantId: string, serviceId?: string) => void | Promise<void>;
  isCollectionActive: boolean;
}

export const AttendantCard: React.FC<AttendantCardProps> = ({
  attendant,
  deliveriesCount,
  activeService,
  onStartService,
  onFinishService,
  isCollectionActive,
}) => {
  const [elapsedServiceSeconds, setElapsedServiceSeconds] = useState(0);

  const isAttendantBusy = !!activeService;

  useEffect(() => {
    if (!activeService) {
      setElapsedServiceSeconds(0);
      return;
    }

    const start = new Date(activeService.startedAt).getTime();
    const update = () => {
      setElapsedServiceSeconds(Math.max(0, Math.floor((serverNow() - start) / 1000)));
    };

    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [activeService]);

  const handleStart = () => {
    if (!isCollectionActive) return;
    triggerHaptic(35);
    playArrivalClick();
    onStartService(attendant.id);
  };

  const handleFinish = () => {
    if (!isCollectionActive) return;
    triggerHaptic(50);
    playSuccessBeep();
    onFinishService(attendant.id, activeService?.id);
  };

  return (
    <div
      className={`rounded-lg border p-4 flex flex-col justify-between gap-4 transition-colors ${
        isAttendantBusy ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
            {attendant.code}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{attendant.displayName}</h3>
            {isAttendantBusy && (
              <span className="text-[11px] font-medium text-amber-700">
                Atendimento em andamento ({formatSecondsToStopwatch(elapsedServiceSeconds)})
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="text-2xl font-bold font-mono text-slate-900">{deliveriesCount}</span>
          <span className="text-xs text-slate-500 ml-1.5">atendimentos</span>
        </div>
      </div>

      <div>
        {!isAttendantBusy ? (
          <Button
            variant="primary"
            size="touch"
            onClick={handleStart}
            disabled={!isCollectionActive}
            className="w-full font-bold text-base gap-2 select-none transform transition-transform active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Iniciar Atendimento ({attendant.code})</span>
          </Button>
        ) : (
          <Button
            variant="success"
            size="touch"
            onClick={handleFinish}
            disabled={!isCollectionActive}
            className="w-full font-bold text-base gap-2 bg-emerald-600 hover:bg-emerald-700 select-none transform transition-transform active:scale-95"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Finalizou Atendimento ({formatSecondsToStopwatch(elapsedServiceSeconds)})</span>
          </Button>
        )}
      </div>
    </div>
  );
};
