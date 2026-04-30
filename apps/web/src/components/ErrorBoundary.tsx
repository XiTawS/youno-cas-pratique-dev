import { Component, type ErrorInfo, type ReactNode } from 'react';

// Catch les erreurs render React et affiche un fallback minimal.
// Doublé par les Toast de TanStack Query côté data fetch (cf. App.tsx queryClient).
interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // En prod, console suffit - pas de Sentry dans le scope cas pratique.
    console.error('ErrorBoundary caught:', error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
            <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
            <button
              className="text-sm underline hover:no-underline"
              onClick={() => window.location.reload()}
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
