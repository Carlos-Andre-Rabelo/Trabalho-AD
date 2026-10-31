import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useConnectivity } from '../../context/ConnectivityContext.js';
import { Wifi, WifiOff, RefreshCw, User as UserIcon, Menu } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, title }) => {
  const { user } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useConnectivity();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-blue-950 tracking-tight hidden sm:inline">
            RU Metrics
          </span>
          {title && (
            <>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-sm font-medium text-slate-700 truncate max-w-[200px] sm:max-w-md">
                {title}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Status de Conectividade e Sincronização */}
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              <span>Offline ({pendingCount})</span>
            </div>
          ) : pendingCount > 0 ? (
            <button
              onClick={syncNow}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              title="Clique para sincronizar agora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sincronizar ({pendingCount})</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Conectado</span>
            </div>
          )}
        </div>

        {/* Usuário */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold uppercase shadow-sm">
              {user.name.charAt(0)}
            </div>
            <div className="hidden lg:block text-left text-xs">
              <div className="font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
                {user.name}
              </div>
              <div className="text-slate-400 text-[11px] truncate max-w-[120px]">
                {user.email}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
