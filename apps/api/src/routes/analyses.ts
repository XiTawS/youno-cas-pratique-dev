import { getAuth } from '@clerk/fastify';
import {
  analysesListResponseSchema,
  analyzeResponseSchema,
  scrapedPageSchema,
} from '@youno/shared/schemas/analyze';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../db/index.js';
import { analyses, users } from '../db/schema.js';

// Helper qui crée une Error portable par l'error handler global Fastify
// (récupère statusCode + name pour le format JSON uniforme).
function createHttpError(statusCode: number, message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.name = statusCode === 404 ? 'NotFound' : statusCode === 409 ? 'Conflict' : 'HttpError';
  err.statusCode = statusCode;
  return err;
}

// Helpers pour résoudre l'ID DB de l'utilisateur courant depuis le clerkId.
// La row users existe forcément ici car l'utilisateur a déjà fait au moins
// une analyse pour atterrir sur cette page (lazy upsert dans /api/analyze).
async function getCurrentUserDbId(clerkUserId: string): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  return rows[0]?.id ?? null;
}

const HISTORY_LIMIT = 50;

export async function analysesRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/analyses - liste des analyses de l'utilisateur courant
  // (les 50 plus récentes, ordre desc par created_at)
  app.withTypeProvider<ZodTypeProvider>().get(
    '/analyses',
    {
      schema: {
        response: { 200: analysesListResponseSchema },
      },
    },
    async (request) => {
      const { userId: clerkUserId } = getAuth(request);
      if (!clerkUserId) throw new Error('Contexte auth manquant');

      const userDbId = await getCurrentUserDbId(clerkUserId);
      if (!userDbId) {
        // L'utilisateur n'a jamais analysé, donc pas de row users - liste vide.
        return { items: [] };
      }

      const rows = await db
        .select({
          id: analyses.id,
          url: analyses.url,
          domain: analyses.domain,
          status: analyses.status,
          scoreMaturity: analyses.scoreMaturity,
          errorMessage: analyses.errorMessage,
          createdAt: analyses.createdAt,
        })
        .from(analyses)
        .where(eq(analyses.userId, userDbId))
        .orderBy(desc(analyses.createdAt))
        .limit(HISTORY_LIMIT);

      return {
        items: rows.map((r) => ({
          ...r,
          status: r.status as 'pending' | 'success' | 'error',
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  );

  // GET /api/analyses/:id - détail d'une analyse (vérif owner)
  app.withTypeProvider<ZodTypeProvider>().get(
    '/analyses/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid('id doit être un UUID') }),
        response: { 200: analyzeResponseSchema },
      },
    },
    async (request) => {
      const { userId: clerkUserId } = getAuth(request);
      if (!clerkUserId) throw new Error('Contexte auth manquant');

      const userDbId = await getCurrentUserDbId(clerkUserId);
      if (!userDbId) {
        throw createHttpError(404, 'Analyse introuvable');
      }

      const rows = await db
        .select()
        .from(analyses)
        .where(and(eq(analyses.id, request.params.id), eq(analyses.userId, userDbId)))
        .limit(1);

      const row = rows[0];
      if (!row) {
        throw createHttpError(404, 'Analyse introuvable');
      }

      // L'analyse peut être en 'pending' ou 'error' - dans ce cas certains champs
      // sont null. Le response schema attend ces champs remplis, donc on échoue
      // plutôt que renvoyer une réponse partiellement valide.
      if (row.status !== 'success' || !row.signals || !row.scoreBreakdown || !row.techStack) {
        throw createHttpError(
          409,
          `Analyse status='${row.status}' - non disponible (errorMessage='${row.errorMessage ?? ''}')`,
        );
      }

      // Pages markdown non re-stockées en DB pour économiser le JSONB
      // (cas pratique scope) - on renvoie [] et le front gère l'affichage.
      const emptyPages: z.infer<typeof scrapedPageSchema>[] = [];

      return {
        id: row.id,
        url: row.url,
        domain: row.domain,
        pages: emptyPages,
        techStack: row.techStack,
        signals: row.signals,
        score: row.scoreBreakdown,
        scrapedAt: row.createdAt.toISOString(),
        fromCache: false,
      };
    },
  );
}
