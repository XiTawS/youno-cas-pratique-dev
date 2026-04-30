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
  type: z
    .enum(['self_serve', 'sales_led', 'hybrid', 'unknown'])
    .describe(
      "Comment l'entreprise vend SON PRODUIT. self_serve = signup direct sans contact commercial. sales_led = obligation de contact commercial / demo avant achat. hybrid = les deux options coexistent. unknown si non déterminable.",
    ),
  evidence: z
    .string()
    .nullable()
    .describe(
      'Citation textuelle (max 200 chars) du markdown qui justifie le type. null si pas trouvé.',
    ),
  pricingPubliclyVisible: z.boolean().describe('true si une page /pricing affiche des tarifs.'),
  freeTrialOrFreemium: z.boolean().describe('true si free trial ou tier gratuit mentionné.'),
  bookDemoOrTalkToSales: z.boolean().describe('true si CTA "Book a demo" ou "Contact sales".'),
});

export type SalesMotion = z.infer<typeof salesMotionSchema>;

// Axe 2 : signaux de croissance / d'achat
// → guide le timing de la prospection
export const growthSignalsSchema = z.object({
  hiringActively: z.boolean().describe('true si page /careers ou /jobs vue avec ≥1 poste ouvert.'),
  hiringRoles: z
    .array(z.string())
    .max(10)
    .describe('Intitulés exacts vus sur /careers (max 10). [] si pas de careers vu.'),
  recentNewsOrLaunches: z
    .array(z.string())
    .max(5)
    .describe('News / launches récents depuis /blog ou home (max 5). [] si rien de pertinent.'),
  customerLogosCount: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Nombre de logos clients visibles sur home / /customers. 0 si rien vu.'),
  rolesIndicatingGtm: z
    .array(z.enum(['sales', 'marketing', 'rev_ops', 'sdr_bdr', 'customer_success', 'growth']))
    .describe(
      "Catégories de roles GTM trouvées dans les hires - signal qu'ils investissent en GTM. [] si aucun.",
    ),
});

export type GrowthSignals = z.infer<typeof growthSignalsSchema>;

// Axe 3 : ICP fit (à qui ils vendent)
// → guide la qualification "est-ce que je perds mon temps ?"
export const icpFitSchema = z.object({
  targetSegment: z
    .enum(['smb', 'mid_market', 'enterprise', 'developer', 'consumer', 'unknown'])
    .describe(
      "Segment de TAILLE D'ENTREPRISE ciblé. smb = small business. mid_market = entreprises moyennes. enterprise = grandes entreprises (Fortune 500 etc.). developer = produit pour devs individuels (DX-first). consumer = B2C. unknown si non déterminable. ATTENTION : ce n'est PAS la même chose que sales motion (pas de valeur 'hybrid' ici).",
    ),
  targetRoles: z
    .array(z.string())
    .max(10)
    .describe('Rôles cibles libres (ex. "Product Managers", "Engineers", "Founders").'),
  industryFocus: z
    .array(z.string())
    .max(10)
    .describe('Verticals si mentionnés (ex. "SaaS", "fintech"). [] si non mentionné.'),
  geographicFocus: z
    .array(z.string())
    .max(10)
    .describe('Géographies si mentionnées (ex. "US", "Europe"). [] si non mentionné.'),
});

export type IcpFit = z.infer<typeof icpFitSchema>;

// Schema agrégé - ce que le LLM doit produire en un seul tool call.
export const gtmSignalsSchema = z.object({
  salesMotion: salesMotionSchema.describe('AXE 1 : comment cette entreprise vend son produit.'),
  growthSignals: growthSignalsSchema.describe('AXE 2 : signaux de croissance / momentum / hiring.'),
  icpFit: icpFitSchema.describe(
    'AXE 3 : à QUI cette entreprise vend (taille, rôles, verticals). NE PAS confondre avec axe 1.',
  ),
  extractionConfidence: z
    .enum(['high', 'medium', 'low'])
    .describe(
      'Auto-évaluation : high si markdown riche, medium si partiel, low si très pauvre ou bloqué.',
    ),
  notesForSdr: z
    .string()
    .max(500)
    .describe(
      "Résumé actionnable pour le SDR en 1-3 phrases (ex. 'Hiring 5 SDRs en EMEA, signal d'expansion fort. Sales-led, ICP enterprise.'). FR ou EN.",
    ),
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
