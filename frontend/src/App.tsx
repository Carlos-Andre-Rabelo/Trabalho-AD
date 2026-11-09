import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.js';

import { DashboardPage } from './pages/DashboardPage.js';
import { CollectionsListPage } from './pages/CollectionsListPage.js';
import { NewCollectionPage } from './pages/NewCollectionPage.js';
import { OperationalScreenPage } from './pages/OperationalScreenPage.js';
import { CollectionDetailsPage } from './pages/CollectionDetailsPage.js';
import { EventHistoryPage } from './pages/EventHistoryPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { RemoteOperationalPage } from './pages/RemoteOperationalPage.js';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/coletas/:id/remoto" element={<RemoteOperationalPage />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />

      <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="coletas" element={<CollectionsListPage />} />
        <Route path="coletas/nova" element={<NewCollectionPage />} />
        <Route path="coletas/:id" element={<CollectionDetailsPage />} />
        <Route path="coletas/:id/operacao" element={<OperationalScreenPage />} />
        <Route path="coletas/:id/eventos" element={<EventHistoryPage />} />
        <Route path="coletas/:id/relatorios" element={<ReportsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
