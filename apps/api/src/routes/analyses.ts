import { getAuth } from '@clerk/fastify';
import { analysesListResponseSchema, analyzeResponseSchema } from '@youno/shared/schemas/analyze';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../db/index.js';
import { analyses, users } from '../db/schema.js';

function createHttpError(statusCode: number, message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.name = statusCode === 404 ? 'NotFound' : statusCode === 409 ? 'Conflict' : 'HttpError';
  err.statusCode = statusCode;
  return err;
}

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
        return { items: [] };
      }

      const rows = await db
        .select({
          id: analyses.id,
          url: analyses.url,
          domain: analyses.domain,
          pipelineStatus: analyses.pipelineStatus,
          status: analyses.status,
          errorMessage: analyses.errorMessage,
          createdAt: analyses.createdAt,
        })
        .from(analyses)
        .where(eq(analyses.userId, userDbId))
        .orderBy(desc(analyses.createdAt))
        .limit(HISTORY_LIMIT);

      return {
        items: rows.map((r) => ({
          id: r.id,
          url: r.url,
          domain: r.domain,
          pipelineStatus: r.pipelineStatus,
          status: r.status,
          errorMessage: r.errorMessage,
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

      if (row.pipelineStatus !== 'success' || !row.signals || !row.status || !row.recommendation) {
        throw createHttpError(
          409,
          `Analyse status='${row.pipelineStatus}' - non disponible (errorMessage='${row.errorMessage ?? ''}')`,
        );
      }

      return {
        id: row.id,
        url: row.url,
        domain: row.domain,
        pages: [], // markdowns non re-stockés en DB
        signals: row.signals,
        status: row.status,
        recommendation: row.recommendation,
        scrapedAt: row.createdAt.toISOString(),
        fromCache: false,
      };
    },
  );
}
