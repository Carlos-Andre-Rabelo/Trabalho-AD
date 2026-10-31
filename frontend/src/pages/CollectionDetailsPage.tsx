import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { metricsApi, CollectionMetricsResponse } from '../api/metrics.js';
import { StatCard } from '../components/common/StatCard.js';
import { Card } from '../components/common/Card.js';
import { Badge } from '../components/common/Badge.js';
import { Button } from '../components/common/Button.js';
import { ThroughputChart } from '../components/charts/ThroughputChart.js';
import { ArrivalsVsDeliveriesChart } from '../components/charts/ArrivalsVsDeliveriesChart.js';
import { QueueEvolutionChart } from '../components/charts/QueueEvolutionChart.js';
import { formatNumber, formatDateTime, formatSecondsToStopwatch } from '../utils/formatters.js';
import {
  Play,
  FileText,
  Download,
  AlertTriangle,
  Clock,
  TrendingUp,
  Scale,
  Users,
  Activity,
  ArrowLeft,
  Info,
} from 'lucide-react';

export const CollectionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CollectionMetricsResponse | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const [metricsRes, timelineRes] = await Promise.all([
          metricsApi.getMetrics(id),
          metricsApi.getTimeline(id, 5),
        ]);
        setData(metricsRes);
        setTimeline(timelineRes);
      } catch (e) {
        console.error('Falha ao obter métricas da coleta', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Calculando métricas e teoria das filas...
      </div>
    );
  }

  const { collection, metrics } = data;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/coletas"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {collection.title}
              </h1>
              <Badge status={collection.status} />
            </div>
            <div className="text-xs text-slate-500">
              Início: {formatDateTime(collection.startedAt)} • Fim:{' '}
              {formatDateTime(collection.endedAt) || 'Em andamento'}
              {collection.location && ` • ${collection.location}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {collection.status === 'IN_PROGRESS' || collection.status === 'PAUSED' ? (
            <Link to={`/coletas/${id}/operacao`}>
              <Button variant="success" size="sm" className="gap-1.5 font-bold">
                <Play className="w-3.5 h-3.5 fill-current" /> Operar Coleta
              </Button>
            </Link>
          ) : null}

          <Link to={`/coletas/${id}/relatorios`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> Relatório Imprimível
            </Button>
          </Link>

          <a href={metricsApi.getAggregatedCsvUrl(id!)} download>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> CSV Métricas
            </Button>
          </a>

          <a href={metricsApi.getRawCsvUrl(id!)} download>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
              <Download className="w-3.5 h-3.5" /> CSV Eventos
            </Button>
          </a>
        </div>
      </div>

      {/* Avisos e Limitações Metodológicas se existirem */}
      {metrics.sampleIntegrity.limitations.length > 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Limitações Metodológicas e Integridade Amostral:</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
            {metrics.sampleIntegrity.limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Tempo Operacional (T)"
          value={formatSecondsToStopwatch(metrics.timeMetrics.operationalDurationSeconds)}
          unit={`(${metrics.timeMetrics.operationalDurationMinutes} min)`}
          icon={<Clock className="w-5 h-5 text-blue-700" />}
          subtext={`Total: ${formatSecondsToStopwatch(metrics.timeMetrics.totalDurationSeconds)} | Pausas: ${metrics.timeMetrics.pauseDurationSeconds}s`}
        />

        <StatCard
          label="Throughput Geral (X)"
          value={metrics.overallThroughput.deliveriesPerMinute}
          unit="estudantes/min"
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          subtext={`Total de ${metrics.overallThroughput.totalDeliveries} entregas válidas (${metrics.overallThroughput.deliveriesPerHour ?? '—'} /hora)`}
        />

        <StatCard
          label="Taxa de Chegada (λ)"
          value={metrics.arrivalMetrics.arrivalsPerMinute}
          unit="estudantes/min"
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          subtext={`Total de ${metrics.arrivalMetrics.totalArrivals} chegadas observadas`}
        />

        <StatCard
          label="Intensidade de Tráfego (ρ)"
          value={metrics.queueTheory.trafficIntensityRho}
          unit={metrics.queueTheory.trafficIntensityRho !== null ? 'λ / (c·μ)' : ''}
          icon={<Activity className="w-5 h-5 text-amber-600" />}
          highlight={metrics.queueTheory.stabilityState === 'SATURATED_OR_UNSTABLE'}
          subtext={
            metrics.queueTheory.stabilityState === 'STABLE'
              ? 'Sistema em regime estável (ρ < 1.0)'
              : metrics.queueTheory.stabilityState === 'SATURATED_OR_UNSTABLE'
              ? 'ALERTA: Fila saturada (ρ >= 1.0)'
              : 'Amostra em consolidação'
          }
        />
      </div>

      {/* Tabela Comparativa de Atendentes */}
      <Card>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Desempenho por Canal de Atendimento</h2>
            <p className="text-xs text-slate-400">
              Métricas calculadas a partir de eventos de conclusão e intervalos cronometrados
            </p>
          </div>
          <Link to={`/coletas/${id}/eventos`} className="text-xs font-semibold text-blue-700 hover:underline">
            Ver eventos brutos
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Atendente</th>
                <th className="py-2.5 px-3 text-right">Entregas</th>
                <th className="py-2.5 px-3 text-right">Taxa (X/min)</th>
                <th className="py-2.5 px-3 text-right">% do Total</th>
                <th className="py-2.5 px-3 text-right">Tempo Médio (s)</th>
                <th className="py-2.5 px-3 text-right">Mediana (s)</th>
                <th className="py-2.5 px-3 text-right">Desvio Padrão</th>
                <th className="py-2.5 px-3 text-right">Mín / Máx (s)</th>
                <th className="py-2.5 px-3 text-right">Utilização (U)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.attendantsMetrics.map((att) => (
                <tr key={att.attendantId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">
                    <span className="w-6 h-6 inline-flex items-center justify-center rounded bg-blue-900 text-white font-bold mr-2 text-[10px]">
                      {att.code}
                    </span>
                    {att.displayName}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-slate-900">
                    {att.deliveriesCount}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-blue-900">
                    {att.deliveriesPerMinute ?? '—'}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {att.percentOfTotalDeliveries}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium text-slate-900">
                    {att.serviceTimeSeconds.mean !== null ? `${att.serviceTimeSeconds.mean}s` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600">
                    {att.serviceTimeSeconds.median !== null ? `${att.serviceTimeSeconds.median}s` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-500">
                    {att.serviceTimeSeconds.stdDev !== null ? `±${att.serviceTimeSeconds.stdDev}s` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-500">
                    {att.serviceTimeSeconds.min !== null
                      ? `${att.serviceTimeSeconds.min}s / ${att.serviceTimeSeconds.max}s`
                      : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-800">
                    {att.utilizationPercent !== null ? `${att.utilizationPercent}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ressalva Comparativa Obrigatória */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-slate-800">Ressalva Metodológica e Estatística: </span>
            {metrics.comparison.disclaimer}
            {metrics.comparison.throughputComparisonText && (
              <span className="block mt-1 font-semibold text-slate-900">
                Observação descritiva da amostra: {metrics.comparison.throughputComparisonText}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Seção Teoria das Filas e Lei de Little */}
      <Card>
        <div className="pb-3 border-b border-slate-100 mb-3">
          <h2 className="text-sm font-bold text-slate-800">Análise de Teoria das Filas e Lei de Little</h2>
          <p className="text-xs text-slate-400">
            Avaliação estocástica do balcão de distribuição (regime operacional)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mb-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium">Taxa de Chegada (λ)</span>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {metrics.queueTheory.lambdaPerMinute ?? '—'}{' '}
              <span className="text-xs font-normal text-slate-500">estudantes/min</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium">Capacidade do Sistema (c · μ)</span>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {metrics.queueTheory.totalCapacityPerMinute ?? '—'}{' '}
              <span className="text-xs font-normal text-slate-500">atendimentos/min</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium">Equação de Little</span>
            <div className="text-sm font-mono font-bold text-blue-900 mt-1">
              {metrics.queueTheory.littlesLaw.formula}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
          <strong>Explicação Metodológica:</strong> {metrics.queueTheory.littlesLaw.notes}
          {metrics.queueTheory.reasonIfNotApplicable && (
            <span className="block text-amber-700 mt-1 font-semibold">
              Nota: {metrics.queueTheory.reasonIfNotApplicable}
            </span>
          )}
        </p>
      </Card>

      {/* Gráficos Analíticos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-800">Chegadas vs Entregas Acumuladas</h3>
            <p className="text-xs text-slate-400">Curvas acumuladas para identificar acúmulo de fila</p>
          </div>
          <ArrivalsVsDeliveriesChart data={timeline} />
        </Card>

        <Card>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-800">Throughput por Intervalo (Atendentes A e B)</h3>
            <p className="text-xs text-slate-400">Entregas a cada 5 minutos por atendente</p>
          </div>
          <ThroughputChart data={timeline} />
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-800">Evolução Estimada do Tamanho da Fila (L)</h3>
            <p className="text-xs text-slate-400">
              Estudantes aguardando no sistema ao longo do tempo de observação
            </p>
          </div>
          <QueueEvolutionChart data={timeline} />
        </Card>
      </div>

      {/* Módulo Opcional de Proteína se houver medições */}
      {metrics.proteinMetrics && (
        <Card>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
            <Scale className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-800">Amostragem de Peso de Proteína Servida</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-400">Total de Amostras</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {metrics.proteinMetrics.totalMeasurements}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-400">Massa Média por Porção</span>
              <div className="text-base font-bold text-blue-900 mt-0.5">
                {metrics.proteinMetrics.averageGramsPerServing} g
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-400">Mínimo Medido</span>
              <div className="text-base font-bold text-slate-800 mt-0.5">
                {metrics.proteinMetrics.minGrams} g
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-400">Máximo Medido</span>
              <div className="text-base font-bold text-slate-800 mt-0.5">
                {metrics.proteinMetrics.maxGrams} g
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
