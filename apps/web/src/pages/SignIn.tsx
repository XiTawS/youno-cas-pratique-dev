import { SignIn as ClerkSignIn } from '@clerk/clerk-react';

// Page de login - composant officiel Clerk en path routing.
// Mode admin-only : les comptes sont créés par admin via le dashboard Clerk
// (email + password prédéfini). Le lien "Sign up" du composant est masqué
// car il n'y a pas de flow d'inscription self-service.
export function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <ClerkSignIn
        routing="path"
        path="/sign-in"
        appearance={{
          elements: {
            footer: { display: 'none' },
          },
        }}
      />
    </div>
  );
}
