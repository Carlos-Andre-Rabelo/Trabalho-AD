import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { metricsApi } from '../api/metrics.js';
import { StatCard } from '../components/common/StatCard.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { Badge } from '../components/common/Badge.js';
import { formatDate, formatNumber } from '../utils/formatters.js';
import { Play, PlusCircle, ArrowRight } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    metricsApi
      .getDashboard()
      .then(setData)
      .catch((e) => console.error('Falha ao carregar dashboard', e))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
        Carregando...
      </div>
    );
  }

  const activeCollection = data?.inProgressCollections?.[0];
  const lastFinished = data?.lastFinishedMetrics;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-slate-900">Visão Geral</h1>

        {activeCollection ? (
          <Link to={`/coletas/${activeCollection.id}/operacao`}>
            <Button variant="success" size="sm" className="gap-1.5 font-semibold">
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Retomar Coleta</span>
            </Button>
          </Link>
        ) : (
          <Link to="/coletas/nova">
            <Button variant="primary" size="sm" className="gap-1.5 font-semibold">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Nova Coleta</span>
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Coletas" value={data?.totalCollections || 0} />
        <StatCard
          label="Ativas"
          value={data?.inProgressCount || 0}
          highlight={data?.inProgressCount > 0}
        />
        <StatCard label="Entregas" value={data?.totalDeliveries || 0} />
        <StatCard
          label="Throughput Médio"
          value={
            lastFinished?.metrics?.overallThroughput?.deliveriesPerMinute
              ? formatNumber(lastFinished.metrics.overallThroughput.deliveriesPerMinute, 2)
              : null
          }
          unit="/min"
        />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase text-slate-500">Coletas Recentes</h2>
          <Link to="/coletas" className="text-xs font-medium text-blue-600 hover:underline">
            Ver todas
          </Link>
        </div>

        {data?.recentCollections?.length === 0 ? (
          <Card className="text-center py-10">
            <div className="text-xs text-slate-500 mb-3">Nenhuma coleta registrada.</div>
            <Link to="/coletas/nova">
              <Button variant="primary" size="sm">
                Nova Coleta
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {data?.recentCollections?.map((col: any) => (
              <div
                key={col.id}
                className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{col.title}</span>
                    <Badge status={col.status} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {col.owner?.name || 'Aferidor'} • {formatDate(col.createdAt)} • {col._count?.events || 0} eventos
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {col.status === 'IN_PROGRESS' || col.status === 'PAUSED' ? (
                    <Link to={`/coletas/${col.id}/operacao`}>
                      <Button variant="success" size="sm" className="gap-1.5">
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Operar</span>
                      </Button>
                    </Link>
                  ) : (
                    <Link to={`/coletas/${col.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <span>Resultados</span>
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
    </div>
  );
};
