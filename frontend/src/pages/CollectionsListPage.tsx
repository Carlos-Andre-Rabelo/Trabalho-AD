import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collectionsApi, Collection, CollectionStatus } from '../api/collections.js';
import { Card } from '../components/common/Card.js';
import { Badge } from '../components/common/Badge.js';
import { Button } from '../components/common/Button.js';
import { formatDate, formatTime } from '../utils/formatters.js';
import { PlusCircle, Play, Eye, Filter, ArrowRight } from 'lucide-react';

export const CollectionsListPage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      const filter = statusFilter === 'ALL' ? undefined : (statusFilter as CollectionStatus);
      const res = await collectionsApi.list({ status: filter });
      setCollections(res.data);
    } catch (e) {
      console.error('Falha ao listar coletas', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Coletas e Observações</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento e histórico de todas as sessões de aferição de filas do RU
          </p>
        </div>

        <Link to="/coletas/nova">
          <Button variant="primary" size="md" className="gap-2 shadow-sm font-semibold">
            <PlusCircle className="w-4 h-4" />
            <span>Nova Coleta</span>
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                isSelected
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {labels[st]}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-slate-400">Carregando coletas...</div>
      ) : collections.length === 0 ? (
        <Card className="text-center py-16">
          <div className="text-sm font-bold text-slate-800">Nenhuma coleta encontrada</div>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Não há coletas registradas com o filtro selecionado.
          </p>
          <Link to="/coletas/nova">
            <Button variant="primary" size="sm">
              Criar Nova Coleta
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col) => {
            const isOperational = col.status === 'IN_PROGRESS' || col.status === 'PAUSED';
            return (
              <Card key={col.id} className="flex flex-col justify-between hover:border-slate-300">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2">
                      {col.title}
                    </h3>
                    <Badge status={col.status} />
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                    {col.description || 'Sem descrição cadastrada para esta sessão de observação.'}
                  </p>

                  <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Modo de Fila:</span>
                      <span className="font-medium text-slate-800">
                        {col.queueMode === 'SEPARATE_QUEUES'
                          ? 'Filas Separadas'
                          : col.queueMode === 'SINGLE_QUEUE'
                          ? 'Fila Única'
                          : 'Personalizado'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Atendentes:</span>
                      <span className="font-medium text-slate-800">
                        {col.attendants?.map((a) => a.code).join(', ') || 'A, B'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Entregas Válidas:</span>
                      <span className="font-black text-slate-900">{col._count?.events || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Criada em:</span>
                      <span>{formatDate(col.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {isOperational ? (
                    <Link to={`/coletas/${col.id}/operacao`} className="w-full">
                      <Button variant="success" size="sm" className="w-full gap-2 font-bold">
                        <Play className="w-4 h-4 fill-current" />
                        <span>Operar Coleta</span>
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Link to={`/coletas/${col.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Análise</span>
                        </Button>
                      </Link>
                      <Link to={`/coletas/${col.id}/operacao`}>
                        <Button variant="ghost" size="sm" title="Abrir tela operacional">
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
