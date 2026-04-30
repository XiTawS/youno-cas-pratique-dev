import { healthResponseSchema, type HealthResponse } from '@shared/schemas/health';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Wrapper unique côté front pour les appels API.
// Validation Zod systematique sur la réponse - même schéma que côté API.
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health endpoint failed with HTTP ${res.status}`);
  }
  const data: unknown = await res.json();
  return healthResponseSchema.parse(data);
}
