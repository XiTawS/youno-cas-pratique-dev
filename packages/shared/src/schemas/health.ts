import { z } from 'zod';

// Schéma de la réponse de GET /api/health.
// Sert aussi de premier test d'intégration du package partagé entre API et front.
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
