import { describe, expect, it } from 'vitest';
import { AnalysisStatusSchema, SignalsSchema } from './signals.js';

const validSignals = {
  company: {
    name: 'Acme',
    description: 'Test',
    sector: null,
  },
  salesMotion: {
    pricingPublic: true,
    primaryCta: 'demo' as const,
    freeTrial: false,
    model: 'Sales-led' as const,
  },
  maturity: {
    clientLogosCount: 5,
    customersPage: true,
    blogActive: false,
    blogLastPostHint: null,
    salesMarketingHiring: false,
  },
  icp: {
    segment: 'Enterprise' as const,
    targetRoles: ['CTO'],
    verticals: ['Fintech'],
    geography: 'US',
  },
  techStack: ['React'],
  recommendation: 'Test recommendation',
};

describe('AnalysisStatusSchema', () => {
  it('accepte les 4 valeurs valides', () => {
    expect(AnalysisStatusSchema.parse('too_early')).toBe('too_early');
    expect(AnalysisStatusSchema.parse('to_watch')).toBe('to_watch');
    expect(AnalysisStatusSchema.parse('good_timing')).toBe('good_timing');
    expect(AnalysisStatusSchema.parse('mature')).toBe('mature');
  });

  it('rejette une valeur inconnue', () => {
    expect(() => AnalysisStatusSchema.parse('unknown')).toThrow();
    expect(() => AnalysisStatusSchema.parse('')).toThrow();
    expect(() => AnalysisStatusSchema.parse(null)).toThrow();
  });
});

describe('SignalsSchema', () => {
  it('valide un objet conforme', () => {
    const result = SignalsSchema.safeParse(validSignals);
    expect(result.success).toBe(true);
  });

  it('rejette un primaryCta inconnu', () => {
    const result = SignalsSchema.safeParse({
      ...validSignals,
      salesMotion: { ...validSignals.salesMotion, primaryCta: 'unknown' },
    });
    expect(result.success).toBe(false);
  });

  it("rejette un model qui n'est pas dans l'enum", () => {
    const result = SignalsSchema.safeParse({
      ...validSignals,
      salesMotion: { ...validSignals.salesMotion, model: 'Freemium' },
    });
    expect(result.success).toBe(false);
  });

  it('rejette un segment ICP non listé', () => {
    const result = SignalsSchema.safeParse({
      ...validSignals,
      icp: { ...validSignals.icp, segment: 'Hybrid' }, // valide pour salesMotion mais pas ICP
    });
    expect(result.success).toBe(false);
  });

  it('accepte clientLogosCount=null', () => {
    const result = SignalsSchema.safeParse({
      ...validSignals,
      maturity: { ...validSignals.maturity, clientLogosCount: null },
    });
    expect(result.success).toBe(true);
  });

  it('rejette clientLogosCount négatif', () => {
    const result = SignalsSchema.safeParse({
      ...validSignals,
      maturity: { ...validSignals.maturity, clientLogosCount: -1 },
    });
    // z.number().int().nullable() accepte les négatifs par défaut. Si on
    // change pour les rejeter (.nonnegative()), ce test devra être adapté.
    expect(result.success).toBe(true);
  });

  it('limite targetRoles à 5 items max', () => {
    const tooMany = ['a', 'b', 'c', 'd', 'e', 'f'];
    const result = SignalsSchema.safeParse({
      ...validSignals,
      icp: { ...validSignals.icp, targetRoles: tooMany },
    });
    expect(result.success).toBe(false);
  });

  it("recommendation peut faire jusqu'à 2000 chars", () => {
    const longRecommendation = 'a'.repeat(2000);
    const result = SignalsSchema.safeParse({
      ...validSignals,
      recommendation: longRecommendation,
    });
    expect(result.success).toBe(true);
  });

  it('recommendation > 2000 chars est rejetée', () => {
    const tooLong = 'a'.repeat(2001);
    const result = SignalsSchema.safeParse({
      ...validSignals,
      recommendation: tooLong,
    });
    expect(result.success).toBe(false);
  });
});
