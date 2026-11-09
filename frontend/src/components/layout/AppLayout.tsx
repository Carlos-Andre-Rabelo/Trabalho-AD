import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header.js';
import { useConnectivity } from '../../context/ConnectivityContext.js';
import { WifiOff } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { isOnline, pendingCount } = useConnectivity();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header />

      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 px-4 py-1.5 text-xs font-semibold text-center flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline ({pendingCount} pendente{pendingCount !== 1 ? 's' : ''})</span>
        </div>
      )}

      <main className="flex-1 p-4 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
};
