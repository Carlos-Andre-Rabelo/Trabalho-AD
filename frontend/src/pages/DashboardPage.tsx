import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { metricsApi } from '../api/metrics.js';
import { StatCard } from '../components/common/StatCard.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { Badge } from '../components/common/Badge.js';
import { formatDate, formatNumber } from '../utils/formatters.js';
import {
  ClipboardList,
  Play,
  PlusCircle,
  Activity,
  CheckCircle2,
  Users,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await metricsApi.getDashboard();
      setData(res);
    } catch (e) {
      console.error('Falha ao carregar dashboard', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Carregando painel de métricas do RU...
      </div>
    );
  }

  const activeCollection = data?.inProgressCollections?.[0];
  const lastFinished = data?.lastFinishedMetrics;

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Painel Principal</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Visão consolidada de coleta e desempenho operacional dos atendentes do RU
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeCollection ? (
            <Link to={`/coletas/${activeCollection.id}/operacao`}>
              <Button variant="success" size="md" className="gap-2 shadow-sm font-semibold">
                <Play className="w-4 h-4 fill-current" />
                <span>Retomar Coleta Ativa</span>
              </Button>
            </Link>
          ) : (
            <Link to="/coletas/nova">
              <Button variant="primary" size="md" className="gap-2 shadow-sm font-semibold">
                <PlusCircle className="w-4 h-4" />
                <span>Iniciar Nova Coleta</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Alerta de Coleta em Andamento se existir */}
      {activeCollection && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <div className="text-xs font-semibold text-emerald-900">
                Coleta em andamento no momento: {activeCollection.title}
              </div>
              <div className="text-[11px] text-emerald-700">
                {activeCollection._count?.events || 0} entregas registradas até agora
              </div>
            </div>
          </div>
          <Link to={`/coletas/${activeCollection.id}/operacao`}>
            <Button variant="success" size="sm" className="gap-1.5 font-bold">
              Ir para Operação <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Grid de Indicadores Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total de Coletas"
          value={data?.totalCollections || 0}
          unit="sessões"
          icon={<ClipboardList className="w-5 h-5" />}
          subtext="Histórico persistido no PostgreSQL"
        />

        <StatCard
          label="Em Andamento"
          value={data?.inProgressCount || 0}
          unit="coleta(s)"
          icon={<Activity className="w-5 h-5 text-emerald-600" />}
          highlight={data?.inProgressCount > 0}
          subtext="Sessões de medição ativas"
        />

        <StatCard
          label="Total de Entregas"
          value={data?.totalDeliveries || 0}
          unit="estudantes"
          icon={<CheckCircle2 className="w-5 h-5 text-blue-600" />}
          subtext="Refeições de proteína servidas"
        />

        <StatCard
          label="Throughput Médio"
          value={
            lastFinished?.metrics?.overallThroughput?.deliveriesPerMinute
              ? formatNumber(lastFinished.metrics.overallThroughput.deliveriesPerMinute, 2)
              : null
          }
          unit="pess/min"
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
          subtext="Baseado na última sessão encerrada"
        />
      </div>

      {/* Seção 2 Colunas: Últimas Coletas & Resumo da Última Finalizada */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Últimas Coletas (2 colunas) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Sessões Recentes de Aferição</h2>
            <Link to="/coletas" className="text-xs font-semibold text-blue-700 hover:underline">
              Ver todas
            </Link>
          </div>

          {data?.recentCollections?.length === 0 ? (
            <Card className="text-center py-12">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-700">Nenhuma coleta realizada ainda</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Inicie sua primeira sessão de observação das filas de proteína do RU para começar a coletar
                dados em tempo real.
              </p>
              <Link to="/coletas/nova">
                <Button variant="primary" size="sm">
                  Criar Primeira Coleta
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {data?.recentCollections?.map((col: any) => (
                <div
                  key={col.id}
                  className="bg-white rounded-xl border border-slate-200/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 text-sm hover:text-blue-700 transition-colors">
                        {col.title}
                      </span>
                      <Badge status={col.status} />
                    </div>
                    <div className="text-xs text-slate-500">
                      Criada em {formatDate(col.createdAt)} • {col._count?.events || 0} eventos válidos
                      {col.location && ` • ${col.location}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {col.status === 'IN_PROGRESS' || col.status === 'PAUSED' ? (
                      <Link to={`/coletas/${col.id}/operacao`}>
                        <Button variant="success" size="sm" className="gap-1.5 font-bold">
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Operar</span>
                        </Button>
                      </Link>
                    ) : (
                      <Link to={`/coletas/${col.id}`}>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <span>Ver Análise</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumo da Última Coleta Encerrada */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-800">Última Sessão Encerrada</h2>
          {lastFinished ? (
            <Card className="space-y-4">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">Título da Coleta</span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{lastFinished.collection.title}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Tempo Operacional: {lastFinished.metrics.timeMetrics.operationalDurationMinutes} min
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 font-medium">Entregas</span>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {lastFinished.metrics.overallThroughput.totalDeliveries}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 font-medium">Throughput (X)</span>
                  <div className="text-base font-black text-blue-900 mt-0.5">
                    {lastFinished.metrics.overallThroughput.deliveriesPerMinute ?? '—'} <span className="text-[10px] font-normal text-slate-500">/m</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700 block mb-2">Desempenho por Atendente</span>
                <div className="space-y-1.5 text-xs">
                  {lastFinished.metrics.attendantsMetrics.map((att: any) => (
                    <div key={att.attendantId} className="flex items-center justify-between p-1.5 bg-slate-50 rounded">
                      <span className="font-semibold text-slate-800">[{att.code}] {att.displayName}</span>
                      <span className="font-bold text-slate-900">{att.deliveriesCount} entregas ({att.percentOfTotalDeliveries}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link to={`/coletas/${lastFinished.collection.id}`} className="block w-full">
                <Button variant="outline" size="sm" className="w-full text-blue-700">
                  Relatório Completo
                </Button>
              </Link>
            </Card>
          ) : (
            <Card className="text-center py-8 text-xs text-slate-400">
              Nenhuma coleta finalizada disponível para exibir resumo comparativo.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
