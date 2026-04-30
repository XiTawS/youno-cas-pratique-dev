import { healthResponseSchema, type HealthResponse } from '@shared/schemas/health';
import { meResponseSchema, type MeResponse } from '@shared/schemas/me';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ApiFetchOptions {
  token?: string | null;
  init?: RequestInit;
}

// Wrapper unique côté front pour les appels API.
// Injecte le bearer token Clerk si fourni, propage l'erreur API si non-2xx.
async function apiFetch(path: string, { token, init }: ApiFetchOptions = {}): Promise<unknown> {
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = `${path} failed with HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // body non-JSON, on garde le message par défaut
    }
    throw new Error(message);
  }
  return res.json();
}

// Route publique - pas de token nécessaire.
export async function fetchHealth(): Promise<HealthResponse> {
  const data = await apiFetch('/api/health');
  return healthResponseSchema.parse(data);
}

// Route protégée - le token Clerk est requis (récupéré via useAuth().getToken()).
export async function fetchMe(token: string): Promise<MeResponse> {
  const data = await apiFetch('/api/me', { token });
  return meResponseSchema.parse(data);
}
