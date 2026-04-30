import { z } from 'zod';
import { gtmSignalsSchema, scoreBreakdownSchema } from './signals.js';

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

// Réponse de POST /api/analyze (J3 : signals + score persistés en DB).
export const analyzeResponseSchema = z.object({
  // ID persisté en DB - sert pour /analysis/:id côté front (page Analysis J4).
  id: z.string().uuid(),
  url: z.string().url(),
  // Domaine extrait pour cache et lookup futur (ex. "stripe.com" depuis "https://stripe.com/pricing").
  domain: z.string().min(1),
  // pages peut être vide : cache hit (24h) et GET /api/analyses/:id ne re-stockent
  // pas le markdown en DB pour économiser le JSONB. Front gère l'absence.
  pages: z.array(scrapedPageSchema),
  // Liste de noms de technologies détectées par Wappalyzer (ex. "React", "Stripe", "Google Analytics").
  techStack: z.array(z.string()),
  // Signaux GTM extraits par le LLM (3 axes + métadonnées).
  signals: gtmSignalsSchema,
  // Score Maturité GTM /100 + breakdown des 4 buckets.
  score: scoreBreakdownSchema,
  // Timestamp ISO 8601 du début du scraping côté serveur.
  scrapedAt: z.string().datetime(),
  // true si la réponse vient du cache 24h (analyse réutilisée), false sinon.
  fromCache: z.boolean(),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

// Item compact pour la liste history (pas de pages markdown ni signals complets,
// juste de quoi afficher la card dans la liste).
export const analysisListItemSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  domain: z.string().min(1),
  status: z.enum(['pending', 'success', 'error']),
  scoreMaturity: z.number().int().min(0).max(100).nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type AnalysisListItem = z.infer<typeof analysisListItemSchema>;

// Réponse de GET /api/analyses (liste history).
export const analysesListResponseSchema = z.object({
  items: z.array(analysisListItemSchema),
});

export type AnalysesListResponse = z.infer<typeof analysesListResponseSchema>;
