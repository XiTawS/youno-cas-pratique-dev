import { SignUp as ClerkSignUp } from '@clerk/clerk-react';

// Page de création de compte - composant officiel Clerk en path routing.
// Avec allowlist activée, seuls les emails listés dashboard côté Clerk peuvent créer.
// La vérification email se fait via le magic link (config Clerk dashboard).
export function SignUp() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <ClerkSignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}
