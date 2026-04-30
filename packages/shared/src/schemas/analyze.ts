import { z } from 'zod';

// Body de POST /api/analyze - une seule URL en input.
// On force https://www.example.com style. Pas d'URLs IP, pas de schéma autre.
// (Firecrawl gère http/https mais on canonise pour limiter les surprises côté
// scraping et cache par domaine plus tard.)
const HTTP_OR_HTTPS_URL = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export const analyzeRequestSchema = z.object({
  url: z
    .string()
    .url('URL invalide')
    .regex(HTTP_OR_HTTPS_URL, 'URL doit utiliser http:// ou https://'),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

// Une page scrappée (sous-élément de la réponse).
export const scrapedPageSchema = z.object({
  url: z.string().url(),
  // Markdown LLM-ready produit par Firecrawl (peut être vide si la page est
  // bloquée ou redirigée, on garde quand même la trace).
  markdown: z.string(),
  // Titre extrait par Firecrawl, optionnel (certaines pages n'ont pas de title).
  title: z.string().nullable(),
});

export type ScrapedPage = z.infer<typeof scrapedPageSchema>;

// Réponse de POST /api/analyze - en J2, pas encore de signaux ni de score (J3).
export const analyzeResponseSchema = z.object({
  url: z.string().url(),
  // Domaine extrait pour cache et lookup futur (ex. "stripe.com" depuis "https://stripe.com/pricing").
  domain: z.string().min(1),
  pages: z.array(scrapedPageSchema).min(1),
  // Liste de noms de technologies détectées par Wappalyzer (ex. "React", "Stripe", "Google Analytics").
  techStack: z.array(z.string()),
  // Timestamp ISO 8601 du début du scraping côté serveur.
  scrapedAt: z.string().datetime(),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
