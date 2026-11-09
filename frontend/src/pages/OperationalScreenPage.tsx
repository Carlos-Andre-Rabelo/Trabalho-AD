import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collectionsApi, Collection } from '../api/collections.js';
import { eventsApi, EventItem } from '../api/events.js';
import { servicesApi } from '../api/servicesApi.js';
import { OperationalTimer } from '../components/operational/OperationalTimer.js';
import { AttendantCard } from '../components/operational/AttendantCard.js';
import { ArrivalButton } from '../components/operational/ArrivalButton.js';
import { EventLogQuickView } from '../components/operational/EventLogQuickView.js';
import { QrCodeSyncModal } from '../components/operational/QrCodeSyncModal.js';
import { useCollectionSync } from '../hooks/useCollectionSync.js';
import { Button } from '../components/common/Button.js';
import { useConnectivity } from '../context/ConnectivityContext.js';
import { enqueueOfflineEvent } from '../api/offlineQueue.js';
import { metricsApi } from '../api/metrics.js';
import { BarChart3, QrCode, FileSpreadsheet } from 'lucide-react';

export const OperationalScreenPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOnline } = useConnectivity();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [recentEvents, setRecentEvents] = useState<EventItem[]>([]);
  const [activeServices, setActiveServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const [deliveriesByAttendant, setDeliveriesByAttendant] = useState<Record<string, number>>({});
  const [totalArrivals, setTotalArrivals] = useState(0);

  // Deduplicação de eventos entre resposta HTTP local e broadcast SSE
  const processedEventIds = useRef<Set<string>>(new Set());
  const voidedEventIds = useRef<Set<string>>(new Set());

  const applyEventCreated = useCallback((newEvent: EventItem) => {
    setRecentEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)].slice(0, 10));
    if (processedEventIds.current.has(newEvent.id)) return;
    processedEventIds.current.add(newEvent.id);

    if (!newEvent.isVoided) {
      if (newEvent.eventType === 'ARRIVAL') {
        setTotalArrivals((prev) => prev + 1);
      } else if (newEvent.eventType === 'DELIVERY' && newEvent.attendantId) {
        setDeliveriesByAttendant((prev) => ({
          ...prev,
          [newEvent.attendantId!]: (prev[newEvent.attendantId!] || 0) + 1,
        }));
      }
    }
  }, []);

  const applyEventVoided = useCallback((voidedEvent: EventItem) => {
    setRecentEvents((prev) =>
      prev.map((e) => (e.id === voidedEvent.id ? { ...e, isVoided: true } : e))
    );
    if (voidedEventIds.current.has(voidedEvent.id)) return;
    voidedEventIds.current.add(voidedEvent.id);

    if (voidedEvent.eventType === 'ARRIVAL') {
      setTotalArrivals((prev) => Math.max(0, prev - 1));
    } else if (voidedEvent.eventType === 'DELIVERY' && voidedEvent.attendantId) {
      setDeliveriesByAttendant((prev) => ({
        ...prev,
        [voidedEvent.attendantId!]: Math.max(0, (prev[voidedEvent.attendantId!] || 1) - 1),
      }));
    }
  }, []);

  const { connectedClients } = useCollectionSync({
    collectionId: id,
    onEventCreated: applyEventCreated,
    onEventVoided: applyEventVoided,
    onStatusChanged: (col) => {
      setCollection((prev) => (prev ? { ...prev, status: col.status } : col));
    },
    onServiceStarted: (interval) => {
      setActiveServices((prev) => {
        if (prev.some((s) => s.attendantId === interval.attendantId)) return prev;
        return [...prev, interval];
      });
    },
    onServiceFinished: ({ interval, event }) => {
      setActiveServices((prev) => prev.filter((s) => s.attendantId !== interval.attendantId));
      if (event) {
        applyEventCreated(event);
      }
    },
    onServiceCancelled: ({ attendantId }) => {
      setActiveServices((prev) => prev.filter((s) => s.attendantId !== attendantId));
    },
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [colData, recent, active] = await Promise.all([
        collectionsApi.getById(id),
        eventsApi.recent(id),
        servicesApi.getActiveServices(id),
      ]);

      setCollection(colData);
      setRecentEvents(recent);
      setActiveServices(active);

      recent.forEach((e) => {
        processedEventIds.current.add(e.id);
        if (e.isVoided) voidedEventIds.current.add(e.id);
      });

      const deliveriesCount: Record<string, number> = {};
      colData.attendants.forEach((a) => {
        deliveriesCount[a.id] = colData.eventCounts?.deliveriesByAttendant?.[a.id] ?? 0;
      });

      if (colData.eventCounts) {
        setDeliveriesByAttendant(deliveriesCount);
        setTotalArrivals(colData.eventCounts.arrivals);
      } else {
        let arrivalsCount = 0;
        recent.forEach((e) => {
          if (!e.isVoided) {
            if (e.eventType === 'DELIVERY' && e.attendantId) {
              deliveriesCount[e.attendantId] = (deliveriesCount[e.attendantId] || 0) + 1;
            } else if (e.eventType === 'ARRIVAL') {
              arrivalsCount++;
            }
          }
        });
        setDeliveriesByAttendant(deliveriesCount);
        setTotalArrivals(arrivalsCount);
      }
    } catch (e) {
      console.error('Erro ao carregar dados operacionais da coleta', e);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await collectionsApi.start(id);
      setCollection(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await collectionsApi.pause(id);
      setCollection(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await collectionsApi.resume(id);
      setCollection(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinishCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await collectionsApi.finish(id);
      setCollection(updated);
      navigate(`/coletas/${id}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await collectionsApi.reopen(id, 'Reaberta pelo aferidor');
      setCollection(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterArrival = async (queueId?: string) => {
    if (!id) return;
    const idempotencyKey = `arr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    if (!isOnline) {
      enqueueOfflineEvent({
        id: idempotencyKey,
        collectionId: id,
        eventType: 'ARRIVAL',
        queueId,
        occurredAt: nowIso,
      });
      setTotalArrivals((prev) => prev + 1);
      return;
    }

    try {
      const newEvent = await eventsApi.create(id, {
        eventType: 'ARRIVAL',
        queueId,
        idempotencyKey,
        occurredAt: nowIso,
      });
      applyEventCreated(newEvent);
    } catch (e) {
      console.error('Falha ao registrar chegada:', e);
    }
  };

  const handleStartService = async (attendantId: string) => {
    if (!id) return;
    try {
      const interval = await servicesApi.startService(id, { attendantId });
      setActiveServices((prev) => {
        if (prev.some((s) => s.attendantId === attendantId)) return prev;
        return [...prev, interval];
      });
    } catch (e: any) {
      alert(e?.message || 'Falha ao iniciar atendimento.');
    }
  };

  const handleFinishService = async (attendantId: string, serviceId?: string) => {
    if (!id) return;
    const idempotencyKey = `del-${attendantId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const result = await servicesApi.finishService(id, {
        attendantId,
        serviceIntervalId: serviceId,
        idempotencyKey,
      });

      setActiveServices((prev) => prev.filter((s) => s.attendantId !== attendantId));
      if (result.event) {
        applyEventCreated(result.event);
      }
    } catch (e: any) {
      alert(e?.message || 'Falha ao concluir atendimento.');
    }
  };

  const handleVoidEvent = async (eventId: string, reason: string) => {
    if (!id) return;
    try {
      const updated = await eventsApi.void(id, eventId, reason);
      applyEventVoided(updated);
    } catch (e: any) {
      alert(e?.message || 'Falha ao anular evento.');
    }
  };

  if (isLoading || !collection) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
        Carregando...
      </div>
    );
  }

  const isCollectionActive = collection.status === 'IN_PROGRESS';

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      <OperationalTimer
        collection={collection}
        onStart={handleStartCollection}
        onPause={handlePauseCollection}
        onResume={handleResumeCollection}
        onFinish={handleFinishCollection}
        onReopen={handleReopenCollection}
        onCollectionUpdated={(updated) => setCollection(updated)}
        isActionLoading={actionLoading}
      />

      {/* Barra de Ações Rápidas */}
      <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
        <span className="text-xs font-semibold text-slate-600">
          Aferição em Tempo Real
        </span>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsQrModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            <span>QR Celular</span>
            {connectedClients > 1 && (
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                {connectedClients}
              </span>
            )}
          </Button>

          {id && (
            <a href={metricsApi.getExcelUrl(id)} download>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                title="Baixar planilha Excel com todos os dados"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </Button>
            </a>
          )}

          <Link to={`/coletas/${id}`}>
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Resultados</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Botão de Chegada */}
      <ArrivalButton
        totalArrivals={totalArrivals}
        onRegisterArrival={handleRegisterArrival}
        isCollectionActive={isCollectionActive}
        queues={collection.queues}
      />

      {/* Cartões dos Atendentes com Estados Iniciar e Finalizou Atendimento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {collection.attendants.map((att) => {
          const activeForAtt = activeServices.find((s) => s.attendantId === att.id);
          const count = deliveriesByAttendant[att.id] || 0;

          return (
            <AttendantCard
              key={att.id}
              attendant={att}
              deliveriesCount={count}
              activeService={activeForAtt}
              onStartService={handleStartService}
              onFinishService={handleFinishService}
              isCollectionActive={isCollectionActive}
            />
          );
        })}
      </div>

      {/* Registro Rápido e Desfazer em Retângulos de Atendimento */}
      <EventLogQuickView
        events={recentEvents}
        onVoidEvent={handleVoidEvent}
        isCollectionActive={isCollectionActive}
      />

      {id && (
        <QrCodeSyncModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          collectionId={id}
          collectionTitle={collection.title}
          connectedClientsCount={connectedClients}
        />
      )}
    </div>
  );
};
