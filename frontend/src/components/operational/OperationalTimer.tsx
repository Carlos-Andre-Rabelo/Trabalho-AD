import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatSecondsToStopwatch } from '../../utils/formatters.js';
import { Collection, collectionsApi } from '../../api/collections.js';
import { Play, Pause, Square, RotateCcw, Timer, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { playTimerEndAlert, playTimerWarningBeep, triggerHaptic } from '../../utils/sound.js';
import { Modal } from '../common/Modal.js';

interface OperationalTimerProps {
  collection: Collection;
  onStart?: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onReopen: () => void;
  onCollectionUpdated?: (updated: Collection) => void;
  isActionLoading?: boolean;
}

export const OperationalTimer: React.FC<OperationalTimerProps> = ({
  collection,
  onStart,
  onPause,
  onResume,
  onFinish,
  onReopen,
  onCollectionUpdated,
  isActionLoading = false,
}) => {
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const [targetMinutesInput, setTargetMinutesInput] = useState<string>(
    collection.targetDurationMinutes ? String(collection.targetDurationMinutes) : ''
  );
  const [isSavingDuration, setIsSavingDuration] = useState(false);
  const [autoFinishedNotice, setAutoFinishedNotice] = useState(false);

  const hasAutoFinishedRef = useRef(false);
  const warnedAt60Ref = useRef(false);

  // Fallback inteligente para garantir extração de targetDurationMinutes mesmo de notes
  const targetDurationMinutes = useMemo(() => {
    if (typeof collection.targetDurationMinutes === 'number' && collection.targetDurationMinutes > 0) {
      return collection.targetDurationMinutes;
    }
    if (collection.notes) {
      try {
        const parsed = JSON.parse(collection.notes);
        if (parsed && typeof parsed.targetDurationMinutes === 'number' && parsed.targetDurationMinutes > 0) {
          return parsed.targetDurationMinutes;
        }
      } catch {}
      const match = collection.notes.match(/\[DURATION:(\d+)\]/);
      if (match) return parseInt(match[1], 10);
    }
    return null;
  }, [collection.targetDurationMinutes, collection.notes]);

  // Sincroniza input de duração quando a coleta mudar
  useEffect(() => {
    setTargetMinutesInput(targetDurationMinutes ? String(targetDurationMinutes) : '');
  }, [targetDurationMinutes]);

  // Reseta travas de encerramento quando a coleta está em DRAFT
  useEffect(() => {
    if (collection.status === 'DRAFT') {
      hasAutoFinishedRef.current = false;
      warnedAt60Ref.current = false;
    }
  }, [collection.status]);

  const targetSeconds = targetDurationMinutes ? targetDurationMinutes * 60 : null;

  useEffect(() => {
    if (!collection.startedAt) {
      setSecondsElapsed(0);
      return;
    }

    const calcSeconds = () => {
      const start = new Date(collection.startedAt!).getTime();
      const end = collection.endedAt ? new Date(collection.endedAt).getTime() : Date.now();
      const diffSec = Math.max(0, Math.floor((end - start) / 1000));

      let pausesSec = 0;
      if (collection.pauses) {
        for (const p of collection.pauses) {
          const pStart = new Date(p.startedAt).getTime();
          const pEnd = p.endedAt ? new Date(p.endedAt).getTime() : Date.now();
          pausesSec += Math.max(0, Math.floor((pEnd - pStart) / 1000));
        }
      }

      const activeSeconds = Math.max(0, diffSec - pausesSec);
      setSecondsElapsed(activeSeconds);

      // Verificação de disparo do cronômetro regressivo
      if (targetSeconds && collection.status === 'IN_PROGRESS') {
        const remaining = targetSeconds - activeSeconds;

        // Aviso sonoro no último minuto
        if (remaining <= 60 && remaining > 50 && !warnedAt60Ref.current) {
          warnedAt60Ref.current = true;
          playTimerWarningBeep();
        }

        // Término automático ao chegar a zero ou ultrapassar
        if (remaining <= 0 && !hasAutoFinishedRef.current) {
          hasAutoFinishedRef.current = true;
          playTimerEndAlert();
          triggerHaptic(500);
          setAutoFinishedNotice(true);
          onFinish();
        }
      }
    };

    calcSeconds();

    if (collection.status === 'IN_PROGRESS') {
      const interval = setInterval(calcSeconds, 1000);
      return () => clearInterval(interval);
    }
  }, [collection.startedAt, collection.endedAt, collection.status, collection.pauses, targetSeconds, onFinish]);

  // Cálculos de tempo restante
  const remainingSeconds = targetSeconds !== null ? Math.max(0, targetSeconds - secondsElapsed) : null;
  const isLastMinute = remainingSeconds !== null && remainingSeconds <= 60 && remainingSeconds > 0;
  const isLastFiveMinutes = remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 60;

  const handleSaveDuration = async () => {
    setIsSavingDuration(true);
    try {
      const parsed = targetMinutesInput ? parseInt(targetMinutesInput, 10) : null;
      const validMinutes = parsed && parsed > 0 ? parsed : null;
      const updated = await collectionsApi.update(collection.id, {
        targetDurationMinutes: validMinutes,
      });
      setIsDurationModalOpen(false);
      onCollectionUpdated?.(updated);
    } catch (e: any) {
      alert(e?.message || 'Falha ao atualizar tempo de aferição.');
    } finally {
      setIsSavingDuration(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
      {/* Alerta de Auto-Encerramento */}
      {autoFinishedNotice && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between gap-2 text-amber-900 text-xs">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Tempo limite esgotado! Aferição finalizada automaticamente aos {targetDurationMinutes} minutos.</span>
          </div>
          <button
            onClick={() => setAutoFinishedNotice(false)}
            className="text-amber-700 hover:text-amber-900 font-semibold px-2"
          >
            Dispensar
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Metadados da Coleta */}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 truncate">{collection.title}</h2>
            <Badge status={collection.status} />
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{collection.owner?.name || 'Aferidor'}</span>
            {collection.location && <span>• {collection.location}</span>}
            {targetDurationMinutes && (
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[11px] font-semibold flex items-center gap-1">
                <Timer className="w-3 h-3" />
                Limite: {targetDurationMinutes} min
              </span>
            )}
          </div>
        </div>

        {/* Cronômetro e Controles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-3">
          {/* Seletor de Tempo e Relógio */}
          <div className="flex items-center gap-3">
            {targetSeconds !== null ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-600">Tempo Restante:</span>
                  <div
                    className={`font-mono text-2xl font-black ${
                      isLastMinute
                        ? 'text-rose-600 animate-pulse'
                        : isLastFiveMinutes
                        ? 'text-amber-600'
                        : remainingSeconds === 0
                        ? 'text-slate-400'
                        : 'text-slate-900'
                    }`}
                  >
                    {formatSecondsToStopwatch(remainingSeconds ?? 0)}
                  </div>
                </div>
                <div className="text-[10px] text-slate-600 font-mono">
                  Decorrido: {formatSecondsToStopwatch(secondsElapsed)} / Meta: {targetDurationMinutes}m
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-slate-600">Tempo Decorrido:</span>
                <div className="font-mono text-2xl font-bold text-slate-900">
                  {formatSecondsToStopwatch(secondsElapsed)}
                </div>
              </div>
            )}

            {/* Botão de Definir/Ajustar Duração */}
            <button
              type="button"
              onClick={() => setIsDurationModalOpen(true)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 transition-colors text-xs flex items-center gap-1"
              title="Definir tempo da aferição"
            >
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-[11px] hidden md:inline">
                {targetDurationMinutes ? 'Ajustar Tempo' : 'Definir Tempo'}
              </span>
            </button>
          </div>

          {/* Botões de Ação do Ciclo de Vida */}
          <div className="flex items-center gap-1.5">
            {collection.status === 'DRAFT' && onStart && (
              <Button variant="success" size="sm" onClick={onStart} disabled={isActionLoading} className="gap-1">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Iniciar</span>
              </Button>
            )}

            {collection.status === 'IN_PROGRESS' && (
              <>
                <Button variant="outline" size="sm" onClick={onPause} disabled={isActionLoading} className="gap-1">
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pausar</span>
                </Button>
                <Button variant="danger" size="sm" onClick={onFinish} disabled={isActionLoading} className="gap-1">
                  <Square className="w-3.5 h-3.5" />
                  <span>Encerrar</span>
                </Button>
              </>
            )}

            {collection.status === 'PAUSED' && (
              <>
                <Button variant="success" size="sm" onClick={onResume} disabled={isActionLoading} className="gap-1">
                  <Play className="w-3.5 h-3.5" />
                  <span>Retomar</span>
                </Button>
                <Button variant="danger" size="sm" onClick={onFinish} disabled={isActionLoading} className="gap-1">
                  <Square className="w-3.5 h-3.5" />
                  <span>Encerrar</span>
                </Button>
              </>
            )}

            {collection.status === 'FINISHED' && (
              <Button variant="outline" size="sm" onClick={onReopen} disabled={isActionLoading} className="gap-1">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reabrir</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal para Definir/Alterar o Tempo da Aferição */}
      <Modal
        isOpen={isDurationModalOpen}
        onClose={() => setIsDurationModalOpen(false)}
        title="Tempo da Aferição (Cronômetro Automático)"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <p className="text-slate-600 leading-relaxed">
            Configure uma duração máxima para a aferição. O cronômetro regressivo encerrará a coleta automaticamente ao chegar em <strong>00:00</strong>.
          </p>

          <div className="space-y-2">
            <label className="block font-semibold text-slate-800">Duração Programada (em minutos)</label>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[10, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setTargetMinutesInput(String(mins))}
                  className={`py-1.5 px-2 rounded text-xs font-semibold border transition-colors ${
                    targetMinutesInput === String(mins)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="480"
                placeholder="Ex.: 45 (ou deixe vazio para sem limite)"
                value={targetMinutesInput}
                onChange={(e) => setTargetMinutesInput(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 font-mono text-xs focus:outline-none focus:border-blue-600"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTargetMinutesInput('')}
                className="shrink-0 text-slate-500"
              >
                Sem Limite
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDurationModalOpen(false)}
              disabled={isSavingDuration}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveDuration}
              isLoading={isSavingDuration}
            >
              Salvar Tempo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
