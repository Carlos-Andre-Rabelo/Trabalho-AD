import React, { useState } from 'react';
import { EventItem } from '../../api/events.js';
import { formatTime } from '../../utils/formatters.js';
import { Undo2, AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';

interface EventLogQuickViewProps {
  events: EventItem[];
  onVoidEvent: (eventId: string, reason: string) => Promise<void>;
  isCollectionActive: boolean;
}

export const EventLogQuickView: React.FC<EventLogQuickViewProps> = ({
  events,
  onVoidEvent,
  isCollectionActive,
}) => {
  const [selectedEventToVoid, setSelectedEventToVoid] = useState<EventItem | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const handleConfirmVoid = async () => {
    if (!selectedEventToVoid || !voidReason.trim()) return;
    setIsVoiding(true);
    try {
      await onVoidEvent(selectedEventToVoid.id, voidReason.trim());
      setSelectedEventToVoid(null);
      setVoidReason('');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Últimos Registros em Tempo Real
        </h4>
        <span className="text-[11px] text-slate-400">Auditoria Automática</span>
      </div>

      {events.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">
          Nenhum evento registrado até o momento nesta sessão.
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {events.map((event) => (
            <div
              key={event.id}
              className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                event.isVoided
                  ? 'bg-rose-50/50 text-rose-500 line-through'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400">{formatTime(event.occurredAt)}</span>
                <span
                  className={`px-1.5 py-0.5 rounded font-semibold ${
                    event.eventType === 'ARRIVAL'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {event.eventType === 'ARRIVAL' ? 'Chegada' : 'Entrega'}
                </span>
                {event.attendant && (
                  <span className="font-medium text-slate-900">
                    [{event.attendant.code}] {event.attendant.displayName}
                  </span>
                )}
                {event.isVoided && (
                  <span className="text-rose-600 font-medium not-italic">
                    (Anulado: {event.voidReason || 'Sem motivo'})
                  </span>
                )}
              </div>

              {!event.isVoided && isCollectionActive && (
                <button
                  type="button"
                  onClick={() => setSelectedEventToVoid(event)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                  title="Anular / Corrigir este registro"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de Anulação / Desfazer */}
      <Modal
        isOpen={!!selectedEventToVoid}
        onClose={() => setSelectedEventToVoid(null)}
        title="Anular Evento Registrado"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Rastreabilidade e Integridade:</span> O evento não será apagado
              do banco SQL, mas marcado como anulado e excluído dos cálculos de métricas com registro no log de
              auditoria.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Motivo da Anulação / Correção *
            </label>
            <input
              type="text"
              placeholder="Ex.: Clique duplicado acidental, atendente não concluiu entrega..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEventToVoid(null)}
              disabled={isVoiding}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmVoid}
              disabled={!voidReason.trim() || isVoiding}
              isLoading={isVoiding}
            >
              Confirmar Anulação
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
