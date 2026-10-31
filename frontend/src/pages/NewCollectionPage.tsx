import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collectionsApi, QueueMode } from '../api/collections.js';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { ArrowLeft, Save, Plus, Trash2, HelpCircle } from 'lucide-react';

export const NewCollectionPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Restaurante Universitário - Balcão Principal');
  const [timezone] = useState('America/Sao_Paulo');
  const [queueMode, setQueueMode] = useState<QueueMode>('SEPARATE_QUEUES');
  const [notes, setNotes] = useState('');

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
    if (!title.trim()) {
      setError('O título da coleta é obrigatório.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const collection = await collectionsApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        queueMode,
        attendants,
        notes: notes.trim() || undefined,
      });

      // Redireciona diretamente para a tela operacional
      navigate(`/coletas/${collection.id}/operacao`);
    } catch (err: any) {
      setError(err?.message || 'Falha ao criar coleta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Nova Coleta de Dados</h1>
          <p className="text-xs text-slate-500">
            Configure os parâmetros da sessão de aferição antes de iniciar o registro de eventos
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Título da Sessão de Coleta *
            </label>
            <input
              type="text"
              required
              placeholder="Ex.: Aferição Almoço - Distribuição de Proteína (Balcão 1)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Local da Observação</label>
              <input
                type="text"
                placeholder="Ex.: RU Central - Ala Sul"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Configuração do Sistema de Filas *
              </label>
              <select
                value={queueMode}
                onChange={(e) => setQueueMode(e.target.value as QueueMode)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                <option value="SEPARATE_QUEUES">Filas Separadas (cada atendente tem sua fila)</option>
                <option value="SINGLE_QUEUE">Fila Única Compartilhada (alunos aguardam e vão ao livre)</option>
                <option value="CUSTOM">Configuração Personalizada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Objetivo Acadêmico / Descrição
            </label>
            <textarea
              rows={2}
              placeholder="Ex.: Análise de throughput e tempo de serviço para o trabalho prático de Avaliação de Desempenho..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          {/* Atendentes */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-bold text-slate-800 text-xs">Atendentes da Sessão</span>
                <p className="text-[11px] text-slate-400">
                  Identificadores anônimos (ex.: Atendente A, B) para preservar a privacidade
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAttendant}
                className="gap-1 text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Atendente
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
                    placeholder="Código"
                    className="w-16 px-3 py-2 text-center font-bold uppercase rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  <input
                    type="text"
                    value={att.displayName}
                    onChange={(e) => handleAttendantChange(idx, 'displayName', e.target.value)}
                    placeholder="Nome legível"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  {attendants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendant(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="Remover atendente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Observações Adicionais */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notas Gerais Pré-Coleta</label>
            <input
              type="text"
              placeholder="Ex.: Cardápio do dia: carne bovina ao molho e opção vegetariana de lentilha..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="gap-2 font-bold px-6 bg-blue-900 hover:bg-blue-950"
            >
              <Save className="w-4 h-4" />
              <span>Criar e Ir para Operação</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
