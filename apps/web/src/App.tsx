import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NewAnalysisDialog } from '@/components/NewAnalysisDialog';
import { RequireAuth } from '@/components/RequireAuth';
import { Analysis } from '@/pages/Analysis';
import { History } from '@/pages/History';
import { Home } from '@/pages/Home';
import { SignIn } from '@/pages/SignIn';

// QueryClient unique pour toute l'app.
// /api/analyze ne doit jamais retry sur erreur - écrasement de credits Firecrawl.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Routes + état global du dialog "nouvelle analyse" (déclenchable depuis la sidebar).
function AppRoutes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = () => setDialogOpen(true);

  return (
    <>
      <Routes>
        {/* /sign-in/* hors AppShell (pas de sidebar avant login) */}
        <Route path="/sign-in/*" element={<SignIn />} />

        {/* Routes auth wrappées dans le shell + RequireAuth */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Shell onNewAnalysis={openDialog}>
                <Home onNewAnalysis={openDialog} />
              </Shell>
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <Shell onNewAnalysis={openDialog}>
                <History />
              </Shell>
            </RequireAuth>
          }
        />
        <Route
          path="/analysis/:id"
          element={
            <RequireAuth>
              <Shell onNewAnalysis={openDialog}>
                <Analysis />
              </Shell>
            </RequireAuth>
          }
        />
      </Routes>

      <NewAnalysisDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

// Wrapper Shell qui ne s'applique pas en mode signin (utilisé via routing).
function Shell({ children, onNewAnalysis }: { children: ReactNode; onNewAnalysis: () => void }) {
  const location = useLocation();
  if (location.pathname.startsWith('/sign-in')) return <>{children}</>;
  return <AppShell onNewAnalysis={onNewAnalysis}>{children}</AppShell>;
}
