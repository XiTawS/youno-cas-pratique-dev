import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { fetchHealth } from '@/lib/api';

// Page d'accueil minimale J1 : vérifie que l'API répond et affiche son état.
// Le pipeline d'analyse arrive en J2.
export function Home() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
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
            {data && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {data.status}
              </span>
            )}
            {isError && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                indisponible
              </span>
            )}
            {isLoading && <span className="text-xs text-muted-foreground">vérification…</span>}
          </div>

          {data && (
            <dl className="text-sm space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <dt>uptime</dt>
                <dd className="font-mono">{data.uptime.toFixed(1)}s</dd>
              </div>
              <div className="flex justify-between">
                <dt>timestamp</dt>
                <dd className="font-mono text-xs">
                  {new Date(data.timestamp).toLocaleString('fr-FR')}
                </dd>
              </div>
            </dl>
          )}

          {isError && <p className="text-xs text-destructive">{(error as Error).message}</p>}

          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Vérification…' : 'Re-vérifier'}
          </Button>
        </section>
      </div>
    </div>
  );
}
