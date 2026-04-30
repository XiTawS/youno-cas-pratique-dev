import { z } from 'zod';

// Schéma des signaux GTM extraits par Claude depuis le markdown + tech stack.
//
// Source de vérité unique : utilisé pour
// - le tool input schema Claude (extraction forcée conforme)
// - la validation runtime côté API après l'appel
// - la persistance JSONB en DB (table `analyses.signals`)
// - les types côté front
//
// Toute modif casse 4 endroits, valider l'impact avant.

// Axe 1 : comment ils vendent (sales motion)
// → guide la stratégie d'approche du SDR Konsole
export const salesMotionSchema = z.object({
  type: z.enum(['self_serve', 'sales_led', 'hybrid', 'unknown']),
  // Citation textuelle du site qui justifie le verdict (anti-hallucination).
  evidence: z.string().nullable(),
  pricingPubliclyVisible: z.boolean(),
  freeTrialOrFreemium: z.boolean(),
  bookDemoOrTalkToSales: z.boolean(),
});

export type SalesMotion = z.infer<typeof salesMotionSchema>;

// Axe 2 : signaux de croissance / d'achat
// → guide le timing de la prospection
export const growthSignalsSchema = z.object({
  hiringActively: z.boolean(),
  // Intitulés exacts vus sur /careers ou /jobs (max 10 pour limiter le bruit).
  hiringRoles: z.array(z.string()).max(10),
  // News / launches récents depuis /blog ou home.
  recentNewsOrLaunches: z.array(z.string()).max(5),
  // Nombre de logos clients visibles sur la home / /customers.
  customerLogosCount: z.number().int().min(0).max(100),
  // Catégories de roles GTM dans les hires - signal qu'ils investissent.
  rolesIndicatingGtm: z.array(
    z.enum(['sales', 'marketing', 'rev_ops', 'sdr_bdr', 'customer_success', 'growth']),
  ),
});

export type GrowthSignals = z.infer<typeof growthSignalsSchema>;

// Axe 3 : ICP fit (à qui ils vendent)
// → guide la qualification "est-ce que je perds mon temps ?"
export const icpFitSchema = z.object({
  targetSegment: z.enum(['smb', 'mid_market', 'enterprise', 'developer', 'consumer', 'unknown']),
  // Roles cibles libres (ex. "marketing teams", "engineers", "founders").
  targetRoles: z.array(z.string()).max(10),
  // Verticals si mentionnés (ex. "SaaS", "fintech", "healthcare").
  industryFocus: z.array(z.string()).max(10),
  // Géographies si mentionnées (ex. "US", "Europe", "Global").
  geographicFocus: z.array(z.string()).max(10),
});

export type IcpFit = z.infer<typeof icpFitSchema>;

// Schema agrégé - ce que le LLM doit produire en un seul tool call.
export const gtmSignalsSchema = z.object({
  salesMotion: salesMotionSchema,
  growthSignals: growthSignalsSchema,
  icpFit: icpFitSchema,
  // Auto-évaluation du LLM - mappée sur extractionConfidence côté UI.
  extractionConfidence: z.enum(['high', 'medium', 'low']),
  // Résumé actionnable libre court à destination du SDR (1-3 phrases).
  notesForSdr: z.string().max(500),
});

export type GtmSignals = z.infer<typeof gtmSignalsSchema>;

// Détail du score Maturité GTM (4 buckets) - retourné avec le score total
// pour transparence et auditabilité (talking point en restitution).
export const scoreBreakdownSchema = z.object({
  salesMotion: z.object({
    earned: z.number().int().min(0).max(20),
    max: z.literal(20),
    reasons: z.array(z.string()),
  }),
  growth: z.object({
    earned: z.number().int().min(0).max(40),
    max: z.literal(40),
    reasons: z.array(z.string()),
  }),
  icpFit: z.object({
    earned: z.number().int().min(0).max(25),
    max: z.literal(25),
    reasons: z.array(z.string()),
  }),
  techStack: z.object({
    earned: z.number().int().min(0).max(15),
    max: z.literal(15),
    reasons: z.array(z.string()),
  }),
  total: z.number().int().min(0).max(100),
});

export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;
