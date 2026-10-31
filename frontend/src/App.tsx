import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';

// Pages
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CollectionsListPage } from './pages/CollectionsListPage.js';
import { NewCollectionPage } from './pages/NewCollectionPage.js';
import { OperationalScreenPage } from './pages/OperationalScreenPage.js';
import { CollectionDetailsPage } from './pages/CollectionDetailsPage.js';
import { EventHistoryPage } from './pages/EventHistoryPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ProfilePage } from './pages/ProfilePage.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
        Verificando sessão no RU Metrics...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Rotas Públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Rotas Privadas no Layout Principal */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="coletas" element={<CollectionsListPage />} />
        <Route path="coletas/nova" element={<NewCollectionPage />} />
        <Route path="coletas/:id" element={<CollectionDetailsPage />} />
        <Route path="coletas/:id/operacao" element={<OperationalScreenPage />} />
        <Route path="coletas/:id/eventos" element={<EventHistoryPage />} />
        <Route path="coletas/:id/relatorios" element={<ReportsPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="perfil" element={<ProfilePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
