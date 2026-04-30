import { z } from 'zod';
import { AnalysisStatusSchema, SignalsSchema } from './signals.js';

// Body de POST /api/analyze - une seule URL en input.
// On accepte la forme nue ("tec6.fr", "www.stripe.com/pricing") et on préfixe
// automatiquement https:// si absent. Pas d'URLs IP, pas de schéma autre.
//
// Regex validation : exige au moins un point + un TLD alphabétique de 2+ chars
// pour rejeter "https://hcbheuvguevigecge" (pas de TLD = pas un domaine plausible).
const HTTP_OR_HTTPS_URL = /^https?:\/\/([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;

export const analyzeRequestSchema = z.object({
  url: z
    .string()
    .min(1, 'URL requise')
    .transform((val) => {
      const trimmed = val.trim();
      if (!trimmed) return trimmed;
      // Si déjà un protocole quelconque → garde tel quel (la regex finale
      // rejettera tout ce qui n'est pas http/https). Sinon préfixe https://.
      if (/^[a-z][a-z0-9+\-.]*:/i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    })
    .pipe(
      z
        .string()
        .url('URL invalide')
        .regex(HTTP_OR_HTTPS_URL, 'URL doit ressembler à un domaine valide'),
    ),
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

// Pour les statuts opérationnels du pipeline (pas le statut qualitatif de
// l'analyse — voir AnalysisStatus dans signals.ts).
export const pipelineStatusSchema = z.enum(['pending', 'success', 'error']);
export type PipelineStatus = z.infer<typeof pipelineStatusSchema>;

// Réponse de POST /api/analyze - voir ADR-013 pour la refonte status / recommendation.
export const analyzeResponseSchema = z.object({
  // ID persisté en DB - sert pour /analysis/:id côté front.
  id: z.string().uuid(),
  url: z.string().url(),
  // Domaine extrait pour cache et lookup futur (ex. "stripe.com" depuis "https://stripe.com/pricing").
  domain: z.string().min(1),
  // pages peut être vide : cache hit (24h) et GET /api/analyses/:id ne re-stockent
  // pas le markdown en DB pour économiser le JSONB. Front gère l'absence.
  pages: z.array(scrapedPageSchema),
  // Signaux factuels extraits par le LLM (entreprise, sales motion, maturité, ICP, recommandation).
  signals: SignalsSchema,
  // Statut qualitatif calculé en code à partir des signaux maturity.
  status: AnalysisStatusSchema,
  // Recommandation actionnable générée par le LLM (dupliquée hors signals
  // pour query SQL facile et lecture front sans descendre dans le JSONB).
  recommendation: z.string(),
  // Timestamp ISO 8601 du début du scraping côté serveur.
  scrapedAt: z.string().datetime(),
  // true si la réponse vient du cache 24h (analyse réutilisée), false sinon.
  fromCache: z.boolean(),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

// Item compact pour la liste history.
export const analysisListItemSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  domain: z.string().min(1),
  // Statut opérationnel du pipeline (pending / success / error).
  pipelineStatus: pipelineStatusSchema,
  // Statut qualitatif - null tant que l'analyse n'est pas en success.
  status: AnalysisStatusSchema.nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type AnalysisListItem = z.infer<typeof analysisListItemSchema>;

// Réponse de GET /api/analyses (liste history).
export const analysesListResponseSchema = z.object({
  items: z.array(analysisListItemSchema),
});

export type AnalysesListResponse = z.infer<typeof analysesListResponseSchema>;
