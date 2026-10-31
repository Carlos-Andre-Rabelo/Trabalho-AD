import React, { createContext, useContext, useState, useEffect } from 'react';
import { getOfflineQueue, flushOfflineQueue } from '../api/offlineQueue.js';

interface ConnectivityContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const updatePending = () => {
    const queue = getOfflineQueue();
    setPendingCount(queue.length);
  };

  const syncNow = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      await flushOfflineQueue();
    } catch (e) {
      console.error('Erro na sincronização offline:', e);
    } finally {
      updatePending();
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    updatePending();

    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Checagem periódica a cada 15 segundos se houver pendentes
    const interval = setInterval(() => {
      updatePending();
      if (navigator.onLine && getOfflineQueue().length > 0) {
        syncNow();
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <ConnectivityContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        syncNow,
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
};

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity deve ser utilizado dentro de ConnectivityProvider');
  }
  return context;
}
