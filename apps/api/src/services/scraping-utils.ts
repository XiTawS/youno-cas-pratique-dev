// Utilitaires purs pour le pipeline scraping - séparés du fichier principal
// pour pouvoir être testés sans charger les envs (Firecrawl client init).

// Stratégie de sélection des pages à scraper.
// Map peut retourner des centaines d'URLs (sitemap entier) ; on en garde au
// max 5 pour économiser les credits Firecrawl (1 credit par /scrape).
const PAGE_PRIORITY_PATTERNS = [
  /\/pricing\/?$/i,
  /\/customers\/?$/i,
  /\/about\/?$/i,
  /\/careers\/?$/i,
  /\/jobs\/?$/i,
  /\/products?\/?$/i,
];

const MAX_PAGES_TO_SCRAPE = 5;

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

export { MAX_PAGES_TO_SCRAPE };
