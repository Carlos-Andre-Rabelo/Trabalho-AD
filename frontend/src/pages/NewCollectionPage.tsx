import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collectionsApi, QueueMode } from '../api/collections.js';
import { useAuth } from '../context/AuthContext.js';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { QrCodeSyncModal } from '../components/operational/QrCodeSyncModal.js';
import { ArrowLeft, Plus, Trash2, QrCode, Clock } from 'lucide-react';

export const NewCollectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { userName, setUserName } = useAuth();

  const [aferidorName, setAferidorName] = useState(userName || '');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('RU Central');
  const [queueMode, setQueueMode] = useState<QueueMode>('SEPARATE_QUEUES');
  const [durationMode, setDurationMode] = useState<string>('30');
  const [customMinutes, setCustomMinutes] = useState<string>('25');
  const [generateQrCode, setGenerateQrCode] = useState(true);
  const [createdCollection, setCreatedCollection] = useState<{ id: string; title: string; remoteToken?: string } | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const [attendants, setAttendants] = useState([
    { code: 'A', displayName: 'Atendente A' },
    { code: 'B', displayName: 'Atendente B' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddAttendant = () => {
    const nextCode = String.fromCharCode(65 + attendants.length);
    setAttendants([...attendants, { code: nextCode, displayName: `Atendente ${nextCode}` }]);
  };

  const handleRemoveAttendant = (index: number) => {
    if (attendants.length <= 1) return;
    setAttendants(attendants.filter((_, i) => i !== index));
  };

  const handleAttendantChange = (index: number, field: 'code' | 'displayName', value: string) => {
    const updated = [...attendants];
    updated[index][field] = value;
    setAttendants(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aferidorName.trim()) {
      setError('O nome do aferidor é obrigatório.');
      return;
    }
    if (!title.trim()) {
      setError('O título da coleta é obrigatório.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      setUserName(aferidorName.trim());

      const targetDurationMinutes =
        durationMode === 'unlimited'
          ? undefined
          : durationMode === 'custom'
          ? parseInt(customMinutes, 10) > 0
            ? parseInt(customMinutes, 10)
            : undefined
          : parseInt(durationMode, 10);

      const collection = await collectionsApi.create({
        title: title.trim(),
        aferidorName: aferidorName.trim(),
        location: location.trim() || undefined,
        queueMode,
        targetDurationMinutes,
        attendants,
      });

      if (generateQrCode) {
        setCreatedCollection({
          id: collection.id,
          title: collection.title,
          remoteToken: collection.remoteToken,
        });
        setShowQrModal(true);
      } else {
        navigate(`/coletas/${collection.id}/operacao`);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao criar coleta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Nova Coleta</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Aferidor *</label>
              <input
                type="text"
                required
                placeholder="Seu nome"
                value={aferidorName}
                onChange={(e) => setAferidorName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Título *</label>
              <input
                type="text"
                required
                placeholder="Ex.: Almoço - Balcão 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Local</label>
              <input
                type="text"
                placeholder="Ex.: RU Central"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Modo de Fila</label>
              <select
                value={queueMode}
                onChange={(e) => setQueueMode(e.target.value as QueueMode)}
                className="w-full px-3 py-2 rounded border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="SEPARATE_QUEUES">Filas Separadas</option>
                <option value="SINGLE_QUEUE">Fila Única</option>
                <option value="CUSTOM">Personalizado</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-700">Atendentes</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAttendant}
                className="gap-1 text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </Button>
            </div>

            <div className="space-y-2">
              {attendants.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={att.code}
                    maxLength={5}
                    onChange={(e) => handleAttendantChange(idx, 'code', e.target.value)}
                    placeholder="Cód"
                    className="w-14 px-2 py-1.5 text-center font-bold uppercase rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    value={att.displayName}
                    onChange={(e) => handleAttendantChange(idx, 'displayName', e.target.value)}
                    placeholder="Nome"
                    className="flex-1 px-3 py-1.5 rounded border border-slate-300"
                  />
                  {attendants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendant(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Duração da Aferição (Temporizador Automático) */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <label className="font-semibold text-slate-800">
                Tempo da Aferição (Cronômetro com Término Automático)
              </label>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Ao iniciar a aferição, o cronômetro fará a contagem regressiva e finalizará a coleta automaticamente ao chegar em 00:00.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { value: '10', label: '10 minutos' },
                { value: '15', label: '15 minutos' },
                { value: '20', label: '20 minutos' },
                { value: '30', label: '30 minutos (Padrão)' },
                { value: '45', label: '45 minutos' },
                { value: '60', label: '60 min (1 hora)' },
                { value: 'custom', label: 'Personalizado...' },
                { value: 'unlimited', label: 'Sem Limite (Livre)' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDurationMode(opt.value)}
                  className={`py-1.5 px-2 rounded border text-xs font-medium transition-colors ${
                    durationMode === opt.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {durationMode === 'custom' && (
              <div className="flex items-center gap-2 pt-1 max-w-xs">
                <input
                  type="number"
                  min="1"
                  max="480"
                  placeholder="Minutos"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="w-28 px-3 py-1.5 rounded border border-slate-300 font-mono text-xs focus:outline-none focus:border-blue-600"
                />
                <span className="text-xs text-slate-600">minutos de duração</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={generateQrCode}
                onChange={(e) => setGenerateQrCode(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <span className="font-medium text-xs text-slate-800 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-blue-600" />
                Gerar QR Code para conectar celular
              </span>
            </label>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Criar Coleta
            </Button>
          </div>
        </form>
      </Card>

      {createdCollection && (
        <QrCodeSyncModal
          isOpen={showQrModal}
          onClose={() => {
            setShowQrModal(false);
            navigate(`/coletas/${createdCollection.id}/operacao`);
          }}
          collectionId={createdCollection.id}
          collectionTitle={createdCollection.title}
          initialToken={createdCollection.remoteToken}
        />
      )}
    </div>
  );
};
