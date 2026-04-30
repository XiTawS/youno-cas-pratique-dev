import { z } from 'zod';

// Source de vérité unique des signaux extraits par le LLM + statut qualitatif.
// Utilisé pour :
// - le tool input schema OpenRouter (extraction structurée forcée)
// - la validation runtime côté API après l'appel
// - la persistance JSONB en DB (table `analyses.signals`)
// - les types côté front
//
// Toute modif casse 4 endroits, valider l'impact avant. Voir ADR-013.

// Bloc "qui est cette boîte" - identification de surface.
const companySchema = z.object({
  name: z.string().describe("Nom commercial de l'entreprise tel qu'affiché sur le site."),
  description: z
    .string()
    .describe('Description courte (1-2 phrases) de ce que fait la boîte, en français.'),
  sector: z
    .string()
    .nullable()
    .describe(
      'Secteur d\'activité court (ex. "fintech", "MarTech B2B", "devtools", "e-commerce"). null si pas clair.',
    ),
  approximateSize: z
    .enum(['1-10', '11-50', '51-200', '201-1000', '1000+', 'unknown'])
    .describe(
      "Taille approximative en nombre d'employés. Estime depuis les signaux disponibles : pages /careers (volume de postes), pied de page (mention équipe), about us, série de financement, logos clients. Si totalement non déterminable, mets 'unknown'. Tranche basse plutôt qu'inventer.",
    ),
});

// Bloc "comment ils vendent" - sales motion.
const salesMotionSchema = z.object({
  pricingPublic: z.boolean().describe('true si une page /pricing affiche des tarifs publics.'),
  primaryCta: z
    .enum(['signup', 'demo', 'contact_sales', 'mixed'])
    .describe(
      "Call-to-action principal de la home. signup = inscription directe (PLG). demo = book a demo. contact_sales = parler au commercial. mixed = plusieurs CTA d'égale importance.",
    ),
  freeTrial: z.boolean().describe('true si free trial ou tier gratuit explicitement mentionné.'),
  model: z
    .enum(['PLG', 'Sales-led', 'Hybrid'])
    .describe(
      'Modèle de vente. PLG = Product-Led Growth (self-serve dominant). Sales-led = passage commercial obligatoire. Hybrid = les deux coexistent réellement.',
    ),
});

// Bloc "maturité commerciale" - signaux factuels de structuration GTM.
const maturitySchema = z.object({
  clientLogosCount: z
    .number()
    .int()
    .nullable()
    .describe('Nombre de logos clients visibles sur la home / /customers. null si non comptable.'),
  customersPage: z
    .boolean()
    .describe('true si une page /customers ou /case-studies dédiée existe.'),
  blogActive: z.boolean().describe('true si un blog avec contenu récent (< 60 jours) est visible.'),
  blogLastPostHint: z
    .string()
    .nullable()
    .describe(
      'Indice sur la fraîcheur du blog ("avril 2026", "il y a 2 semaines"). null si pas trouvé.',
    ),
  salesMarketingHiring: z
    .boolean()
    .describe('true si /careers ou /jobs liste au moins un poste sales / marketing / growth.'),
});

// Bloc "cible visée" - ICP fit.
const icpSchema = z.object({
  segment: z
    .enum(['SMB', 'Mid-market', 'Enterprise', 'Mixed'])
    .describe(
      "Segment de taille d'entreprise ciblé. SMB = petites entreprises. Mid-market = moyennes. Enterprise = grands comptes (Fortune 500). Mixed = plusieurs segments adressés explicitement.",
    ),
  targetRoles: z
    .array(z.string())
    .max(5)
    .describe(
      'Rôles ciblés (ex. "Product Managers", "Engineering Leaders"). Max 5. [] si non explicite.',
    ),
  verticals: z
    .array(z.string())
    .max(5)
    .describe(
      'Verticales si explicitement mentionnées (ex. "fintech", "healthcare"). Max 5. [] sinon.',
    ),
  geography: z
    .string()
    .nullable()
    .describe('Géographie cible si explicite ("US-only", "Europe", "Global"). null sinon.'),
});

// Schema agrégé - sortie complète d'un appel LLM.
export const SignalsSchema = z.object({
  company: companySchema.describe('Identification de la boîte.'),
  salesMotion: salesMotionSchema.describe('Comment cette boîte vend son produit.'),
  maturity: maturitySchema.describe('Signaux factuels de maturité commerciale.'),
  icp: icpSchema.describe('À qui cette boîte vend (taille, rôles, verticales, géo).'),
  techStack: z
    .array(z.string())
    .describe(
      'Liste des technos détectées par Wappalyzer côté serveur. Le LLM la recopie telle quelle.',
    ),
  recommendation: z
    .string()
    .max(2000)
    .describe(
      "Recommandation actionnable pour un commercial qui prospecterait cette boîte. 2-3 phrases max. Indique l'approche commerciale (démo, free trial, contact sales) et un angle d'accroche concret basé sur les signaux les plus saillants.",
    ),
});

export type Signals = z.infer<typeof SignalsSchema>;

// Statut qualitatif - calculé en code (pas par le LLM) à partir des signaux maturity.
// 4 niveaux ordonnés du moins mature au plus mature. Voir ADR-013.
export const AnalysisStatusSchema = z.enum(['too_early', 'to_watch', 'good_timing', 'mature']);

export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;
