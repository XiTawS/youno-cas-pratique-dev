import Firecrawl from '@mendable/firecrawl-js';
import type { ScrapedPage } from '@youno/shared/schemas/analyze';
import { env } from '../lib/env.js';
import { pickPagesToScrape } from './scraping-utils.js';

// Re-export pour compat avec les imports existants.
export { pickPagesToScrape };

const MAP_LIMIT = 30;

const client = new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY });

// Une seule erreur typée pour tout le pipeline scraping - le route handler
// la transforme en réponse HTTP propre via l'error handler global Fastify.
export class ScrapingError extends Error {
  override name = 'ScrapingError';
  statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface ScrapeResult {
  pages: ScrapedPage[];
  domain: string;
}

// Map les erreurs techniques Firecrawl/réseau vers un message FR user-friendly.
// L'utilisateur final ne voit jamais "Firecrawl /map failed" ou un stacktrace.
// Le détail technique reste dans les logs Pino côté serveur.
function userFriendlyScrapingMessage(rawError: string): string {
  const lower = rawError.toLowerCase();
  if (lower.includes('enotfound') || lower.includes('dns')) {
    return "Ce domaine n'existe pas ou n'est pas joignable. Vérifie l'URL et réessaie.";
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return 'Le site met trop de temps à répondre. Réessaie dans quelques minutes.';
  }
  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return 'Trop de requêtes simultanées. Patiente une minute avant de relancer une analyse.';
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('forbidden')) {
    return "Le site bloque les outils d'analyse automatique. Impossible de l'analyser.";
  }
  if (lower.includes('402') || lower.includes('quota') || lower.includes('credits')) {
    return "Quota d'analyse temporairement atteint. Réessaie plus tard.";
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return "Le site est introuvable. Vérifie l'URL et réessaie.";
  }
  // Fallback générique - on évite d'exposer "Firecrawl" et les détails techniques
  return "L'analyse de ce site a échoué. Le domaine est-il public et accessible ?";
}

// Pipeline scraping complet : map → sélection → scrape parallèle.
// Erreurs réseau ou quota : ScrapingError remonte au handler Fastify.
export async function scrapeUrl(rootUrl: string): Promise<ScrapeResult> {
  const url = new URL(rootUrl);
  const domain = url.host;

  // 1. Découverte des URLs candidates
  let mapped: { links?: { url: string }[] };
  try {
    mapped = (await client.map(rootUrl, { limit: MAP_LIMIT })) as {
      links?: { url: string }[];
    };
  } catch (err) {
    const raw = (err as Error).message;
    // Log brut côté serveur pour debug, message friendly côté user
    console.error(`Firecrawl /map error for ${rootUrl}:`, raw);
    throw new ScrapingError(userFriendlyScrapingMessage(raw));
  }

  const links = (mapped.links ?? []).map((l) => l.url).filter(Boolean);
  if (links.length === 0) {
    throw new ScrapingError(
      "Ce site est inaccessible ou ne renvoie aucune page publique. Vérifie l'URL.",
      404,
    );
  }

  const pagesToScrape = pickPagesToScrape(rootUrl, links);
  if (pagesToScrape.length === 0) {
    throw new ScrapingError("Aucune page du site n'a pu être identifiée pour l'analyse.", 404);
  }

  // 2. Scrape parallèle - on tolère les échecs individuels (ex. page 403/404)
  // mais on échoue globalement si TOUTES les pages échouent.
  const scrapeResults = await Promise.allSettled(
    pagesToScrape.map(async (pageUrl) => {
      const doc = (await client.scrape(pageUrl, { formats: ['markdown'] })) as {
        markdown?: string;
        metadata?: { title?: string };
      };
      const page: ScrapedPage = {
        url: pageUrl,
        markdown: doc.markdown ?? '',
        title: doc.metadata?.title ?? null,
      };
      return page;
    }),
  );

  const pages = scrapeResults
    .filter((r): r is PromiseFulfilledResult<ScrapedPage> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (pages.length === 0) {
    const reasons = scrapeResults
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason as Error).message)
      .slice(0, 3)
      .join(' ; ');
    console.error(`All scrape attempts failed for ${rootUrl}:`, reasons);
    throw new ScrapingError(
      "Le contenu de ce site n'a pas pu être récupéré. Le site bloque peut-être les outils d'analyse.",
      502,
    );
  }

  return { pages, domain };
}
