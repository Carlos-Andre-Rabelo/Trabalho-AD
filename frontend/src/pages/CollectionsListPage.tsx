import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collectionsApi, Collection, CollectionStatus } from '../api/collections.js';
import { Card } from '../components/common/Card.js';
import { Badge } from '../components/common/Badge.js';
import { Button } from '../components/common/Button.js';
import { Modal } from '../components/common/Modal.js';
import { formatDate } from '../utils/formatters.js';
import { PlusCircle, Play, Eye, Trash2, AlertTriangle } from 'lucide-react';

export const CollectionsListPage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const filter = statusFilter === 'ALL' ? undefined : (statusFilter as CollectionStatus);
    collectionsApi
      .list({ status: filter })
      .then((res) => setCollections(res.data))
      .catch((e) => console.error('Falha ao listar coletas', e))
      .finally(() => setIsLoading(false));
  }, [statusFilter]);

  const handleDeleteConfirm = async () => {
    if (!collectionToDelete) return;
    setIsDeleting(true);
    try {
      await collectionsApi.delete(collectionToDelete.id);
      setCollections((prev) => prev.filter((c) => c.id !== collectionToDelete.id));
      setCollectionToDelete(null);
    } catch (err: any) {
      alert(err?.message || 'Falha ao excluir coleta.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-slate-900">Coletas</h1>
        <Link to="/coletas/nova">
          <Button variant="primary" size="sm" className="gap-1.5 font-semibold">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Nova Coleta</span>
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {['ALL', 'IN_PROGRESS', 'PAUSED', 'FINISHED', 'DRAFT'].map((st) => {
          const labels: Record<string, string> = {
            ALL: 'Todas',
            IN_PROGRESS: 'Em Andamento',
            PAUSED: 'Pausadas',
            FINISHED: 'Encerradas',
            DRAFT: 'Rascunho',
          };
          const isSelected = statusFilter === st;
          return (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded font-medium whitespace-nowrap ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {labels[st]}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-400">Carregando...</div>
      ) : collections.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-xs text-slate-500 mb-3">Nenhuma coleta encontrada.</div>
          <Link to="/coletas/nova">
            <Button variant="primary" size="sm">
              Nova Coleta
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map((col) => {
            const isOperational = col.status === 'IN_PROGRESS' || col.status === 'PAUSED' || col.status === 'DRAFT';
            return (
              <Card key={col.id} className="flex flex-col justify-between gap-3 relative group">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{col.title}</h3>
                    <Badge status={col.status} />
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Aferidor:</span>
                      <span className="font-medium text-slate-800">{col.owner?.name || 'Aferidor'}</span>
                    </div>
                    {col.targetDurationMinutes && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tempo limite:</span>
                        <span className="font-medium text-blue-700">{col.targetDurationMinutes} min</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Eventos:</span>
                      <span className="font-bold text-slate-900">{col._count?.events || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Data:</span>
                      <span>{formatDate(col.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                  {isOperational ? (
                    <Link to={`/coletas/${col.id}/operacao`} className="flex-1">
                      <Button variant="success" size="sm" className="w-full gap-1.5">
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Operar</span>
                      </Button>
                    </Link>
                  ) : null}

                  <Link to={`/coletas/${col.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Resultados</span>
                    </Button>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setCollectionToDelete(col)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200 transition-colors shrink-0"
                    title="Excluir coleta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={Boolean(collectionToDelete)}
        onClose={() => !isDeleting && setCollectionToDelete(null)}
        title="Excluir Coleta"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Atenção: Esta ação é definitiva!</p>
              <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                Tem certeza que deseja excluir a coleta <strong>"{collectionToDelete?.title}"</strong>?
                Todos os eventos, atendimentos, interrupções e métricas registradas serão permanentemente apagados do banco de dados.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCollectionToDelete(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Sim, Excluir Coleta</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
