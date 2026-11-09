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
  const [selectedFocus, setSelectedFocus] = useState<string>(() => {
    if (!id || typeof window === 'undefined') return 'all';
    return localStorage.getItem(`ru_web_focus_${id}`) || 'all';
  });

  const handleFocusChange = (newFocus: string) => {
    setSelectedFocus(newFocus);
    if (id && typeof window !== 'undefined') {
      localStorage.setItem(`ru_web_focus_${id}`, newFocus);
    }
  };

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

      {/* Seletor de Abas de Aferição Específica (Foco: Todos / Chegadas / Por Atendente) */}
      <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs shadow-sm">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 shrink-0">
          Aferir:
        </span>

        <button
          type="button"
          onClick={() => handleFocusChange('all')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            selectedFocus === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span>Todos</span>
        </button>

        <button
          type="button"
          onClick={() => handleFocusChange('arrivals')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            selectedFocus === 'arrivals'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${selectedFocus === 'arrivals' ? 'bg-white' : 'bg-blue-500'}`} />
          <span>Chegadas</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
              selectedFocus === 'arrivals' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {totalArrivals}
          </span>
        </button>

        {collection.attendants.map((att) => {
          const count = deliveriesByAttendant[att.id] || 0;
          const isBusy = !!activeServicesByAttendant[att.id];
          const isSelected = selectedFocus === att.id;

          return (
            <button
              key={att.id}
              type="button"
              onClick={() => handleFocusChange(att.id)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isBusy
                    ? 'bg-amber-400 animate-pulse'
                    : isSelected
                    ? 'bg-white'
                    : 'bg-emerald-500'
                }`}
              />
              <span>{att.displayName}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Banner Informativo quando um foco específico estiver ativo */}
      {selectedFocus !== 'all' && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-medium">
            <span>Modo de Aferição Específica:</span>
            <strong className="text-slate-900">
              {selectedFocus === 'arrivals'
                ? 'Apenas Chegadas'
                : collection.attendants.find((a) => a.id === selectedFocus)?.displayName || 'Atendente Selecionado'}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => handleFocusChange('all')}
            className="text-blue-600 hover:text-blue-800 font-semibold underline text-[11px]"
          >
            Ver todos os botões
          </button>
        </div>
      )}

      {/* Botão de Chegada Instantâneo (exibido apenas em 'all' ou 'arrivals') */}
      {(selectedFocus === 'all' || selectedFocus === 'arrivals') && (
        <ArrivalButton
          totalArrivals={totalArrivals}
          onRegisterArrival={(queueId) => registerArrival(queueId)}
          isCollectionActive={isCollectionActive}
          queues={collection.queues}
        />
      )}

      {/* Cartões dos Atendentes (exibidos em 'all' ou filtrados para o atendente específico) */}
      {selectedFocus !== 'arrivals' && (
        <div
          className={
            selectedFocus === 'all'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
              : 'max-w-2xl mx-auto w-full'
          }
        >
          {collection.attendants
            .filter((att) => selectedFocus === 'all' || selectedFocus === att.id)
            .map((att) => {
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
      )}

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
