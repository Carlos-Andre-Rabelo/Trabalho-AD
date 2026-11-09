import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collectionsApi } from '../api/collections.js';
import { OperationalTimer } from '../components/operational/OperationalTimer.js';
import { AttendantCard } from '../components/operational/AttendantCard.js';
import { ArrivalButton } from '../components/operational/ArrivalButton.js';
import { EventLogQuickView } from '../components/operational/EventLogQuickView.js';
import { QrCodeSyncModal } from '../components/operational/QrCodeSyncModal.js';
import { useOperationalLedger } from '../hooks/useOperationalLedger.js';
import { Button } from '../components/common/Button.js';
import { metricsApi } from '../api/metrics.js';
import { BarChart3, QrCode, FileSpreadsheet, AlertCircle } from 'lucide-react';

export const OperationalScreenPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [openDurationSignal, setOpenDurationSignal] = useState(0);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const autoFinishRedirectTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (autoFinishRedirectTimerRef.current) {
        clearTimeout(autoFinishRedirectTimerRef.current);
      }
    };
  }, []);

  const {
    collection,
    setCollection,
    isLoading,
    connectedClients,
    pollNow,
    totalArrivals,
    deliveriesByAttendant,
    activeServicesByAttendant,
    logItems,
    registerArrival,
    startService,
    finishService,
    retryOp,
    dismissOp,
    voidEvent,
    handleTimerExpiredLocally,
  } = useOperationalLedger({
    collectionId: id,
  });

  const handleStartCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const updated = await collectionsApi.start(id);
      setCollection((prev) => (prev ? { ...prev, ...updated } : updated));
      pollNow();
    } catch (e: any) {
      setActionNotice(e?.message || 'Falha ao iniciar coleta.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const updated = await collectionsApi.pause(id);
      setCollection((prev) => (prev ? { ...prev, ...updated } : updated));
      pollNow();
    } catch (e: any) {
      setActionNotice(e?.message || 'Falha ao pausar coleta.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const updated = await collectionsApi.resume(id);
      setCollection((prev) => (prev ? { ...prev, ...updated } : updated));
      pollNow();
    } catch (e: any) {
      setActionNotice(e?.message || 'Falha ao retomar coleta.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinishCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      handleTimerExpiredLocally();
      const updated = await collectionsApi.finish(id);
      setCollection((prev) => (prev ? { ...prev, ...updated } : updated));
      navigate(`/coletas/${id}`);
    } catch (e: any) {
      setActionNotice(e?.message || 'Falha ao encerrar coleta.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTimerExpired = () => {
    if (!id) return;
    handleTimerExpiredLocally();
    collectionsApi.finish(id).catch(() => {});
    if (autoFinishRedirectTimerRef.current) {
      clearTimeout(autoFinishRedirectTimerRef.current);
    }
    autoFinishRedirectTimerRef.current = setTimeout(() => {
      navigate(`/coletas/${id}`);
    }, 3000);
  };

  const handleReopenCollection = async () => {
    if (!id) return;
    setActionLoading(true);
    setActionNotice(null);
    if (autoFinishRedirectTimerRef.current) {
      clearTimeout(autoFinishRedirectTimerRef.current);
      autoFinishRedirectTimerRef.current = null;
    }
    try {
      const updated = await collectionsApi.reopen(id, 'Reaberta pelo aferidor');
      setCollection((prev) => (prev ? { ...prev, ...updated } : updated));
      pollNow();
    } catch (e: any) {
      if (e?.code === 'TIMER_EXPIRED' || e?.status === 409) {
        setActionNotice(
          'O tempo limite já foi atingido. Aumente ou remova o limite de tempo para reabrir a aferição.'
        );
        setOpenDurationSignal((s) => s + 1);
      } else {
        setActionNotice(e?.message || 'Falha ao reabrir coleta.');
      }
    } finally {
      setActionLoading(false);
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
        onTimerExpired={handleTimerExpired}
        onCollectionUpdated={(updated) => {
          setCollection((prev) => (prev ? { ...prev, ...updated } : updated));
          setActionNotice(null);
          pollNow();
        }}
        isActionLoading={actionLoading}
        openDurationSignal={openDurationSignal}
      />

      {actionNotice && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-rose-800 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-rose-700 hover:text-rose-900 font-semibold px-2"
          >
            Fechar
          </button>
        </div>
      )}

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

      {/* Botão de Chegada Instantâneo */}
      <ArrivalButton
        totalArrivals={totalArrivals}
        onRegisterArrival={(queueId) => registerArrival(queueId)}
        isCollectionActive={isCollectionActive}
        queues={collection.queues}
      />

      {/* Cartões dos Atendentes com Estados Derivados Estáveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {collection.attendants.map((att) => {
          const activeForAtt = activeServicesByAttendant[att.id];
          const count = deliveriesByAttendant[att.id] || 0;

          return (
            <AttendantCard
              key={att.id}
              attendant={att}
              deliveriesCount={count}
              activeService={activeForAtt}
              onStartService={startService}
              onFinishService={finishService}
              isCollectionActive={isCollectionActive}
            />
          );
        })}
      </div>

      {/* Mini Log com Status "Registrando..." e Transição Permanente Sem Duplicação */}
      <EventLogQuickView
        items={logItems}
        onVoidItem={voidEvent}
        onRetryItem={retryOp}
        onDismissItem={dismissOp}
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
