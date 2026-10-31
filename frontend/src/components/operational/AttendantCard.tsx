import React, { useState, useEffect } from 'react';
import { Attendant } from '../../api/collections.js';
import { Button } from '../common/Button.js';
import { playSuccessBeep, triggerHaptic } from '../../utils/sound.js';
import { formatNumber, formatSecondsToStopwatch } from '../../utils/formatters.js';
import { CheckCircle2, Play, Square, Clock, Scale } from 'lucide-react';

interface AttendantCardProps {
  attendant: Attendant;
  deliveriesCount: number;
  throughputPerMinute: number | null;
  meanServiceSeconds: number | null;
  isTimedMode: boolean;
  activeService?: {
    id: string;
    startedAt: string;
  } | null;
  onQuickDelivery: (attendantId: string) => Promise<void>;
  onStartTimedService: (attendantId: string) => Promise<void>;
  onFinishTimedService: (attendantId: string, serviceId?: string, proteinAmount?: number) => Promise<void>;
  isCollectionActive: boolean;
}

export const AttendantCard: React.FC<AttendantCardProps> = ({
  attendant,
  deliveriesCount,
  throughputPerMinute,
  meanServiceSeconds,
  isTimedMode,
  activeService,
  onQuickDelivery,
  onStartTimedService,
  onFinishTimedService,
  isCollectionActive,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [elapsedServiceSeconds, setElapsedServiceSeconds] = useState(0);
  const [proteinInput, setProteinInput] = useState<string>('');
  const [showProteinField, setShowProteinField] = useState(false);

  // Cronômetro do atendimento em andamento
  useEffect(() => {
    if (!activeService) {
      setElapsedServiceSeconds(0);
      return;
    }

    const start = new Date(activeService.startedAt).getTime();
    const update = () => {
      const now = Date.now();
      setElapsedServiceSeconds(Math.max(0, Math.floor((now - start) / 1000)));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeService]);

  const handleQuickClick = async () => {
    if (isSubmitting || !isCollectionActive) return;
    setIsSubmitting(true);
    triggerHaptic(45);
    playSuccessBeep();
    try {
      await onQuickDelivery(attendant.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartTimed = async () => {
    if (isSubmitting || !isCollectionActive) return;
    setIsSubmitting(true);
    triggerHaptic(35);
    try {
      await onStartTimedService(attendant.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishTimed = async () => {
    if (isSubmitting || !isCollectionActive) return;
    setIsSubmitting(true);
    triggerHaptic(50);
    playSuccessBeep();
    try {
      const grams = proteinInput ? parseFloat(proteinInput) : undefined;
      await onFinishTimedService(attendant.id, activeService?.id, grams);
      setProteinInput('');
      setShowProteinField(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAttendantBusy = !!activeService;

  return (
    <div
      className={`rounded-2xl border transition-all p-4 sm:p-5 flex flex-col justify-between ${
        isAttendantBusy
          ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30'
          : 'bg-white border-slate-200/90 shadow-sm'
      }`}
    >
      <div>
        {/* Cabeçalho do Atendente */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {attendant.code}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                {attendant.displayName}
              </h3>
              <span className="text-xs text-slate-400">Canal de Atendimento</span>
            </div>
          </div>

          {isTimedMode && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                isAttendantBusy
                  ? 'bg-amber-100 text-amber-800 animate-pulse font-semibold'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isAttendantBusy ? 'Ocupado' : 'Livre'}
            </span>
          )}
        </div>

        {/* Indicadores Operacionais */}
        <div className="grid grid-cols-3 gap-2 my-4 text-center">
          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Entregas</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{deliveriesCount}</div>
          </div>

          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Throughput</div>
            <div className="text-base font-bold text-slate-800 mt-1">
              {throughputPerMinute !== null ? `${formatNumber(throughputPerMinute, 1)}/m` : '—'}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Tempo Médio</div>
            <div className="text-base font-bold text-slate-800 mt-1">
              {meanServiceSeconds !== null ? `${formatNumber(meanServiceSeconds, 0)}s` : '—'}
            </div>
          </div>
        </div>

        {/* Exibição do Cronômetro Ativo se em Modo Cronometrado */}
        {isTimedMode && isAttendantBusy && (
          <div className="my-3 p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-center">
            <div className="text-xs font-semibold text-amber-900 flex items-center justify-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" />
              <span>Atendimento em Curso</span>
            </div>
            <div className="font-mono text-2xl font-bold text-amber-950">
              {formatSecondsToStopwatch(elapsedServiceSeconds)}
            </div>

            {/* Módulo Opcional de Gramas de Proteína */}
            <div className="mt-2.5 text-left">
              {!showProteinField ? (
                <button
                  type="button"
                  onClick={() => setShowProteinField(true)}
                  className="text-xs text-amber-900 font-medium hover:underline flex items-center gap-1 mx-auto"
                >
                  <Scale className="w-3 h-3" />
                  <span>+ Anotar peso medido (g)</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    placeholder="Peso (ex: 125g)"
                    value={proteinInput}
                    onChange={(e) => setProteinInput(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProteinField(false)}
                    className="text-xs text-amber-700 hover:text-amber-900"
                  >
                    Ocultar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Botões Grandes de Operação (>= 52px) */}
      <div className="mt-4 pt-2">
        {!isTimedMode ? (
          <Button
            variant="success"
            size="touch"
            onClick={handleQuickClick}
            disabled={!isCollectionActive || isSubmitting}
            isLoading={isSubmitting}
            className="w-full shadow-md font-bold text-lg gap-2 active:bg-emerald-800"
          >
            <CheckCircle2 className="w-6 h-6" />
            <span>Registrar Entrega {attendant.code}</span>
          </Button>
        ) : !isAttendantBusy ? (
          <Button
            variant="primary"
            size="touch"
            onClick={handleStartTimed}
            disabled={!isCollectionActive || isSubmitting}
            isLoading={isSubmitting}
            className="w-full shadow-md font-bold text-base gap-2 bg-blue-800 hover:bg-blue-900"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Iniciar Atendimento {attendant.code}</span>
          </Button>
        ) : (
          <Button
            variant="success"
            size="touch"
            onClick={handleFinishTimed}
            disabled={!isCollectionActive || isSubmitting}
            isLoading={isSubmitting}
            className="w-full shadow-md font-bold text-base gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Square className="w-5 h-5 fill-current" />
            <span>Concluir Atendimento ({formatSecondsToStopwatch(elapsedServiceSeconds)})</span>
          </Button>
        )}
      </div>
    </div>
  );
};
