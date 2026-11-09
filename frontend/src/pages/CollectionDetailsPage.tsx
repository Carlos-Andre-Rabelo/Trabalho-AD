import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { metricsApi, CollectionMetricsResponse } from '../api/metrics.js';
import { collectionsApi } from '../api/collections.js';
import { StatCard } from '../components/common/StatCard.js';
import { Card } from '../components/common/Card.js';
import { Badge } from '../components/common/Badge.js';
import { Button } from '../components/common/Button.js';
import { Modal } from '../components/common/Modal.js';
import { QrCodeSyncModal } from '../components/operational/QrCodeSyncModal.js';
import { ThroughputChart } from '../components/charts/ThroughputChart.js';
import { ArrivalsVsDeliveriesChart } from '../components/charts/ArrivalsVsDeliveriesChart.js';
import { QueueEvolutionChart } from '../components/charts/QueueEvolutionChart.js';
import { formatDateTime, formatSecondsToStopwatch } from '../utils/formatters.js';
import { Play, Download, ArrowLeft, QrCode, FileSpreadsheet, FileText, Trash2, AlertTriangle } from 'lucide-react';

export const CollectionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CollectionMetricsResponse | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await collectionsApi.delete(id);
      navigate('/coletas');
    } catch (err: any) {
      alert(err?.message || 'Falha ao excluir coleta.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([metricsApi.getMetrics(id), metricsApi.getTimeline(id, 5)])
      .then(([metricsRes, timelineRes]) => {
        setData(metricsRes);
        setTimeline(timelineRes);
      })
      .catch((e) => console.error('Falha ao obter métricas da coleta', e))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
        Carregando...
      </div>
    );
  }

  const { collection, metrics } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            to="/coletas"
            className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900">{collection.title}</h1>
              <Badge status={collection.status} />
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wide">
                {collection.queueMode === 'SEPARATE_QUEUES'
                  ? 'Filas Separadas'
                  : collection.queueMode === 'SINGLE_QUEUE'
                  ? 'Fila Única'
                  : 'Personalizado'}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {collection.owner?.name || 'Aferidor'} • {formatDateTime(collection.startedAt)}
              {collection.location && ` • ${collection.location}`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsQrModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <QrCode className="w-3.5 h-3.5 text-blue-600" /> QR Celular
          </Button>

          <Link to={`/coletas/${id}/operacao`}>
            <Button variant="success" size="sm" className="gap-1.5">
              <Play className="w-3.5 h-3.5 fill-current" /> Operar
            </Button>
          </Link>

          <a href={metricsApi.getExcelUrl(id!)} download>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 font-bold"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Exportar Excel (.xlsx)</span>
            </Button>
          </a>

          <a href={metricsApi.getCompleteCsvUrl(id!)} download>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> CSV Completo
            </Button>
          </a>

          <Link to={`/coletas/${id}/relatorio`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> Relatório
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            className="gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
            title="Excluir coleta permanentemente"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Excluir</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Tempo Ativo (T)"
          value={formatSecondsToStopwatch(metrics.timeMetrics.operationalDurationSeconds)}
        />
        <StatCard
          label="Throughput (X)"
          value={metrics.overallThroughput.deliveriesPerMinute}
          unit="/min"
        />
        <StatCard
          label="Taxa de Chegada (λ)"
          value={metrics.arrivalMetrics.arrivalsPerMinute}
          unit="/min"
        />
        <StatCard
          label="Intensidade (ρ)"
          value={metrics.queueTheory.trafficIntensityRho}
          highlight={metrics.queueTheory.stabilityState === 'SATURATED_OR_UNSTABLE'}
        />
      </div>

      {collection.queueMode === 'SEPARATE_QUEUES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {metrics.attendantsMetrics.map((att) => (
            <div
              key={`queue-summary-${att.attendantId}`}
              className="bg-white rounded-lg border border-blue-200 p-3.5 shadow-sm flex items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">
                    Fila {att.code}
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {att.queueName || `Fila ${att.displayName}`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                  <span>
                    Taxa Chegada (λ_{att.code}):{' '}
                    <strong className="text-slate-800">{att.arrivalsPerMinute ?? '—'}/min</strong>
                  </span>
                  <span>
                    Entregas:{' '}
                    <strong className="text-emerald-700">{att.deliveriesCount}</strong>
                  </span>
                  <span>
                    Saldo Fila:{' '}
                    <strong className="text-amber-700">{att.estimatedQueueRemainder ?? 0}</strong>
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xl font-bold font-mono text-blue-700">
                  {att.arrivalsCount ?? 0}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Chegadas ({att.percentOfTotalArrivals ?? 0}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
          <h2 className="text-xs font-bold uppercase text-slate-500">
            {collection.queueMode === 'SEPARATE_QUEUES'
              ? 'Atendentes e Filas Individuais'
              : 'Atendentes'}
          </h2>
          <Link to={`/coletas/${id}/eventos`} className="text-xs text-blue-600 hover:underline">
            Histórico de Eventos
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Atendente / Fila</th>
                {collection.queueMode === 'SEPARATE_QUEUES' && (
                  <>
                    <th className="py-2 px-3 text-right">Chegadas Fila</th>
                    <th className="py-2 px-3 text-right">λ Fila (/min)</th>
                  </>
                )}
                <th className="py-2 px-3 text-right">Entregas</th>
                <th className="py-2 px-3 text-right">Taxa (/min)</th>
                <th className="py-2 px-3 text-right">% Entregas</th>
                {collection.queueMode === 'SEPARATE_QUEUES' && (
                  <th className="py-2 px-3 text-right">Saldo Fila</th>
                )}
                <th className="py-2 px-3 text-right">Média (s)</th>
                <th className="py-2 px-3 text-right">Utilização</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.attendantsMetrics.map((att) => (
                <tr key={att.attendantId}>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    [{att.code}] {att.displayName}
                  </td>
                  {collection.queueMode === 'SEPARATE_QUEUES' && (
                    <>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-700 font-mono">
                        {att.arrivalsCount ?? 0}{' '}
                        <span className="text-[10px] font-normal text-slate-400">
                          ({att.percentOfTotalArrivals ?? 0}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-blue-600 font-semibold">
                        {att.arrivalsPerMinute ?? '—'}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    {att.deliveriesCount}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                    {att.deliveriesPerMinute ?? '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600">
                    {att.percentOfTotalDeliveries}%
                  </td>
                  {collection.queueMode === 'SEPARATE_QUEUES' && (
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                      {att.estimatedQueueRemainder ?? 0}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                    {att.serviceTimeSeconds.mean !== null ? `${att.serviceTimeSeconds.mean}s` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                    {att.utilizationPercent !== null ? `${att.utilizationPercent}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">Chegadas vs Entregas</h3>
          <ArrivalsVsDeliveriesChart data={timeline} />
        </Card>

        <Card>
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">Throughput por Intervalo</h3>
          <ThroughputChart data={timeline} />
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">Evolução da Fila (L)</h3>
          <QueueEvolutionChart data={timeline} />
        </Card>
      </div>

      {id && (
        <QrCodeSyncModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          collectionId={id}
          collectionTitle={collection.title}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Excluir Coleta"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Atenção: Ação irreversível!</p>
              <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                Tem certeza que deseja apagar a coleta <strong>"{collection.title}"</strong>?
                Todos os eventos, cronometragens e relatórios vinculados serão permanentemente excluídos.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
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
