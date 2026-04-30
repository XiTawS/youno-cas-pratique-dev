import type { Signals } from '@youno/shared/schemas/signals';
import { describe, expect, it } from 'vitest';
import { computeStatus } from './status.js';

// Factory pour construire des signaux complets en partant d'un override partiel.
// Évite la verbosité dans chaque test - voir SignalsSchema pour la structure.
function makeSignals(
  maturity: Partial<Signals['maturity']>,
  salesMotion?: Partial<Signals['salesMotion']>,
): Signals {
  return {
    company: { name: 'Acme', description: 'Test', sector: null, approximateSize: 'unknown' },
    salesMotion: {
      pricingPublic: false,
      primaryCta: 'demo',
      freeTrial: false,
      model: 'Sales-led',
      ...salesMotion,
    },
    maturity: {
      clientLogosCount: null,
      customersPage: false,
      blogActive: false,
      blogLastPostHint: null,
      salesMarketingHiring: false,
      ...maturity,
    },
    icp: {
      segment: 'SMB',
      targetRoles: [],
      verticals: [],
      geography: null,
    },
    techStack: [],
    recommendation: 'Test recommendation',
  };
}

describe('computeStatus', () => {
  it('retourne too_early quand aucun signal de maturité', () => {
    const signals = makeSignals({});
    expect(computeStatus(signals)).toBe('too_early');
  });

  it('retourne to_watch avec 1 seul signal (pricing public uniquement)', () => {
    const signals = makeSignals({}, { pricingPublic: true });
    expect(computeStatus(signals)).toBe('to_watch');
  });

  it('retourne to_watch avec 2 signaux', () => {
    const signals = makeSignals({ blogActive: true }, { pricingPublic: true });
    expect(computeStatus(signals)).toBe('to_watch');
  });

  it('retourne good_timing avec 3 signaux', () => {
    const signals = makeSignals(
      { blogActive: true, salesMarketingHiring: true },
      { pricingPublic: true },
    );
    expect(computeStatus(signals)).toBe('good_timing');
  });

  it('retourne mature quand les 4 signaux sont présents', () => {
    const signals = makeSignals(
      {
        customersPage: true,
        blogActive: true,
        salesMarketingHiring: true,
      },
      { pricingPublic: true },
    );
    expect(computeStatus(signals)).toBe('mature');
  });

  it('compte hasCustomers via clientLogosCount > 0 même sans customersPage', () => {
    const signals = makeSignals({ customersPage: false, clientLogosCount: 12 });
    // 1 signal sur 4 (logos > 0)
    expect(computeStatus(signals)).toBe('to_watch');
  });

  it('clientLogosCount=0 et customersPage=false ne compte pas comme client', () => {
    const signals = makeSignals({ clientLogosCount: 0, customersPage: false });
    expect(computeStatus(signals)).toBe('too_early');
  });

  it('clientLogosCount=null traité comme 0', () => {
    const signals = makeSignals({ clientLogosCount: null, customersPage: false });
    expect(computeStatus(signals)).toBe('too_early');
  });

  it('hasCustomers déclenché par customersPage=true même sans logos', () => {
    const signals = makeSignals({ customersPage: true, clientLogosCount: null });
    expect(computeStatus(signals)).toBe('to_watch');
  });

  it('est déterministe - mêmes inputs → même output', () => {
    const signals = makeSignals({ customersPage: true, blogActive: true }, { pricingPublic: true });
    const a = computeStatus(signals);
    const b = computeStatus(signals);
    const c = computeStatus(signals);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBe('good_timing');
  });
});
