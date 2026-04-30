import { SignIn as ClerkSignIn } from '@clerk/clerk-react';

// Page de login - composant officiel Clerk en path routing.
// Magic link primaire + password fallback configurés côté Clerk dashboard.
export function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <ClerkSignIn routing="path" path="/sign-in" signUpUrl="/sign-in" />
    </div>
  );
}
