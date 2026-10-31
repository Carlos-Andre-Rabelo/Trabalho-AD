import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { metricsApi, CollectionMetricsResponse } from '../api/metrics.js';
import { Button } from '../components/common/Button.js';
import { formatDateTime, formatDate, formatSecondsToStopwatch } from '../utils/formatters.js';
import { Printer, Download, ArrowLeft } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CollectionMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    metricsApi
      .getMetrics(id)
      .then(setData)
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading || !data) {
    return (
      <div className="py-24 text-center text-sm text-slate-400">
        Gerando relatório acadêmico de desempenho...
      </div>
    );
  }

  const { collection, metrics } = data;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Botões de Ação Superiores (Ocultados na Impressão) */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          to={`/coletas/${id}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Análise
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => window.print()}
            className="gap-2 font-bold bg-blue-900"
          >
            <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
          </Button>

          <a href={metricsApi.getAggregatedCsvUrl(id!)} download>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </a>
        </div>
      </div>

      {/* Relatório Acadêmico Formatado */}
      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 space-y-8 text-slate-900">
        {/* Cabeçalho Institucional */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
              Relatório de Avaliação de Desempenho de Filas
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Restaurante Universitário • Estudo Prático de Filas e Atendimento de Proteína
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            RU Metrics v1.0<br />
            {formatDate(new Date())}
          </div>
        </div>

        {/* Metadados da Sessão */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span className="text-slate-400 font-medium uppercase">Título</span>
            <div className="font-bold text-slate-900 mt-0.5">{collection.title}</div>
          </div>
          <div>
            <span className="text-slate-400 font-medium uppercase">Local</span>
            <div className="font-bold text-slate-900 mt-0.5">{collection.location || 'Bancada Central'}</div>
          </div>
          <div>
            <span className="text-slate-400 font-medium uppercase">Modo de Fila</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {collection.queueMode === 'SEPARATE_QUEUES'
                ? 'Filas Separadas'
                : collection.queueMode === 'SINGLE_QUEUE'
                ? 'Fila Única'
                : 'Personalizado'}
            </div>
          </div>
          <div>
            <span className="text-slate-400 font-medium uppercase">Estado</span>
            <div className="font-bold text-slate-900 mt-0.5">{collection.status}</div>
          </div>
        </div>

        {/* Tempos e Volume Observado */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-3">
            1. Caracterização Temporal e Amostral
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500">Início da Observação</span>
              <div className="font-mono font-semibold text-slate-900 mt-0.5">
                {formatDateTime(collection.startedAt)}
              </div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500">Término da Observação</span>
              <div className="font-mono font-semibold text-slate-900 mt-0.5">
                {formatDateTime(collection.endedAt) || 'Em andamento'}
              </div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500">Tempo Operacional Líquido (T)</span>
              <div className="font-mono font-bold text-blue-900 mt-0.5">
                {formatSecondsToStopwatch(metrics.timeMetrics.operationalDurationSeconds)} (
                {metrics.timeMetrics.operationalDurationMinutes} min)
              </div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500">Pausas / Interrupções</span>
              <div className="font-mono font-semibold text-amber-700 mt-0.5">
                {formatSecondsToStopwatch(metrics.timeMetrics.pauseDurationSeconds)}
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Indicadores por Atendente */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-3">
            2. Métricas de Throughput e Atendimento
          </h2>
          <table className="w-full text-xs text-left border border-slate-200">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
              <tr>
                <th className="p-2.5 border-b">Atendente</th>
                <th className="p-2.5 border-b text-right">Entregas (N)</th>
                <th className="p-2.5 border-b text-right">Throughput (X/min)</th>
                <th className="p-2.5 border-b text-right">Proporção</th>
                <th className="p-2.5 border-b text-right">Tempo Médio (E[S])</th>
                <th className="p-2.5 border-b text-right">Desvio Padrão</th>
                <th className="p-2.5 border-b text-right">Utilização (U)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {metrics.attendantsMetrics.map((att) => (
                <tr key={att.attendantId}>
                  <td className="p-2.5 font-bold">[{att.code}] {att.displayName}</td>
                  <td className="p-2.5 text-right font-black">{att.deliveriesCount}</td>
                  <td className="p-2.5 text-right font-bold text-blue-900">{att.deliveriesPerMinute ?? '—'}</td>
                  <td className="p-2.5 text-right">{att.percentOfTotalDeliveries}%</td>
                  <td className="p-2.5 text-right font-mono">{att.serviceTimeSeconds.mean !== null ? `${att.serviceTimeSeconds.mean}s` : '—'}</td>
                  <td className="p-2.5 text-right font-mono">{att.serviceTimeSeconds.stdDev !== null ? `±${att.serviceTimeSeconds.stdDev}s` : '—'}</td>
                  <td className="p-2.5 text-right font-bold">{att.utilizationPercent !== null ? `${att.utilizationPercent}%` : '—'}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-black">
                <td className="p-2.5">Agregado Total</td>
                <td className="p-2.5 text-right">{metrics.overallThroughput.totalDeliveries}</td>
                <td className="p-2.5 text-right text-blue-950">{metrics.overallThroughput.deliveriesPerMinute ?? '—'}</td>
                <td className="p-2.5 text-right">100%</td>
                <td className="p-2.5 text-right" colSpan={3}>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Análise de Teoria das Filas e Lei de Little */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-3">
            3. Aplicação da Teoria das Filas e Lei de Little
          </h2>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs leading-relaxed">
            <div className="grid grid-cols-3 gap-3 font-mono font-bold text-center">
              <div className="bg-white p-2 rounded border border-slate-200">
                λ = {metrics.arrivalMetrics.arrivalsPerMinute ?? 'N/D'} est/min
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                μ = {metrics.queueTheory.muPerAttendantPerMinute ?? 'N/D'} atend/min
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                ρ = {metrics.queueTheory.trafficIntensityRho ?? 'N/D'}
              </div>
            </div>

            <p>
              <strong>Equação Fundamental:</strong> {metrics.queueTheory.littlesLaw.formula}
            </p>
            <p>{metrics.queueTheory.littlesLaw.notes}</p>
            {metrics.queueTheory.stabilityState === 'SATURATED_OR_UNSTABLE' && (
              <p className="font-bold text-rose-700">
                Alerta de Estabilidade: λ &gt;= c·μ. A taxa média de chegada ultrapassa a capacidade de entrega
                no período observado, caracterizando fila em regime de sobrecarga.
              </p>
            )}
          </div>
        </div>

        {/* Parecer Metodológico e Ressalvas Obrigatórias */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2">
            4. Ressalva Metodológica Obrigatória
          </h2>
          <div className="p-4 border border-slate-300 rounded-xl bg-slate-50 text-xs text-slate-700 leading-relaxed space-y-2">
            <p>
              <strong>Critério Científico de Comparação:</strong> {metrics.comparison.disclaimer}
            </p>
            {metrics.sampleIntegrity.limitations.length > 0 && (
              <div>
                <strong>Limitações Declaradas da Amostra:</strong>
                <ul className="list-disc list-inside mt-1">
                  {metrics.sampleIntegrity.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Assinatura Acadêmica */}
        <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">
            Pesquisador Responsável / Discente
          </div>
          <div className="border-t border-slate-300 pt-2">
            Docente da Disciplina de Avaliação de Desempenho
          </div>
        </div>
      </div>
    </div>
  );
};
