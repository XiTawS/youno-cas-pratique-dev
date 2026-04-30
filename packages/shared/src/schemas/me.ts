import { z } from 'zod';

// Réponse de GET /api/me - identité de l'utilisateur authentifié et autorisé
// (JWT Clerk valide + email dans l'allowlist applicative).
export const meResponseSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
