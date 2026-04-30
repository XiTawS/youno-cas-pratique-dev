import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import type { AnalysisStatus } from '@youno/shared/schemas/signals';
import { Activity, Eye, Flame, Sparkles, Sprout } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchHistory } from '@/lib/api';

// Page d'accueil = vue Dashboard.
// Stats par statut + dernières analyses + CTA pour nouvelle analyse.
// Le bouton "Nouvelle analyse" est dans la sidebar (AppShell), pas ici.
interface HomeProps {
  onNewAnalysis: () => void;
}

export function Home({ onNewAnalysis }: HomeProps) {
  const { getToken } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Pas de session active');
      return fetchHistory(token);
    },
  });

  // Stats calculées côté front depuis la liste des 50 dernières.
  // Pour le scope cas pratique (peu d'analyses), pas besoin d'endpoint dédié.
  const items = data?.items ?? [];
  const successItems = items.filter((i) => i.pipelineStatus === 'success' && i.status);
  const stats = {
    total: items.length,
    mature: successItems.filter((i) => i.status === 'mature').length,
    goodTiming: successItems.filter((i) => i.status === 'good_timing').length,
    toWatch: successItems.filter((i) => i.status === 'to_watch').length,
    tooEarly: successItems.filter((i) => i.status === 'too_early').length,
  };
  const recent = items.slice(0, 5);

  return (
    <div className="px-6 py-8 md:px-10 md:py-10 max-w-6xl mx-auto space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble de tes analyses GTM. Lance une nouvelle analyse depuis la sidebar.
        </p>
      </header>

      {/* Stats cards */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<Activity className="h-4 w-4" />}
          tone="default"
        />
        <StatCard
          label="Prospects matures"
          value={stats.mature}
          icon={<Flame className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Bon timing"
          value={stats.goodTiming}
          icon={<Sparkles className="h-4 w-4" />}
          tone="blue"
        />
        <StatCard
          label="À surveiller"
          value={stats.toWatch}
          icon={<Eye className="h-4 w-4" />}
          tone="amber"
        />
      </section>

      {/* Recent analyses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Dernières analyses</h2>
          {items.length > 0 && (
            <Link to="/history" className="text-xs text-muted-foreground hover:underline">
              Voir tout →
            </Link>
          )}
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Chargement…</div>}

        {!isLoading && items.length === 0 && <EmptyState onNewAnalysis={onNewAnalysis} />}

        {!isLoading && recent.length > 0 && (
          <div className="grid gap-3">
            {recent.map((item) => {
              const isSuccess = item.pipelineStatus === 'success' && item.status !== null;
              return (
                <Link
                  key={item.id}
                  to={isSuccess ? `/analysis/${item.id}` : '#'}
                  className={isSuccess ? '' : 'pointer-events-none opacity-60'}
                >
                  <Card className="hover:bg-accent/40 transition-colors">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="font-medium truncate">{item.domain}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      <PipelineBadge status={item.pipelineStatus} />
                      {isSuccess && item.status && <StatusEmoji status={item.status} />}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ onNewAnalysis }: { onNewAnalysis: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pas encore d'analyse</CardTitle>
        <CardDescription>
          Lance ta première analyse pour voir comment Konsole qualifie une URL.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onNewAnalysis}>Lancer la première analyse</Button>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  tone: 'default' | 'emerald' | 'blue' | 'amber';
}

const TONE_CLASSES: Record<StatCardProps['tone'], string> = {
  default: 'text-muted-foreground',
  emerald: 'text-emerald-700 dark:text-emerald-400',
  blue: 'text-blue-700 dark:text-blue-400',
  amber: 'text-amber-700 dark:text-amber-400',
};

function StatCard({ label, value, icon, tone }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5 space-y-2">
        <div
          className={`flex items-center gap-1.5 text-xs uppercase tracking-wider ${TONE_CLASSES[tone]}`}
        >
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function PipelineBadge({ status }: { status: 'pending' | 'success' | 'error' }) {
  if (status === 'success') return <Badge variant="success">terminée</Badge>;
  if (status === 'error') return <Badge variant="destructive">erreur</Badge>;
  return <Badge variant="outline">en cours</Badge>;
}

const STATUS_ICON: Record<AnalysisStatus, ReactNode> = {
  too_early: <Sprout className="h-5 w-5 text-muted-foreground" />,
  to_watch: <Eye className="h-5 w-5 text-amber-700 dark:text-amber-400" />,
  good_timing: <Sparkles className="h-5 w-5 text-blue-700 dark:text-blue-400" />,
  mature: <Flame className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />,
};

function StatusEmoji({ status }: { status: AnalysisStatus }) {
  return <div className="shrink-0">{STATUS_ICON[status]}</div>;
}
