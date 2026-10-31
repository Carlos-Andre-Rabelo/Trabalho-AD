import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventsApi, EventItem } from '../api/events.js';
import { collectionsApi, Collection } from '../api/collections.js';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { formatDateTime } from '../utils/formatters.js';
import { ArrowLeft, Filter, Undo2, CheckCircle2, UserPlus, AlertCircle } from 'lucide-react';

export const EventHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [includeVoided, setIncludeVoided] = useState(true);
  const [page, setPage] = useState(1);

  const fetchEvents = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [col, res] = await Promise.all([
        collectionsApi.getById(id),
        eventsApi.list(id, {
          eventType: eventTypeFilter || undefined,
          includeVoided,
          page,
          limit: 25,
        }),
      ]);
      setCollection(col);
      setEvents(res.data);
      setPagination(res.pagination);
    } catch (e) {
      console.error('Falha ao obter eventos', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [id, eventTypeFilter, includeVoided, page]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to={`/coletas/${id}`}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Histórico Completo e Auditoria
            </h1>
            <p className="text-xs text-slate-500">
              Coleta: {collection?.title || 'Carregando...'} • Registros brutos com rastreabilidade
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/coletas/${id}/operacao`}>
            <Button variant="outline" size="sm" className="text-xs">
              Tela Operacional
            </Button>
          </Link>
          <Link to={`/coletas/${id}`}>
            <Button variant="primary" size="sm" className="text-xs bg-blue-900">
              Análise e Gráficos
            </Button>
          </Link>
        </div>
      </div>

      {/* Controles de Filtro */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filtrar Tipo:
            </span>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              <option value="">Todos os Eventos</option>
              <option value="DELIVERY">Apenas Entregas</option>
              <option value="ARRIVAL">Apenas Chegadas</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
            <input
              type="checkbox"
              checked={includeVoided}
              onChange={(e) => {
                setIncludeVoided(e.target.checked);
                setPage(1);
              }}
              className="rounded text-blue-900 focus:ring-blue-800"
            />
            <span>Exibir registros anulados (auditoria)</span>
          </label>
        </div>
      </Card>

      {/* Tabela de Eventos */}
      <Card>
        {isLoading ? (
          <div className="py-20 text-center text-xs text-slate-400">Carregando eventos...</div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Nenhum evento registrado encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Horário Ocorrência</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Atendente / Fila</th>
                  <th className="py-2.5 px-3">Chave de Idempotência</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <tr
                    key={ev.id}
                    className={`transition-colors ${
                      ev.isVoided ? 'bg-rose-50/40 text-rose-700' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {formatDateTime(ev.occurredAt)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {ev.eventType === 'ARRIVAL' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold bg-blue-100 text-blue-800">
                          <UserPlus className="w-3 h-3" /> Chegada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Entrega
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                      {ev.attendant ? (
                        <span>
                          [{ev.attendant.code}] {ev.attendant.displayName}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {ev.queue && <span className="text-slate-400 ml-1.5">({ev.queue.name})</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400 max-w-[150px] truncate">
                      {ev.idempotencyKey}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {ev.isVoided ? (
                        <span className="font-semibold text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Anulado: {ev.voidReason || 'Sem motivo'}</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Válido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
