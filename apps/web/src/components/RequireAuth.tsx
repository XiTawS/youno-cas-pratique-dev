import { useAuth } from '@clerk/clerk-react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

// Wrapper de routes - redirige vers /sign-in si l'utilisateur n'est pas authentifié.
// Affiche un état de chargement pendant la résolution de la session Clerk côté front.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement de la session…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}
