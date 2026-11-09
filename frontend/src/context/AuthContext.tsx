import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, User } from '../api/auth.js';

interface AuthContextType {
  user: User | null;
  userName: string;
  setUserName: (name: string) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userName, setUserNameState] = useState<string>(() => {
    return localStorage.getItem('ru_aferidor_name') || 'Aferidor Principal';
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ru_metrics_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      id: 'default-user',
      name: localStorage.getItem('ru_aferidor_name') || 'Aferidor Principal',
      email: 'aferidor@rumetrics.local',
    };
  });

  const [isLoading, setIsLoading] = useState(false);

  const syncNameWithBackend = useCallback(async (name: string) => {
    try {
      const res = await authApi.setName(name);
      localStorage.setItem('ru_metrics_token', res.token);
      localStorage.setItem('ru_metrics_user', JSON.stringify(res.user));
      localStorage.setItem('ru_aferidor_name', res.user.name);
      setUser(res.user);
      setUserNameState(res.user.name);
    } catch (err) {
      // Em modo offline, salva localmente
      const localUser: User = {
        id: 'local-user',
        name,
        email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@rumetrics.local`,
      };
      localStorage.setItem('ru_aferidor_name', name);
      localStorage.setItem('ru_metrics_user', JSON.stringify(localUser));
      setUser(localUser);
      setUserNameState(name);
    }
  }, []);

  const setUserName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await syncNameWithBackend(trimmed);
  };

  useEffect(() => {
    const currentName = localStorage.getItem('ru_aferidor_name') || 'Aferidor Principal';
    syncNameWithBackend(currentName);
  }, [syncNameWithBackend]);

  const login = async (data: any) => {
    if (data?.name) {
      await setUserName(data.name);
    }
  };

  const register = async (data: any) => {
    if (data?.name) {
      await setUserName(data.name);
    }
  };

  const logout = async () => {
    // Apenas redefine para o padrão, sem deslogar forçado
    await setUserName('Aferidor Principal');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userName,
        setUserName,
        isAuthenticated: true,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
