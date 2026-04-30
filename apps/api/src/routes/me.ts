import { getAuth } from '@clerk/fastify';
import { meResponseSchema } from '@youno/shared/schemas/me';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

// Route protégée - utilisée pour vérifier le bout-en-bout auth en local et en prod.
// Le hook auth global a déjà validé le JWT et l'allowlist en amont.
export async function meRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/me',
    {
      schema: {
        response: { 200: meResponseSchema },
      },
    },
    async (request) => {
      const { userId } = getAuth(request);
      const email = request.userEmail;
      // Garanti par le hook auth global - si on arrive ici sans contexte,
      // c'est un bug interne (route non couverte par le hook).
      if (!userId || !email) {
        throw new Error('Contexte auth manquant - hook auth non appliqué ?');
      }
      return { userId, email };
    },
  );
}
