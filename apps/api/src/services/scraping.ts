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
    throw new ScrapingError(`Firecrawl /map a échoué pour ${rootUrl}: ${(err as Error).message}`);
  }

  const links = (mapped.links ?? []).map((l) => l.url).filter(Boolean);
  if (links.length === 0) {
    throw new ScrapingError(
      `Aucune page découverte pour ${rootUrl} - le domaine est-il accessible publiquement ?`,
      404,
    );
  }

  const pagesToScrape = pickPagesToScrape(rootUrl, links);
  if (pagesToScrape.length === 0) {
    throw new ScrapingError(
      `Aucune page du domaine ${url.host} dans les résultats /map (${links.length} liens hors-domaine)`,
      404,
    );
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
    throw new ScrapingError(`Aucune page scrappée avec succès. Causes: ${reasons}`, 502);
  }

  return { pages, domain };
}
