import { SignOutButton, useAuth } from '@clerk/clerk-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { analyzeRequestSchema, type AnalyzeRequest } from '@youno/shared/schemas/analyze';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchAnalyze } from '@/lib/api';

// Page d'accueil J4 - input URL principal + bouton Analyser.
// Le hook auth global API protège déjà /api/analyze, RequireAuth garantit
// qu'on est ici loggé donc useAuth().getToken() retourne un token valide.
export function Home() {
  const { getToken, isSignedIn } = useAuth();
  const navigate = useNavigate();

  const form = useForm<AnalyzeRequest>({
    resolver: zodResolver(analyzeRequestSchema),
    defaultValues: { url: '' },
  });

  const analyze = useMutation({
    mutationFn: async (values: AnalyzeRequest) => {
      const token = await getToken();
      if (!token) throw new Error('Pas de session active');
      return fetchAnalyze(token, values.url);
    },
    onSuccess: (data) => {
      toast.success(`Analyse de ${data.domain} terminée${data.fromCache ? ' (cache)' : ''}`);
      navigate(`/analysis/${data.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Konsole</h1>
          <p className="text-sm text-muted-foreground">
            Analyse GTM d'une URL en moins de 30 secondes. Cas pratique Youno.
          </p>
        </header>

        <form
          onSubmit={form.handleSubmit((values) => analyze.mutate(values))}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="url">URL du site à analyser</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://stripe.com"
              autoComplete="url"
              autoFocus
              disabled={analyze.isPending}
              {...form.register('url')}
            />
            {form.formState.errors.url && (
              <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={analyze.isPending}>
            {analyze.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse en cours… (10-30s)
              </>
            ) : (
              'Analyser'
            )}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Link to="/history" className="hover:underline">
            ← Voir mon historique
          </Link>
          {isSignedIn && (
            <SignOutButton>
              <button className="hover:underline">Déconnexion</button>
            </SignOutButton>
          )}
        </div>
      </div>
    </div>
  );
}
