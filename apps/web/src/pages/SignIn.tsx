import { useSignIn } from '@clerk/clerk-react';
import { isClerkAPIResponseError } from '@clerk/clerk-react/errors';
import { Loader2, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Page de login custom one-page : email + password sur le même écran.
// Remplace le composant Clerk natif <SignIn /> qui imposait deux étapes
// (email puis password sur une page séparée). On utilise le hook useSignIn
// pour piloter manuellement le flow signIn.create({ identifier, password }).
//
// Mode admin-managed (voir ADR-012) : pas de self-service sign-up, pas de
// reset password depuis l'UI. Si un user oublie son mot de passe, l'admin
// le reset via le dashboard Clerk.
export function SignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const navigate = useNavigate();
  // identifier accepte indifféremment l'username ou l'email - Clerk résout les
  // deux selon ce qui est configuré comme méthode de sign-in dans le dashboard.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || isPending) return;

    setPending(true);
    setError(null);
    try {
      // Si l'identifier ressemble à un email on le lowercase, sinon on garde tel quel
      // (les usernames Clerk peuvent être case-sensitive selon la config).
      const trimmed = identifier.trim();
      const looksLikeEmail = trimmed.includes('@');
      const result = await signIn.create({
        identifier: looksLikeEmail ? trimmed.toLowerCase() : trimmed,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        navigate('/');
        return;
      }

      // Statuts intermédiaires possibles : "needs_second_factor" (MFA), etc.
      // Pour notre scope (4 users, password simple), on fallback sur un message clair.
      setError(
        `Vérification supplémentaire requise (status: ${result.status}). Contacte l'admin si le problème persiste.`,
      );
    } catch (err) {
      // Clerk renvoie un Array d'erreurs structurées via isClerkAPIResponseError
      if (isClerkAPIResponseError(err)) {
        const first = err.errors[0];
        setError(first?.longMessage ?? first?.message ?? 'Erreur de connexion');
      } else {
        setError('Erreur de connexion - vérifie tes identifiants');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight text-lg">Konsole</span>
          </div>
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <CardDescription>
            Identifiants (username ou email) transmis par l'admin lors de la création de ton compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Username ou email</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="prenomnom ou prenom.nom@youno.fr"
                autoComplete="username"
                required
                disabled={isPending}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isPending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Required for Clerk bot detection (CAPTCHA invisible). */}
            <div id="clerk-captcha" />

            <Button type="submit" className="w-full" disabled={isPending || !isLoaded}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion…
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
