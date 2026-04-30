import { SignOutButton, useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { fetchHealth, fetchMe } from '@/lib/api';

// Page d'accueil minimale J1 : vérifie que l'API répond, l'auth est OK,
// et l'allowlist accepte l'utilisateur. Le pipeline d'analyse arrive en J2.
export function Home() {
  const { getToken } = useAuth();

  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 1,
  });

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Pas de token de session disponible');
      return fetchMe(token);
    },
    retry: 1,
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Konsole</h1>
          <p className="text-sm text-muted-foreground">
            Cas pratique Youno · bootstrap J1. Le pipeline d'analyse d'URL arrive en J2.
          </p>
        </header>

        <section className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">État de l'API</span>
            {health.data && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {health.data.status}
              </span>
            )}
            {health.isError && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                indisponible
              </span>
            )}
            {health.isLoading && (
              <span className="text-xs text-muted-foreground">vérification…</span>
            )}
          </div>
          {health.data && (
            <dl className="text-sm space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <dt>uptime</dt>
                <dd className="font-mono">{health.data.uptime.toFixed(1)}s</dd>
              </div>
            </dl>
          )}
          {health.isError && (
            <p className="text-xs text-destructive">{(health.error as Error).message}</p>
          )}
        </section>

        <section className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Session authentifiée</span>
            {me.data && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                allowlist
              </span>
            )}
          </div>
          {me.isLoading && <p className="text-xs text-muted-foreground">vérification du token…</p>}
          {me.data && (
            <dl className="text-sm space-y-1 text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>email</dt>
                <dd className="font-mono text-xs truncate">{me.data.email}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>userId</dt>
                <dd className="font-mono text-xs truncate">{me.data.userId}</dd>
              </div>
            </dl>
          )}
          {me.isError && <p className="text-xs text-destructive">{(me.error as Error).message}</p>}
          <SignOutButton>
            <Button size="sm" variant="outline">
              Se déconnecter
            </Button>
          </SignOutButton>
        </section>
      </div>
    </div>
  );
}
