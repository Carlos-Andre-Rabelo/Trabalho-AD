import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collectionsApi, Collection } from '../api/collections.js';
import { eventsApi, EventItem } from '../api/events.js';
import { servicesApi } from '../api/servicesApi.js';
import { OperationalTimer } from '../components/operational/OperationalTimer.js';
import { AttendantCard } from '../components/operational/AttendantCard.js';
import { ArrivalButton } from '../components/operational/ArrivalButton.js';
import { EventLogQuickView } from '../components/operational/EventLogQuickView.js';
import { InterruptionModal } from '../components/operational/InterruptionModal.js';
import { Button } from '../components/common/Button.js';
import { Modal } from '../components/common/Modal.js';
import { useConnectivity } from '../context/ConnectivityContext.js';
import { enqueueOfflineEvent } from '../api/offlineQueue.js';
import {
  Play,
  Pause,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  Clock,
  Zap,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const OperationalScreenPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOnline } = useConnectivity();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [recentEvents, setRecentEvents] = useState<EventItem[]>([]);
  const [activeServices, setActiveServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isTimedMode, setIsTimedMode] = useState(false);

  // Modais
  const [isInterruptionModalOpen, setIsInterruptionModalOpen] = useState(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);
  const [isPauseConfirmOpen, setIsPauseConfirmOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Contagens locais rápidas
  const [deliveriesByAttendant, setDeliveriesByAttendant] = useState<Record<string, number>>({});
  const [totalArrivals, setTotalArrivals] = useState(0);

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

      // Calcular contagens a partir dos eventos
      const deliveriesCount: Record<string, number> = {};
      colData.attendants.forEach((a) => (deliveriesCount[a.id] = 0));
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

      // Se temos o count consolidado da API
      if (colData._count?.events) {
        // Se a API traz mais eventos no total
      }

      setDeliveriesByAttendant(deliveriesCount);
      setTotalArrivals(arrivalsCount);
    } catch (e) {
      console.error('Erro ao carregar dados operacionais da coleta', e);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
    // Polling inteligente leve a cada 10s para manter dispositivos sincronizados
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [loadData]);

  // Ações de Estado da Coleta
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

  const handlePauseConfirm = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await collectionsApi.pause(id, pauseReason.trim() || undefined);
      setCollection(updated);
      setIsPauseConfirmOpen(false);
      setPauseReason('');
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

  const handleFinishConfirm = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await collectionsApi.finish(id);
      setCollection(updated);
      setIsFinishConfirmOpen(false);
      navigate(`/coletas/${id}`); // Vai para análise detalhada
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenConfirm = async () => {
    if (!id || !reopenReason.trim()) return;
    setActionLoading(true);
    try {
      const updated = await collectionsApi.reopen(id, reopenReason.trim());
      setCollection(updated);
      setIsReopenModalOpen(false);
      setReopenReason('');
    } finally {
      setActionLoading(false);
    }
  };

  // Registro de Chegada
  const handleRegisterArrival = async (queueId?: string) => {
    if (!id) return;
    const idempotencyKey = `arr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    if (!isOnline) {
      // Salva na fila local offline
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
      setTotalArrivals((prev) => prev + 1);
      setRecentEvents((prev) => [newEvent, ...prev.slice(0, 9)]);
    } catch (e: any) {
      console.error('Falha ao registrar chegada:', e);
    }
  };

  // Registro de Entrega Rápida (Modo Rápido)
  const handleQuickDelivery = async (attendantId: string) => {
    if (!id) return;
    const idempotencyKey = `del-${attendantId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    if (!isOnline) {
      enqueueOfflineEvent({
        id: idempotencyKey,
        collectionId: id,
        eventType: 'DELIVERY',
        attendantId,
        occurredAt: nowIso,
      });
      setDeliveriesByAttendant((prev) => ({
        ...prev,
        [attendantId]: (prev[attendantId] || 0) + 1,
      }));
      return;
    }

    try {
      const newEvent = await eventsApi.create(id, {
        eventType: 'DELIVERY',
        attendantId,
        idempotencyKey,
        occurredAt: nowIso,
      });

      setDeliveriesByAttendant((prev) => ({
        ...prev,
        [attendantId]: (prev[attendantId] || 0) + 1,
      }));
      setRecentEvents((prev) => [newEvent, ...prev.slice(0, 9)]);
    } catch (e: any) {
      console.error('Falha ao registrar entrega:', e);
    }
  };

  // Registro de Início de Atendimento Cronometrado
  const handleStartTimedService = async (attendantId: string) => {
    if (!id) return;
    try {
      const interval = await servicesApi.startService(id, { attendantId });
      setActiveServices((prev) => [...prev, interval]);
    } catch (e: any) {
      alert(e?.message || 'Falha ao iniciar cronômetro do atendimento.');
    }
  };

  // Conclusão de Atendimento Cronometrado
  const handleFinishTimedService = async (
    attendantId: string,
    serviceId?: string,
    proteinAmount?: number
  ) => {
    if (!id) return;
    const idempotencyKey = `timed-del-${attendantId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const result = await servicesApi.finishService(id, {
        attendantId,
        serviceIntervalId: serviceId,
        idempotencyKey,
        proteinAmount,
      });

      // Remove do array de ativos
      setActiveServices((prev) => prev.filter((s) => s.attendantId !== attendantId));
      setDeliveriesByAttendant((prev) => ({
        ...prev,
        [attendantId]: (prev[attendantId] || 0) + 1,
      }));
      if (result.event) {
        setRecentEvents((prev) => [result.event, ...prev.slice(0, 9)]);
      }
    } catch (e: any) {
      alert(e?.message || 'Falha ao concluir atendimento cronometrado.');
    }
  };

  // Anular Evento
  const handleVoidEvent = async (eventId: string, reason: string) => {
    if (!id) return;
    try {
      const updated = await eventsApi.void(id, eventId, reason);
      setRecentEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
      // Atualiza contagens
      if (updated.eventType === 'DELIVERY' && updated.attendantId) {
        setDeliveriesByAttendant((prev) => ({
          ...prev,
          [updated.attendantId!]: Math.max(0, (prev[updated.attendantId!] || 1) - 1),
        }));
      } else if (updated.eventType === 'ARRIVAL') {
        setTotalArrivals((prev) => Math.max(0, prev - 1));
      }
    } catch (e: any) {
      alert(e?.message || 'Falha ao anular evento.');
    }
  };

  // Registrar Ocorrência
  const handleCreateInterruption = async (data: any) => {
    if (!id) return;
    await servicesApi.createInterruption(id, data);
  };

  if (isLoading || !collection) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Carregando console operacional...
      </div>
    );
  }

  const isCollectionActive = collection.status === 'IN_PROGRESS';

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Barra de Cronômetro e Estado Superior */}
      <OperationalTimer
        collection={collection}
        onPause={() => setIsPauseConfirmOpen(true)}
        onResume={handleResumeCollection}
        onFinish={() => setIsFinishConfirmOpen(true)}
        onReopen={() => setIsReopenModalOpen(true)}
        isActionLoading={actionLoading}
      />

      {/* Se Coleta estiver em Rascunho, botão de iniciar */}
      {collection.status === 'DRAFT' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center space-y-3">
          <div className="text-sm font-bold text-blue-950">
            Esta coleta está em Rascunho. O cronômetro e os botões de registro ainda não foram iniciados.
          </div>
          <p className="text-xs text-blue-800 max-w-md mx-auto">
            Assim que você estiver posicionado em frente à bancada de distribuição de proteína, clique
            no botão abaixo para iniciar o registro oficial.
          </p>
          <Button
            variant="success"
            size="lg"
            onClick={handleStartCollection}
            isLoading={actionLoading}
            className="font-bold text-base px-8 shadow-md"
          >
            <Play className="w-5 h-5 fill-current mr-2" />
            Iniciar Aferição da Coleta
          </Button>
        </div>
      )}

      {/* Se Coleta estiver Pausada, aviso claro */}
      {collection.status === 'PAUSED' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>
              <strong>Coleta Pausada:</strong> O tempo de pausa é descontado dos cálculos de Throughput e
              taxas operacionais. Clique em <strong>Retomar</strong> para continuar registrando.
            </span>
          </div>
          <Button variant="success" size="sm" onClick={handleResumeCollection} className="gap-1 font-bold">
            <Play className="w-3.5 h-3.5 fill-current" /> Retomar
          </Button>
        </div>
      )}

      {/* Alternância de Modo (Rápido vs Cronometrado) & Ações Complementares */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Modo de Coleta:</span>
          <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setIsTimedMode(false)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                !isTimedMode
                  ? 'bg-white text-blue-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Modo Rápido (1 clique)</span>
            </button>
            <button
              onClick={() => setIsTimedMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                isTimedMode
                  ? 'bg-white text-blue-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Modo Cronometrado</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsInterruptionModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Registrar Ocorrência</span>
          </Button>

          <Link to={`/coletas/${id}`}>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 text-blue-700">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Ver Gráficos</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Cartões dos Atendentes (2 Atendentes Inicialmente ou Mais) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collection.attendants.map((att) => {
          const activeForAtt = activeServices.find((s) => s.attendantId === att.id);
          const count = deliveriesByAttendant[att.id] || 0;

          return (
            <AttendantCard
              key={att.id}
              attendant={att}
              deliveriesCount={count}
              throughputPerMinute={null}
              meanServiceSeconds={null}
              isTimedMode={isTimedMode}
              activeService={activeForAtt}
              onQuickDelivery={handleQuickDelivery}
              onStartTimedService={handleStartTimedService}
              onFinishTimedService={handleFinishTimedService}
              isCollectionActive={isCollectionActive}
            />
          );
        })}
      </div>

      {/* Botão de Chegada Separado */}
      <ArrivalButton
        totalArrivals={totalArrivals}
        arrivalRatePerMinute={null}
        onRegisterArrival={handleRegisterArrival}
        isCollectionActive={isCollectionActive}
        queues={collection.queues}
      />

      {/* Registro Rápido e Desfazer */}
      <EventLogQuickView
        events={recentEvents}
        onVoidEvent={handleVoidEvent}
        isCollectionActive={isCollectionActive}
      />

      {/* Modal de Confirmação de Encerramento */}
      <Modal
        isOpen={isFinishConfirmOpen}
        onClose={() => setIsFinishConfirmOpen(false)}
        title="Encerrar Sessão de Coleta"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Ao encerrar a coleta, o cronômetro oficial será finalizado e os cálculos finais de Throughput,
            tempo médio de serviço e Teoria das Filas serão consolidados no banco SQL.
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-medium">
            Você será redirecionado para o painel analítico com gráficos, comparação e exportação CSV.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsFinishConfirmOpen(false)}>
              Voltar à Coleta
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleFinishConfirm}
              isLoading={actionLoading}
              className="font-bold"
            >
              Confirmar e Encerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Pausa com Motivo */}
      <Modal
        isOpen={isPauseConfirmOpen}
        onClose={() => setIsPauseConfirmOpen(false)}
        title="Pausar Coleta Operacional"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Informe o motivo da pausa (ex.: reposição das cubas de proteína ou intervalo operacional).
            Este tempo não será computado como tempo de serviço ativo.
          </p>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Motivo da Pausa</label>
            <input
              type="text"
              placeholder="Ex.: Troca de travessa de carne / reposição de cubas"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700 text-xs"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsPauseConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="outline" size="sm" onClick={handlePauseConfirm} isLoading={actionLoading}>
              Pausar Agora
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Reabertura com Auditoria */}
      <Modal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        title="Reabrir Coleta Encerrada"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            A reabertura de uma coleta encerrada é um evento sensível. Forneça a justificativa acadêmica
            que ficará gravada permanentemente no log de auditoria.
          </p>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Justificativa *</label>
            <input
              type="text"
              placeholder="Ex.: Necessidade de complementar amostragem do mesmo turno..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700 text-xs"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsReopenModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReopenConfirm}
              disabled={!reopenReason.trim()}
              isLoading={actionLoading}
            >
              Reabrir Coleta
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Ocorrências */}
      <InterruptionModal
        isOpen={isInterruptionModalOpen}
        onClose={() => setIsInterruptionModalOpen(false)}
        attendants={collection.attendants}
        onSubmit={handleCreateInterruption}
      />
    </div>
  );
};
