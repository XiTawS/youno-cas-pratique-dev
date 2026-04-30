import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import type { GtmSignals, ScoreBreakdown } from '@youno/shared/schemas/signals';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAnalysisById } from '@/lib/api';

// Page de détail d'une analyse - récupère par ID + affiche les 3 axes + score.
// L'analyse peut être en cache hit (pages markdown vide) ou fraîche (pages remplies).
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

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Button asChild variant="ghost" size="sm" className="-ml-3">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" /> Nouvelle analyse
              </Link>
            </Button>
            <h1 className="text-3xl font-semibold tracking-tight">{data.domain}</h1>
            <p className="text-xs text-muted-foreground">
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
          </div>
          <ScoreCircle score={data.score.total} />
        </header>

        {/* Notes pour SDR mises en avant */}
        <Card>
          <CardHeader>
            <CardTitle>Notes pour SDR</CardTitle>
            <CardDescription>
              Confidence d'extraction : <strong>{data.signals.extractionConfidence}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{data.signals.notesForSdr}</p>
          </CardContent>
        </Card>

        {/* Les 3 axes côte à côte sur desktop */}
        <div className="grid gap-4 md:grid-cols-3">
          <SalesMotionCard signals={data.signals} />
          <GrowthCard signals={data.signals} />
          <IcpFitCard signals={data.signals} />
        </div>

        {/* Tech stack */}
        <Card>
          <CardHeader>
            <CardTitle>Tech stack détectée</CardTitle>
            <CardDescription>{data.techStack.length} technologies via Wappalyzer</CardDescription>
          </CardHeader>
          <CardContent>
            {data.techStack.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune technologie détectée.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.techStack.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Détail du score */}
        <ScoreBreakdownCard breakdown={data.score} />
      </div>
    </div>
  );
}

// Affiche le score sur 100 avec une couleur progressive.
function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <div className="text-right shrink-0">
      <div className={`text-5xl font-bold ${color}`}>{score}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">/100 GTM</div>
    </div>
  );
}

function SalesMotionCard({ signals }: { signals: GtmSignals }) {
  const sm = signals.salesMotion;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comment ils vendent</CardTitle>
        <CardDescription>Sales motion</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge
          variant={
            sm.type === 'self_serve'
              ? 'success'
              : sm.type === 'sales_led'
                ? 'warning'
                : sm.type === 'hybrid'
                  ? 'default'
                  : 'outline'
          }
        >
          {sm.type.replace('_', '-')}
        </Badge>
        <ul className="text-sm space-y-1">
          <Bool label="Pricing public" value={sm.pricingPubliclyVisible} />
          <Bool label="Free trial / freemium" value={sm.freeTrialOrFreemium} />
          <Bool label='CTA "Demo / Contact sales"' value={sm.bookDemoOrTalkToSales} />
        </ul>
        {sm.evidence && (
          <blockquote className="border-l-2 border-[var(--color-border)] pl-3 text-xs italic text-muted-foreground">
            "{sm.evidence}"
          </blockquote>
        )}
      </CardContent>
    </Card>
  );
}

function GrowthCard({ signals }: { signals: GtmSignals }) {
  const g = signals.growthSignals;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sont-ils en croissance</CardTitle>
        <CardDescription>Growth signals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Bool label="Hiring actif" value={g.hiringActively} />
        {g.hiringRoles.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <strong>Roles :</strong> {g.hiringRoles.slice(0, 5).join(', ')}
            {g.hiringRoles.length > 5 && '…'}
          </div>
        )}
        <div>
          <strong>Logos clients :</strong> {g.customerLogosCount}
        </div>
        {g.rolesIndicatingGtm.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {g.rolesIndicatingGtm.map((r) => (
              <Badge key={r} variant="outline" className="text-xs">
                {r}
              </Badge>
            ))}
          </div>
        )}
        {g.recentNewsOrLaunches.length > 0 && (
          <div className="text-xs">
            <strong>News récentes :</strong>
            <ul className="list-disc pl-4 mt-1 text-muted-foreground space-y-0.5">
              {g.recentNewsOrLaunches.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IcpFitCard({ signals }: { signals: GtmSignals }) {
  const i = signals.icpFit;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">À qui ils vendent</CardTitle>
        <CardDescription>ICP fit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Badge variant={i.targetSegment === 'unknown' ? 'outline' : 'default'}>
          {i.targetSegment.replace('_', '-')}
        </Badge>
        {i.targetRoles.length > 0 && (
          <div className="text-xs">
            <strong>Roles cibles :</strong>{' '}
            <span className="text-muted-foreground">{i.targetRoles.join(', ')}</span>
          </div>
        )}
        {i.industryFocus.length > 0 && (
          <div className="text-xs">
            <strong>Verticals :</strong>{' '}
            <span className="text-muted-foreground">{i.industryFocus.join(', ')}</span>
          </div>
        )}
        {i.geographicFocus.length > 0 && (
          <div className="text-xs">
            <strong>Géo :</strong>{' '}
            <span className="text-muted-foreground">{i.geographicFocus.join(', ')}</span>
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
      <span className={value ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
        {value ? '✓ oui' : '— non'}
      </span>
    </li>
  );
}

function ScoreBreakdownCard({ breakdown }: { breakdown: ScoreBreakdown }) {
  const [open, setOpen] = useState(false);
  const buckets = [
    { name: 'Sales motion', data: breakdown.salesMotion },
    { name: 'Growth', data: breakdown.growth },
    { name: 'ICP fit', data: breakdown.icpFit },
    { name: 'Tech stack', data: breakdown.techStack },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Détail du score</CardTitle>
        <CardDescription>
          Formule transparente / 100 - 4 buckets pondérés (voir ADR-010)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {buckets.map((b) => (
          <div key={b.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <strong>{b.name}</strong>
              <span className="font-mono text-muted-foreground">
                {b.data.earned} / {b.data.max}
              </span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${(b.data.earned / b.data.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
          {open ? 'Masquer le détail' : 'Voir le détail des points'}
        </Button>
        {open && (
          <div className="space-y-3 pt-2 text-xs">
            {buckets.map((b) => (
              <div key={b.name}>
                <div className="font-medium mb-1">{b.name}</div>
                <ul className="space-y-0.5 text-muted-foreground">
                  {b.data.reasons.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
