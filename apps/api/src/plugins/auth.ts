import { clerkClient, getAuth } from '@clerk/fastify';
import type { FastifyInstance } from 'fastify';
import { env } from '../lib/env.js';

// Routes accessibles sans token Clerk - garder ce set minimal.
// /api/health doit rester public pour les healthchecks Render et le warm-up.
const PUBLIC_ROUTES = new Set(['/api/health']);

// Augmente FastifyRequest avec l'email vérifié - dispo dans tous les handlers
// derrière le hook auth.
declare module 'fastify' {
  interface FastifyRequest {
    userEmail?: string;
  }
}

// Ajoute un hook preHandler global qui vérifie le JWT Clerk et l'allowlist email.
// preHandler (et non onRequest) car le clerkPlugin v2 hydrate le contexte auth
// en amont du handler mais après onRequest - getAuth() n'est dispo qu'à partir
// de preValidation. Le clerkPlugin doit être enregistré au scope racine.
export function registerAuthHook(app: FastifyInstance): void {
  app.addHook('preHandler', async (request, reply) => {
    // Strip query string pour comparer le path uniquement
    const path = request.url.split('?')[0] ?? request.url;
    if (PUBLIC_ROUTES.has(path)) return;

    const { userId } = getAuth(request);
    if (!userId) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Token de session manquant ou invalide',
      });
    }

    // Récupère l'email primaire vérifié et compare à l'allowlist applicative
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses
      .find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase();

    if (!primaryEmail || !env.AUTH_ALLOWED_EMAILS.includes(primaryEmail)) {
      request.log.warn({ userId, primaryEmail }, 'email hors allowlist');
      return reply.code(403).send({
        error: 'Forbidden',
        message: "Email n'est pas dans l'allowlist",
      });
    }

    request.userEmail = primaryEmail;
  });
}
