import Firecrawl from '@mendable/firecrawl-js';
import type { ScrapedPage } from '@youno/shared/schemas/analyze';
import { env } from '../lib/env.js';

// Stratégie de sélection des pages à scraper.
// Map peut retourner des centaines d'URLs (sitemap entier) ; on en garde au
// max 5 pour économiser les credits Firecrawl (1 credit par /scrape).
// On priorise les pages "GTM-révélatrices" : pricing, customers, about,
// careers, /. Le reste est rempli par les premiers résultats du map.
const PAGE_PRIORITY_PATTERNS = [
  /\/pricing\/?$/i,
  /\/customers\/?$/i,
  /\/about\/?$/i,
  /\/careers\/?$/i,
  /\/jobs\/?$/i,
  /\/products?\/?$/i,
];

const MAX_PAGES_TO_SCRAPE = 5;
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

// Compare deux hosts en ignorant le préfixe www. - Firecrawl normalise souvent
// "https://www.cal.com" → "cal.com" dans les résultats /map.
function hostMatches(a: string, b: string): boolean {
  const strip = (h: string) => h.replace(/^www\./i, '').toLowerCase();
  return strip(a) === strip(b);
}

// Sélectionne 3-5 URLs pertinentes parmi celles découvertes par /map.
// Algo : 1) home (la plus courte URL valide du domaine), 2) pages prioritaires
// par pattern, 3) compléter avec les premiers résultats jusqu'à MAX_PAGES_TO_SCRAPE.
export function pickPagesToScrape(rootUrl: string, mapLinks: string[]): string[] {
  const rootHost = new URL(rootUrl).host;
  const sameHost = mapLinks.filter((u) => {
    try {
      return hostMatches(new URL(u).host, rootHost);
    } catch {
      return false;
    }
  });

  const picked = new Set<string>();

  // 1. Home : la plus courte URL avec path "/" ou vide
  const home =
    sameHost.find((u) => {
      try {
        const p = new URL(u).pathname;
        return p === '/' || p === '';
      } catch {
        return false;
      }
    }) ?? sameHost[0];
  if (home) picked.add(home);

  // 2. Pages prioritaires par pattern
  for (const pattern of PAGE_PRIORITY_PATTERNS) {
    if (picked.size >= MAX_PAGES_TO_SCRAPE) break;
    const match = sameHost.find((u) => {
      try {
        return pattern.test(new URL(u).pathname);
      } catch {
        return false;
      }
    });
    if (match) picked.add(match);
  }

  // 3. Compléter avec les premiers résultats si encore de la place
  for (const u of sameHost) {
    if (picked.size >= MAX_PAGES_TO_SCRAPE) break;
    picked.add(u);
  }

  return Array.from(picked);
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
