import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventsApi, EventItem } from '../api/events.js';
import { collectionsApi, Collection } from '../api/collections.js';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { ArrowLeft, Filter, AlertCircle } from 'lucide-react';

function getEventServiceTimes(ev: EventItem) {
  const endTime = new Date(ev.occurredAt);
  let startTime = endTime;
  let durationSeconds = 0;

  if (ev.metadata?.startedAt) {
    startTime = new Date(ev.metadata.startedAt);
  } else if (ev.metadata?.durationSeconds !== undefined) {
    durationSeconds = ev.metadata.durationSeconds;
    startTime = new Date(endTime.getTime() - durationSeconds * 1000);
  } else if (ev.metadata?.durationMs !== undefined) {
    durationSeconds = Math.round(ev.metadata.durationMs / 1000);
    startTime = new Date(endTime.getTime() - ev.metadata.durationMs);
  }

  if (ev.metadata?.durationSeconds !== undefined) {
    durationSeconds = ev.metadata.durationSeconds;
  } else if (ev.metadata?.durationMs !== undefined) {
    durationSeconds = Math.round(ev.metadata.durationMs / 1000);
  } else {
    durationSeconds = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));
  }

  const formatTimestamp = (d: Date) => {
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return {
    startTimeStr: formatTimestamp(startTime),
    endTimeStr: formatTimestamp(endTime),
    durationSeconds,
  };
}

function formatExactDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

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
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            to={`/coletas/${id}`}
            className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Histórico de Atendimentos e Eventos
            </h1>
            <p className="text-xs text-slate-500">
              {collection?.title || 'Carregando...'} • Rastreabilidade completa de início e fim
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
            <Button variant="primary" size="sm" className="text-xs">
              Resultados
            </Button>
          </Link>
        </div>
      </div>

      {/* Controles de Filtro */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filtrar:
            </span>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded border border-slate-200 bg-white"
            >
              <option value="">Todos os Registros</option>
              <option value="DELIVERY">Apenas Atendimentos</option>
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
              className="rounded text-blue-600 focus:ring-blue-600"
            />
            <span>Exibir registros anulados</span>
          </label>
        </div>
      </Card>

      {/* Lista de Registros em Retângulos */}
      <Card>
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Carregando registros...</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Nenhum evento registrado encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => {
              if (ev.eventType === 'DELIVERY') {
                const times = getEventServiceTimes(ev);

                return (
                  <div
                    key={ev.id}
                    className={`border rounded-lg p-3.5 space-y-2.5 transition-colors ${
                      ev.isVoided
                        ? 'bg-rose-50/30 border-rose-200 text-slate-500'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-bold text-xs bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                          Atendimento
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          [{ev.attendant?.code || 'A'}] {ev.attendant?.displayName || 'Atendente'}
                        </span>
                        {ev.isVoided && (
                          <span className="text-rose-600 font-semibold text-xs flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Anulado: {ev.voidReason || 'Sem motivo'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                          Tempo: {times.durationSeconds}s
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                        <span className="text-slate-400 block font-semibold text-[10px] uppercase tracking-wider mb-0.5">
                          Início
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {times.startTimeStr}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                        <span className="text-slate-400 block font-semibold text-[10px] uppercase tracking-wider mb-0.5">
                          Fim
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {times.endTimeStr}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={ev.id}
                  className={`border rounded-lg p-3 space-y-1 transition-colors ${
                    ev.isVoided
                      ? 'bg-rose-50/30 border-rose-200 text-slate-500'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-blue-100 text-blue-800 uppercase tracking-wide">
                        Chegada de Aluno
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {formatExactDateTime(ev.occurredAt)}
                      </span>
                      {ev.queue && <span className="text-slate-500 text-xs">({ev.queue.name})</span>}
                      {ev.isVoided && (
                        <span className="text-rose-600 font-semibold text-xs flex items-center gap-1 ml-2">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Anulado: {ev.voidReason || 'Sem motivo'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginação */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
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
