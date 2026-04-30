// @ts-expect-error - simple-wappalyzer n'expose pas de types TypeScript
import wappalyzer from 'simple-wappalyzer';

// User-Agent qui imite un navigateur pour éviter d'être bloqué par les WAF
// les plus paresseux. Les sites qui bloquent vraiment Node feront retomber
// detectTechStack en liste vide (graceful degradation).
const FETCH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 8000;

// Forme réelle de la réponse simple-wappalyzer (array direct, pas { applications }
// comme l'indique le README — testé sur la version 1.1.97).
interface WappalyzerApp {
  name: string;
  confidence: number;
  version: string;
}

// Récupère le HTML brut + headers + statusCode de la home, puis fait tourner
// Wappalyzer dessus. Wappalyzer signature : ({ url, html, statusCode, headers }) → result.
//
// Pourquoi un fetch séparé de Firecrawl :
// - simple-wappalyzer a besoin des response headers (Server, Set-Cookie, etc.)
//   que Firecrawl n'expose pas systématiquement
// - Une seule requête sur la home suffit pour un signal tech stack utile
// - Coût quasi nul (un fetch HTTP classique vs un credit Firecrawl)
export async function detectTechStack(rootUrl: string): Promise<string[]> {
  let html = '';
  let statusCode = 0;
  let headers: Record<string, string> = {};

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(rootUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': FETCH_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      statusCode = res.status;
      headers = Object.fromEntries(res.headers.entries());
      html = await res.text();
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Site bloque les fetches Node, timeout, DNS error : on dégrade en liste vide.
    // Le LLM en J3 saura travailler sans tech stack.
    return [];
  }

  if (!html || statusCode >= 400) {
    return [];
  }

  try {
    const result = (await wappalyzer({ url: rootUrl, html, statusCode, headers })) as
      | WappalyzerApp[]
      | undefined;
    if (!Array.isArray(result)) return [];
    // Dédup par nom (Wappalyzer peut retourner plusieurs versions du même produit)
    // et tri alphabétique stable pour la lisibilité côté front.
    const names = new Set(result.map((a) => a.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}
