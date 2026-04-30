import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchHistory } from '@/lib/api';

// Liste paginée (50 derniers) des analyses du user connecté.
// Cliquer sur une row redirige vers /analysis/:id.
export function History() {
  const { getToken } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Pas de session active');
      return fetchHistory(token);
    },
  });

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Nouvelle analyse
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Historique</h1>
          <p className="text-sm text-muted-foreground">
            Vos 50 dernières analyses, plus récentes en premier.
          </p>
        </header>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                {(error as Error | undefined)?.message ?? 'Erreur inconnue'}
              </p>
            </CardContent>
          </Card>
        )}

        {data && data.items.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pas encore d'analyse</CardTitle>
              <CardDescription>Lance ta première analyse depuis la page d'accueil.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {data && data.items.length > 0 && (
          <div className="space-y-2">
            {data.items.map((item) => (
              <Link
                key={item.id}
                to={item.status === 'success' ? `/analysis/${item.id}` : '#'}
                className={`block ${item.status !== 'success' ? 'pointer-events-none' : ''}`}
              >
                <Card className="hover:bg-accent/40 transition-colors">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{item.domain}</span>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {new Date(item.createdAt).toLocaleString('fr-FR')}
                        {item.status === 'error' && item.errorMessage && (
                          <> · {item.errorMessage.slice(0, 80)}</>
                        )}
                      </div>
                    </div>
                    {item.status === 'success' && item.scoreMaturity !== null && (
                      <ScorePill score={item.scoreMaturity} />
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'pending' | 'success' | 'error' }) {
  if (status === 'success') return <Badge variant="success">success</Badge>;
  if (status === 'error') return <Badge variant="destructive">error</Badge>;
  return <Badge variant="outline">pending</Badge>;
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <div className="text-right shrink-0">
      <div className={`text-2xl font-bold ${color}`}>{score}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">/100</div>
    </div>
  );
}
