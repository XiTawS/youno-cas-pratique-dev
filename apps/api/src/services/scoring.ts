import type { GtmSignals, ScoreBreakdown } from '@youno/shared/schemas/signals';

// Formule "Maturité GTM" /100, transparente et auditable.
// Voir docs/99-decisions.md ADR-010 pour la justification des pondérations.
//
// 4 buckets, total = 100 :
// - Sales motion clair      → max 20 pts
// - Growth signals          → max 40 pts (le plus pondéré : timing-driven la prospection)
// - ICP fit lisibilité      → max 25 pts
// - Tech stack maturité     → max 15 pts (signal faible mais factuel)

// Heuristiques de classification du tech stack par catégorie.
// Pas exhaustif, on prend les acteurs les plus répandus 2026.
const CRM_VENDORS = ['hubspot', 'salesforce', 'pipedrive', 'zoho', 'attio', 'close', 'copper'];
const ANALYTICS_VENDORS = [
  'google analytics',
  'mixpanel',
  'amplitude',
  'segment',
  'posthog',
  'plausible',
  'fathom',
  'heap',
];
const PAYMENT_VENDORS = [
  'stripe',
  'paddle',
  'lemonsqueezy',
  'lemon squeezy',
  'chargebee',
  'recurly',
];

function containsAny(techStack: string[], vendors: string[]): string | null {
  const stackLower = techStack.map((t) => t.toLowerCase());
  for (const vendor of vendors) {
    const found = stackLower.find((t) => t.includes(vendor));
    if (found) return found;
  }
  return null;
}

// Calcule un bucket avec earned + max + reasons textuelles.
// Les reasons sont retournées telles quelles à l'UI pour transparence.
function bucket<TMax extends number>(
  earned: number,
  max: TMax,
  reasons: string[],
): { earned: number; max: TMax; reasons: string[] } {
  return { earned: Math.max(0, Math.min(earned, max)), max, reasons };
}

export function computeScore(signals: GtmSignals, techStack: string[]): ScoreBreakdown {
  // === Bucket 1 : Sales motion clair (max 20) ===
  let salesPoints = 0;
  const salesReasons: string[] = [];

  if (signals.salesMotion.type !== 'unknown') {
    salesPoints += 10;
    salesReasons.push(`+10 sales motion identifié : ${signals.salesMotion.type}`);
  } else {
    salesReasons.push('+0 sales motion non identifié');
  }

  if (signals.salesMotion.pricingPubliclyVisible || signals.salesMotion.freeTrialOrFreemium) {
    salesPoints += 10;
    const reason = signals.salesMotion.pricingPubliclyVisible
      ? 'pricing public visible'
      : 'free trial / freemium dispo';
    salesReasons.push(`+10 friction d'achat basse (${reason})`);
  } else {
    salesReasons.push('+0 pas de pricing public ni free trial visible');
  }

  // === Bucket 2 : Growth signals (max 40) ===
  let growthPoints = 0;
  const growthReasons: string[] = [];

  if (signals.growthSignals.hiringActively) {
    growthPoints += 15;
    growthReasons.push(`+15 hiring actif (${signals.growthSignals.hiringRoles.length} rôles vus)`);
  } else {
    growthReasons.push('+0 pas de signal hiring détecté');
  }

  // 5 pts par role GTM jusqu'à 15 max
  const gtmRolesCount = signals.growthSignals.rolesIndicatingGtm.length;
  if (gtmRolesCount > 0) {
    const pts = Math.min(gtmRolesCount * 5, 15);
    growthPoints += pts;
    growthReasons.push(
      `+${pts} ${gtmRolesCount} rôle(s) GTM détecté(s) : ${signals.growthSignals.rolesIndicatingGtm.join(', ')}`,
    );
  } else {
    growthReasons.push('+0 pas de rôle GTM identifié dans les hires');
  }

  if (signals.growthSignals.customerLogosCount >= 5) {
    growthPoints += 10;
    growthReasons.push(
      `+10 ${signals.growthSignals.customerLogosCount} logos clients visibles (≥ 5 = traction confirmée)`,
    );
  } else {
    growthReasons.push(
      `+0 ${signals.growthSignals.customerLogosCount} logos clients (< 5 = traction faible ou non exposée)`,
    );
  }

  // === Bucket 3 : ICP fit lisibilité (max 25) ===
  let icpPoints = 0;
  const icpReasons: string[] = [];

  if (signals.icpFit.targetSegment !== 'unknown') {
    icpPoints += 10;
    icpReasons.push(`+10 segment cible identifié : ${signals.icpFit.targetSegment}`);
  } else {
    icpReasons.push('+0 segment cible non identifié');
  }

  if (signals.icpFit.targetRoles.length >= 1) {
    icpPoints += 10;
    icpReasons.push(
      `+10 rôles cibles identifiés : ${signals.icpFit.targetRoles.slice(0, 3).join(', ')}${signals.icpFit.targetRoles.length > 3 ? '…' : ''}`,
    );
  } else {
    icpReasons.push('+0 pas de rôle cible explicite');
  }

  if (signals.icpFit.industryFocus.length >= 1) {
    icpPoints += 5;
    icpReasons.push(`+5 vertical focus : ${signals.icpFit.industryFocus.join(', ')}`);
  } else {
    icpReasons.push('+0 pas de vertical focus déclaré');
  }

  // === Bucket 4 : Tech stack maturité (max 15) ===
  let techPoints = 0;
  const techReasons: string[] = [];

  const crm = containsAny(techStack, CRM_VENDORS);
  if (crm) {
    techPoints += 5;
    techReasons.push(`+5 CRM détecté (${crm})`);
  } else {
    techReasons.push('+0 pas de CRM détecté par Wappalyzer');
  }

  const analytics = containsAny(techStack, ANALYTICS_VENDORS);
  if (analytics) {
    techPoints += 5;
    techReasons.push(`+5 analytics produit détecté (${analytics})`);
  } else {
    techReasons.push("+0 pas d'analytics produit détecté");
  }

  const payment = containsAny(techStack, PAYMENT_VENDORS);
  if (payment) {
    techPoints += 5;
    techReasons.push(`+5 payment / billing détecté (${payment})`);
  } else {
    techReasons.push('+0 pas de payment / billing détecté');
  }

  // === Total ===
  const total = salesPoints + growthPoints + icpPoints + techPoints;

  return {
    salesMotion: bucket(salesPoints, 20, salesReasons),
    growth: bucket(growthPoints, 40, growthReasons),
    icpFit: bucket(icpPoints, 25, icpReasons),
    techStack: bucket(techPoints, 15, techReasons),
    total,
  };
}
