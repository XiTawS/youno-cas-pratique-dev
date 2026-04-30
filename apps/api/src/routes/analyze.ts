import { clerkClient, getAuth } from '@clerk/fastify';
import { analyzeRequestSchema, analyzeResponseSchema } from '@youno/shared/schemas/analyze';
import { and, desc, eq, gt } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../db/index.js';
import { analyses, users, type Analysis, type NewAnalysis } from '../db/schema.js';
import { ExtractionError, extractSignals } from '../services/extraction.js';
import { ScrapingError, scrapeUrl } from '../services/scraping.js';
import { computeStatus } from '../services/status.js';
import { detectTechStack } from '../services/tech-stack.js';

// TTL du cache : si une analyse réussie pour ce domaine et cet utilisateur
// existe dans cette fenêtre, on la rejoue plutôt que de re-scraper.
const CACHE_TTL_HOURS = 24;

// Lazy-upsert : crée la ligne users à la 1ère analyse plutôt que via webhook.
// Évite la complexité d'un webhook Clerk pour un MVP. Trade-off : un round-trip
// Clerk API pour récupérer l'email à chaque 1er hit user, mais ça arrive 1 fois
// par utilisateur dans la vie de l'app.
async function ensureUserRow(clerkUserId: string, fallbackEmail: string): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  const found = existing[0];
  if (found) return found.id;

  let email = fallbackEmail;
  try {
    const user = await clerkClient.users.getUser(clerkUserId);
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
    if (primary) email = primary.emailAddress.toLowerCase();
  } catch {
    // garde le fallback
  }

  const inserted = await db
    .insert(users)
    .values({ clerkId: clerkUserId, email })
    .returning({ id: users.id });
  const insertedRow = inserted[0];
  if (!insertedRow) {
    throw new Error('Insert users a retourné 0 lignes (race condition ?)');
  }
  return insertedRow.id;
}

// Cherche une analyse réussie récente pour ce domain + user.
async function findCachedAnalysis(userDbId: string, domain: string): Promise<Analysis | undefined> {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(analyses)
    .where(
      and(
        eq(analyses.userId, userDbId),
        eq(analyses.domain, domain),
        eq(analyses.pipelineStatus, 'success'),
        gt(analyses.createdAt, cutoff),
      ),
    )
    .orderBy(desc(analyses.createdAt))
    .limit(1);
  return rows[0];
}

// POST /api/analyze - le pipeline complet :
// auth (hook global) → cache 24h → scraping + tech stack → LLM → status → persist.
export async function analyzeRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/analyze',
    {
      schema: {
        body: analyzeRequestSchema,
        response: { 200: analyzeResponseSchema },
      },
    },
    async (request: FastifyRequest) => {
      const { url } = request.body as { url: string };
      const { userId: clerkUserId } = getAuth(request);
      const fallbackEmail = request.userEmail;

      if (!clerkUserId || !fallbackEmail) {
        throw new Error('Contexte auth manquant - hook auth non appliqué');
      }

      const parsedUrl = new URL(url);
      const domain = parsedUrl.host.replace(/^www\./i, '').toLowerCase();

      const userDbId = await ensureUserRow(clerkUserId, fallbackEmail);

      // 1. Cache lookup
      const cached = await findCachedAnalysis(userDbId, domain);
      if (cached?.signals && cached.status && cached.recommendation) {
        request.log.info({ url, domain, cachedId: cached.id }, 'analyze cache HIT');
        return {
          id: cached.id,
          url: cached.url,
          domain: cached.domain,
          pages: [], // markdowns non re-stockés en DB
          signals: cached.signals,
          status: cached.status,
          recommendation: cached.recommendation,
          scrapedAt: cached.createdAt.toISOString(),
          fromCache: true,
        };
      }

      // 2. Insert pending
      const scrapedAt = new Date();
      const pendingInsert: NewAnalysis = {
        userId: userDbId,
        url,
        domain,
        pipelineStatus: 'pending',
        createdAt: scrapedAt,
      };
      const pending = await db.insert(analyses).values(pendingInsert).returning();
      const pendingRow = pending[0];
      if (!pendingRow) throw new Error('Insert analyses pending a retourné 0 lignes');

      try {
        // 3. Scraping + tech stack en parallèle (gain ~1s vs séquentiel)
        const [scraped, techStack] = await Promise.all([scrapeUrl(url), detectTechStack(url)]);
        request.log.info(
          { url, pages: scraped.pages.length, techs: techStack.length },
          'analyze scraping done',
        );

        // 4. Extraction LLM (signals incluent techStack et recommendation)
        const signals = await extractSignals({ url, pages: scraped.pages, techStack });

        // 5. Calcul du statut qualitatif déterministe
        const status = computeStatus(signals);

        // 6. Update success
        await db
          .update(analyses)
          .set({
            signals,
            status,
            recommendation: signals.recommendation,
            pipelineStatus: 'success',
          })
          .where(eq(analyses.id, pendingRow.id));

        request.log.info({ url, domain, analysisId: pendingRow.id, status }, 'analyze success');

        return {
          id: pendingRow.id,
          url,
          domain,
          pages: scraped.pages,
          signals,
          status,
          recommendation: signals.recommendation,
          scrapedAt: scrapedAt.toISOString(),
          fromCache: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        await db
          .update(analyses)
          .set({ pipelineStatus: 'error', errorMessage: message.slice(0, 1000) })
          .where(eq(analyses.id, pendingRow.id))
          .catch(() => {
            request.log.error({ url }, 'failed to update analyses to error status');
          });

        if (err instanceof ScrapingError || err instanceof ExtractionError) throw err;
        throw err;
      }
    },
  );
}

export { CACHE_TTL_HOURS };
