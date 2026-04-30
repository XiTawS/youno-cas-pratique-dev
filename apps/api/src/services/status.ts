import type { AnalysisStatus, Signals } from '@youno/shared/schemas/signals';

// Calcule le statut qualitatif déterministe à partir des signaux maturity.
// Pas de LLM ici : la logique reste transparente, debuggable et reproductible.
// Voir ADR-013.
//
// Règle : on compte combien des 4 signaux clés de maturité sont présents.
// 4/4 → mature        (boîte structurée, prête à acheter du Revenue Engineering)
// 3/4 → good_timing   (signaux solides, fenêtre opportune)
// 1-2/4 → to_watch    (early but moving, garder un œil)
// 0/4 → too_early     (pas encore le moment)
export function computeStatus(signals: Signals): AnalysisStatus {
  const m = signals.maturity;
  const hasPricing = signals.salesMotion.pricingPublic;
  const hasCustomers = m.customersPage || (m.clientLogosCount ?? 0) > 0;
  const hasActiveBlog = m.blogActive;
  const hasHiring = m.salesMarketingHiring;

  const count = [hasPricing, hasCustomers, hasActiveBlog, hasHiring].filter(Boolean).length;

  if (count === 4) return 'mature';
  if (count === 3) return 'good_timing';
  if (count >= 1) return 'to_watch';
  return 'too_early';
}
