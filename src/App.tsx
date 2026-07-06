import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import FahrzeugerfassungPage from '@/pages/FahrzeugerfassungPage';
import FahrzeugerfassungDetailPage from '@/pages/FahrzeugerfassungDetailPage';
import FahrerverwaltungPage from '@/pages/FahrerverwaltungPage';
import FahrerverwaltungDetailPage from '@/pages/FahrerverwaltungDetailPage';
import PublicFormFahrzeugerfassung from '@/pages/public/PublicForm_Fahrzeugerfassung';
import PublicFormFahrerverwaltung from '@/pages/public/PublicForm_Fahrerverwaltung';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a46310ccdac4760b92c73cd" element={<PublicFormFahrzeugerfassung />} />
              <Route path="public/6a46310a1479b5de9937276a" element={<PublicFormFahrerverwaltung />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="fahrzeugerfassung" element={<FahrzeugerfassungPage />} />
                <Route path="fahrzeugerfassung/:id" element={<FahrzeugerfassungDetailPage />} />
                <Route path="fahrerverwaltung" element={<FahrerverwaltungPage />} />
                <Route path="fahrerverwaltung/:id" element={<FahrerverwaltungDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
