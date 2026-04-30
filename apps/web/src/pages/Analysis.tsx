import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import type { AnalysisStatus, Signals } from '@youno/shared/schemas/signals';
import { ArrowLeft, Download, FileText, Loader2, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchAnalysisById } from '@/lib/api';
import { exportAsMarkdown, exportAsPdf } from '@/lib/exportAnalysis';

// Page de détail d'une analyse - récupère par ID + affiche les blocs qualitatifs.
// Voir ADR-013 pour la refonte (statut + recommandation, plus de score numérique).
export function Analysis() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analysis', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error('id manquant');
      const token = await getToken();
      if (!token) throw new Error('Pas de session active');
      return fetchAnalysisById(token, id);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Analyse introuvable</CardTitle>
            <CardDescription>
              {(error as Error | undefined)?.message ?? 'Erreur inconnue'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { signals } = data;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6 print-area">
        {/* En-tête boîte : nom + description courte + tags */}
        <header className="space-y-2">
          <div className="flex items-center justify-between gap-2 print:hidden">
            <Button asChild variant="ghost" size="sm" className="-ml-3">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" /> Retour
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => exportAsMarkdown(data)}
                >
                  <FileText className="h-4 w-4" />
                  Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onSelect={() => exportAsPdf()}>
                  <Printer className="h-4 w-4" />
                  PDF (impression)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{signals.company.name}</h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {signals.company.description}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {signals.company.sector && (
              <Badge variant="secondary">📂 {signals.company.sector}</Badge>
            )}
            {signals.company.approximateSize !== 'unknown' && (
              <Badge variant="secondary">👥 {signals.company.approximateSize} employés</Badge>
            )}
            <Badge variant="outline">{signals.icp.segment}</Badge>
            {signals.icp.geography && <Badge variant="outline">{signals.icp.geography}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            <a href={data.url} target="_blank" rel="noreferrer" className="hover:underline">
              {data.url}
            </a>
            {' · '}
            {new Date(data.scrapedAt).toLocaleString('fr-FR')}
            {data.fromCache && (
              <Badge variant="outline" className="ml-2">
                cache
              </Badge>
            )}
          </p>
        </header>

        {/* Carte STATUT en gros */}
        <StatusCard status={data.status} />

        {/* Carte RECOMMANDATION */}
        <Card>
          <CardHeader>
            <CardTitle>Recommandation</CardTitle>
            <CardDescription>Approche commerciale suggérée par l'analyse.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{data.recommendation}</p>
          </CardContent>
        </Card>

        {/* 3 cartes signaux côte à côte sur desktop */}
        <div className="grid gap-4 md:grid-cols-3">
          <SalesMotionCard signals={signals} />
          <MaturityCard signals={signals} />
          <IcpCard signals={signals} />
        </div>

        {/* Stack technique */}
        <Card>
          <CardHeader>
            <CardTitle>Stack technique</CardTitle>
            <CardDescription>
              {signals.techStack.length} technologies détectées sur la page d'accueil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signals.techStack.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune technologie détectée.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {signals.techStack.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Mapping enum statut → libellé FR + emoji + classes Tailwind dark-aware.
const STATUS_DISPLAY: Record<
  AnalysisStatus,
  { label: string; emoji: string; bg: string; text: string }
> = {
  too_early: {
    label: 'Trop tôt',
    emoji: '🌱',
    bg: 'bg-muted',
    text: 'text-muted-foreground',
  },
  to_watch: {
    label: 'À surveiller',
    emoji: '👀',
    bg: 'bg-amber-100/70 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
  },
  good_timing: {
    label: 'Bon timing',
    emoji: '✨',
    bg: 'bg-blue-100/70 dark:bg-blue-950/40',
    text: 'text-blue-800 dark:text-blue-300',
  },
  mature: {
    label: 'Prospect mature',
    emoji: '🔥',
    bg: 'bg-emerald-100/70 dark:bg-emerald-950/40',
    text: 'text-emerald-800 dark:text-emerald-300',
  },
};

function StatusCard({ status }: { status: AnalysisStatus }) {
  const cfg = STATUS_DISPLAY[status];
  return (
    <Card className={`${cfg.bg} border-0`}>
      <CardContent className="flex items-center gap-4 py-6">
        <div className="text-5xl">{cfg.emoji}</div>
        <div>
          <div className={`text-2xl font-semibold ${cfg.text}`}>{cfg.label}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Statut de prospection
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SalesMotionCard({ signals }: { signals: Signals }) {
  const sm = signals.salesMotion;
  const ctaLabel: Record<typeof sm.primaryCta, string> = {
    signup: 'Inscription directe',
    demo: 'Demande de démo',
    contact_sales: 'Contacter un commercial',
    mixed: 'CTA mixte',
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comment ils vendent</CardTitle>
        <CardDescription>Modèle commercial</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge
          variant={
            sm.model === 'PLG' ? 'success' : sm.model === 'Sales-led' ? 'warning' : 'default'
          }
        >
          {sm.model}
        </Badge>
        <ul className="text-sm space-y-1">
          <Bool label="Pricing public" value={sm.pricingPublic} />
          <Bool label="Free trial / freemium" value={sm.freeTrial} />
        </ul>
        <div className="text-xs text-muted-foreground pt-1">
          <strong>CTA principal :</strong> {ctaLabel[sm.primaryCta]}
        </div>
      </CardContent>
    </Card>
  );
}

function MaturityCard({ signals }: { signals: Signals }) {
  const m = signals.maturity;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Maturité commerciale</CardTitle>
        <CardDescription>Signaux factuels de structuration GTM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Bool label="Page clients dédiée" value={m.customersPage} />
        <Bool
          label={`Logos clients${m.clientLogosCount !== null ? ` (${m.clientLogosCount})` : ''}`}
          value={(m.clientLogosCount ?? 0) > 0}
        />
        <Bool label="Blog actif récent" value={m.blogActive} />
        <Bool label="Recrutement sales / marketing" value={m.salesMarketingHiring} />
        {m.blogLastPostHint && (
          <div className="text-xs text-muted-foreground pt-1">
            Dernier post : {m.blogLastPostHint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IcpCard({ signals }: { signals: Signals }) {
  const i = signals.icp;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cible visée</CardTitle>
        <CardDescription>À qui ils vendent</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Badge variant="default">{i.segment}</Badge>
        {i.targetRoles.length > 0 && (
          <div className="text-xs">
            <strong>Rôles ciblés :</strong>{' '}
            <span className="text-muted-foreground">{i.targetRoles.join(', ')}</span>
          </div>
        )}
        {i.verticals.length > 0 && (
          <div className="text-xs">
            <strong>Verticales :</strong>{' '}
            <span className="text-muted-foreground">{i.verticals.join(', ')}</span>
          </div>
        )}
        {i.geography && (
          <div className="text-xs">
            <strong>Géographie :</strong>{' '}
            <span className="text-muted-foreground">{i.geography}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Bool({ label, value }: { label: string; value: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          value ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-muted-foreground'
        }
      >
        {value ? 'oui' : 'non'}
      </span>
    </li>
  );
}
