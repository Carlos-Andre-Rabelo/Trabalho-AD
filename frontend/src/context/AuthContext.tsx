import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, User } from '../api/auth.js';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ru_metrics_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ru_metrics_token');
    if (token) {
      authApi
        .getMe()
        .then((fetchedUser) => {
          setUser(fetchedUser);
          localStorage.setItem('ru_metrics_user', JSON.stringify(fetchedUser));
        })
        .catch(() => {
          setUser(null);
          localStorage.removeItem('ru_metrics_token');
          localStorage.removeItem('ru_metrics_user');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (data: { email: string; password: string }) => {
    const res = await authApi.login(data);
    localStorage.setItem('ru_metrics_token', res.token);
    localStorage.setItem('ru_metrics_user', JSON.stringify(res.user));
    setUser(res.user);
  };

  const register = async (data: { name: string; email: string; password: string }) => {
    const res = await authApi.register(data);
    localStorage.setItem('ru_metrics_token', res.token);
    localStorage.setItem('ru_metrics_user', JSON.stringify(res.user));
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {}
    localStorage.removeItem('ru_metrics_token');
    localStorage.removeItem('ru_metrics_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
