import { clerkClient, getAuth } from '@clerk/fastify';
import { analyzeRequestSchema, analyzeResponseSchema } from '@youno/shared/schemas/analyze';
import { and, desc, eq, gt } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../db/index.js';
import { analyses, users, type Analysis, type NewAnalysis } from '../db/schema.js';
import { ExtractionError, extractSignals } from '../services/extraction.js';
import { ScrapingError, scrapeUrl } from '../services/scraping.js';
import { computeScore } from '../services/scoring.js';
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

  // Pas trouvé : insert. Email récupéré depuis Clerk pour rester source of truth.
  // Le hook auth global a déjà mis l'email vérifié dans request.userEmail mais
  // on accepte un fallback au cas où.
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
// Le compteur est sur l'utilisateur courant pour éviter de mélanger les analyses
// entre comptes (ex. si Léo et Kaio analysent stripe.com à 5 min d'écart).
async function findCachedAnalysis(userDbId: string, domain: string): Promise<Analysis | undefined> {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(analyses)
    .where(
      and(
        eq(analyses.userId, userDbId),
        eq(analyses.domain, domain),
        eq(analyses.status, 'success'),
        gt(analyses.createdAt, cutoff),
      ),
    )
    .orderBy(desc(analyses.createdAt))
    .limit(1);
  return rows[0];
}

// POST /api/analyze - le pipeline complet J3 :
// auth (hook global) → cache 24h → scraping + tech stack → LLM → scoring → persist.
//
// Auth : déjà appliquée par plugins/auth.ts (preHandler global).
// On récupère userId Clerk via getAuth(), puis on lazy-upsert la ligne users.
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

      // Garanti par le hook auth global - sécurité défensive.
      if (!clerkUserId || !fallbackEmail) {
        throw new Error('Contexte auth manquant - hook auth non appliqué');
      }

      // Normalise le domain pour le cache (strip www., lowercase).
      const parsedUrl = new URL(url);
      const domain = parsedUrl.host.replace(/^www\./i, '').toLowerCase();

      // 1. Lazy-upsert user
      const userDbId = await ensureUserRow(clerkUserId, fallbackEmail);

      // 2. Cache lookup
      const cached = await findCachedAnalysis(userDbId, domain);
      if (cached?.signals && cached.scoreBreakdown && cached.techStack) {
        request.log.info({ url, domain, cachedId: cached.id }, 'analyze cache HIT');
        // Le markdown des pages n'est pas re-stocké en DB pour économiser
        // l'espace JSONB (cas pratique scope). On ne le re-renvoie pas en
        // cache hit - le front a déjà tout ce qu'il faut pour la page Analysis.
        return {
          id: cached.id,
          url: cached.url,
          domain: cached.domain,
          pages: [], // pages markdown non persistées, vide en cache hit (front gère)
          techStack: cached.techStack,
          signals: cached.signals,
          score: cached.scoreBreakdown,
          scrapedAt: cached.createdAt.toISOString(),
          fromCache: true,
        };
      }

      // 3. Insert pending
      const scrapedAt = new Date();
      const pendingInsert: NewAnalysis = {
        userId: userDbId,
        url,
        domain,
        status: 'pending',
        createdAt: scrapedAt,
      };
      const pending = await db.insert(analyses).values(pendingInsert).returning();
      const pendingRow = pending[0];
      if (!pendingRow) throw new Error('Insert analyses pending a retourné 0 lignes');

      try {
        // 4. Scraping + tech stack en parallèle (gain ~1s vs séquentiel)
        const [scraped, techStack] = await Promise.all([scrapeUrl(url), detectTechStack(url)]);
        request.log.info(
          { url, pages: scraped.pages.length, techs: techStack.length },
          'analyze scraping done',
        );

        // 5. Extraction LLM
        const signals = await extractSignals({ url, pages: scraped.pages, techStack });

        // 6. Scoring
        const score = computeScore(signals, techStack);

        // 7. Update success
        await db
          .update(analyses)
          .set({
            signals,
            techStack,
            scoreMaturity: score.total,
            scoreBreakdown: score,
            status: 'success',
          })
          .where(eq(analyses.id, pendingRow.id));

        request.log.info(
          { url, domain, analysisId: pendingRow.id, score: score.total },
          'analyze success',
        );

        return {
          id: pendingRow.id,
          url,
          domain,
          pages: scraped.pages,
          techStack,
          signals,
          score,
          scrapedAt: scrapedAt.toISOString(),
          fromCache: false,
        };
      } catch (err) {
        // Log + update DB avec status='error' avant de re-throw vers
        // l'error handler global qui formera la réponse HTTP.
        const message = err instanceof Error ? err.message : 'unknown error';
        await db
          .update(analyses)
          .set({ status: 'error', errorMessage: message.slice(0, 1000) })
          .where(eq(analyses.id, pendingRow.id))
          .catch(() => {
            // Si l'update DB échoue aussi, on log mais on remonte l'erreur d'origine
            request.log.error({ url }, 'failed to update analyses to error status');
          });

        // Re-throw - les ScrapingError/ExtractionError typées portent leur statusCode.
        if (err instanceof ScrapingError || err instanceof ExtractionError) throw err;
        throw err;
      }
    },
  );
}

// Utilitaire pour les tests/migrations - non exposé au front.
export { CACHE_TTL_HOURS };
