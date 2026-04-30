import { analyzeRequestSchema, analyzeResponseSchema } from '@youno/shared/schemas/analyze';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { scrapeUrl } from '../services/scraping.js';
import { detectTechStack } from '../services/tech-stack.js';

// POST /api/analyze - le pipeline scraping de J2 (Firecrawl + Wappalyzer en
// parallèle). Pas encore d'extraction LLM ni de score (J3) ni de cache (J3).
// Auth déjà appliquée par le hook preHandler global de plugins/auth.ts.
export async function analyzeRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/analyze',
    {
      schema: {
        body: analyzeRequestSchema,
        response: { 200: analyzeResponseSchema },
      },
    },
    async (request) => {
      const { url } = request.body;
      const scrapedAt = new Date().toISOString();

      request.log.info({ url, userEmail: request.userEmail }, 'analyze start');

      // Pipeline parallèle : scraping Firecrawl + détection tech stack
      // (fetch natif). detectTechStack ne lève jamais (graceful degradation).
      // ScrapingError remonte à l'error handler global qui sait extraire
      // statusCode et name de l'erreur typée.
      const [scraped, techStack] = await Promise.all([scrapeUrl(url), detectTechStack(url)]);

      request.log.info(
        { url, pages: scraped.pages.length, techs: techStack.length },
        'analyze success',
      );

      return {
        url,
        domain: scraped.domain,
        pages: scraped.pages,
        techStack,
        scrapedAt,
      };
    },
  );
}
