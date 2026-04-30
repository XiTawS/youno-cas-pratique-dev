import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Analysis } from '@/pages/Analysis';
import { Home } from '@/pages/Home';
import { SignIn } from '@/pages/SignIn';

// QueryClient unique pour toute l'app.
// Defaults conservateurs : 1 retry, staleTime 30s pour éviter les refetch superflus.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/analysis/:id" element={<Analysis />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
