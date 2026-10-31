import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Attendant } from '../../api/collections.js';

interface InterruptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendants: Attendant[];
  onSubmit: (data: { attendantId?: string; interruptionType: string; notes?: string }) => Promise<void>;
}

export const InterruptionModal: React.FC<InterruptionModalProps> = ({
  isOpen,
  onClose,
  attendants,
  onSubmit,
}) => {
  const [interruptionType, setInterruptionType] = useState('FOOD_REPLENISHMENT');
  const [attendantId, setAttendantId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        interruptionType,
        attendantId: attendantId || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
      setNotes('');
      setAttendantId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Ocorrência / Interrupção">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Tipo de Ocorrência *</label>
          <select
            value={interruptionType}
            onChange={(e) => setInterruptionType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
          >
            <option value="FOOD_REPLENISHMENT">Reposição de Alimentos / Cubas Térmicas</option>
            <option value="PROTEIN_SHORTAGE">Falta Temporária de Proteína</option>
            <option value="SERVICE_HALT">Interrupção Geral do Serviço</option>
            <option value="OPERATIONAL_ISSUE">Problema Operacional / Equipamento</option>
            <option value="ATTENDANT_ABSENCE">Ausência do Atendente</option>
            <option value="OTHER">Outras Ocorrências</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Atendente Associado (Opcional - deixe em branco para geral)
          </label>
          <select
            value={attendantId}
            onChange={(e) => setAttendantId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
          >
            <option value="">Geral (Todos os atendentes)</option>
            {attendants.map((att) => (
              <option key={att.id} value={att.id}>
                [{att.code}] {att.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Observações Operacionais</label>
          <textarea
            rows={3}
            placeholder="Detalhe o ocorrido (ex.: troca de travessa de frango grelhado)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
            Salvar Ocorrência
          </Button>
        </div>
      </form>
    </Modal>
  );
};
