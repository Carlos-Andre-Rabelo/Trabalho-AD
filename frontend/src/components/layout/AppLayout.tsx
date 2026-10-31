import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';
import { useConnectivity } from '../../context/ConnectivityContext.js';
import { WifiOff } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isOnline, pendingCount } = useConnectivity();
  const location = useLocation();

  // Se estiver na tela de operação, o layout é otimizado para foco máximo no mobile
  const isOperationalScreen = location.pathname.includes('/operacao');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="md:pl-64 flex flex-col flex-1">
        <Header onToggleSidebar={() => setSidebarOpen(true)} />

        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-semibold text-center flex items-center justify-center gap-2 shadow-sm">
            <WifiOff className="w-4 h-4" />
            <span>
              Você está desconectado. Os eventos registrados serão salvos localmente ({pendingCount} pendente
              {pendingCount !== 1 ? 's' : ''}) e sincronizados automaticamente ao reconectar.
            </span>
          </div>
        )}

        <main className={`flex-1 ${isOperationalScreen ? 'p-2 sm:p-4' : 'p-4 sm:p-6 lg:p-8'} max-w-7xl w-full mx-auto pb-safe`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
