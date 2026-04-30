import {
  analyzeResponseSchema,
  analysesListResponseSchema,
  type AnalyzeResponse,
  type AnalysesListResponse,
} from '@youno/shared/schemas/analyze';
import { healthResponseSchema, type HealthResponse } from '@youno/shared/schemas/health';
import { meResponseSchema, type MeResponse } from '@youno/shared/schemas/me';

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
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
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

// Lance une nouvelle analyse - pipeline complet (10-30s typique).
export async function fetchAnalyze(token: string, url: string): Promise<AnalyzeResponse> {
  const data = await apiFetch('/api/analyze', {
    token,
    init: { method: 'POST', body: JSON.stringify({ url }) },
  });
  return analyzeResponseSchema.parse(data);
}

// Récupère une analyse persistée par ID (pour la page Analysis).
export async function fetchAnalysisById(token: string, id: string): Promise<AnalyzeResponse> {
  const data = await apiFetch(`/api/analyses/${id}`, { token });
  return analyzeResponseSchema.parse(data);
}

// Liste des analyses du user (page History) - 50 plus récentes.
export async function fetchHistory(token: string): Promise<AnalysesListResponse> {
  const data = await apiFetch('/api/analyses', { token });
  return analysesListResponseSchema.parse(data);
}
