import type { AnalyzeResponse } from '@youno/shared/schemas/analyze';
import { describe, expect, it } from 'vitest';
import { analysisToMarkdown } from './exportAnalysis';

const baseAnalysis: AnalyzeResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  url: 'https://acme.com',
  domain: 'acme.com',
  pages: [],
  status: 'good_timing',
  recommendation: 'Approchez par une demo. Mentionnez leur récente embauche de 3 SDRs comme angle.',
  scrapedAt: '2026-04-30T12:00:00.000Z',
  fromCache: false,
  signals: {
    company: {
      name: 'Acme Corp',
      description: 'Plateforme SaaS de gestion de projet pour équipes produit.',
      sector: 'B2B SaaS',
    },
    salesMotion: {
      pricingPublic: true,
      primaryCta: 'demo',
      freeTrial: true,
      model: 'Hybrid',
    },
    maturity: {
      clientLogosCount: 12,
      customersPage: true,
      blogActive: true,
      blogLastPostHint: 'avril 2026',
      salesMarketingHiring: true,
    },
    icp: {
      segment: 'Mid-market',
      targetRoles: ['Product Managers', 'Engineering Leaders'],
      verticals: ['SaaS', 'Fintech'],
      geography: 'Europe',
    },
    techStack: ['React', 'Vercel', 'HubSpot'],
    recommendation:
      'Approchez par une demo. Mentionnez leur récente embauche de 3 SDRs comme angle.',
  },
};

describe('analysisToMarkdown', () => {
  it("contient le nom de l'entreprise en H1", () => {
    const md = analysisToMarkdown(baseAnalysis);
    expect(md).toMatch(/^# Acme Corp/);
  });

  it('contient la description en blockquote', () => {
    const md = analysisToMarkdown(baseAnalysis);
    expect(md).toContain('> Plateforme SaaS de gestion de projet');
  });

  it('liste les tags secteur + segment + géographie', () => {
    const md = analysisToMarkdown(baseAnalysis);
    expect(md).toContain('B2B SaaS');
    expect(md).toContain('Mid-market');
    expect(md).toContain('Europe');
  });

  it('inclut une section Recommandation avec le texte LLM', () => {
    const md = analysisToMarkdown(baseAnalysis);
    expect(md).toContain('## Recommandation');
    expect(md).toContain('Approchez par une demo');
  });

  it('inclut les 4 sections principales', () => {
    const md = analysisToMarkdown(baseAnalysis);
    expect(md).toContain('## Comment ils vendent');
    expect(md).toContain('## Maturité commerciale');
    expect(md).toContain('## Cible visée');
    expect(md).toContain('## Stack technique');
  });

  it('mappe primaryCta du slug technique vers le libellé FR', () => {
    const md = analysisToMarkdown(baseAnalysis);
    expect(md).toContain('Demande de démo');
    expect(md).not.toContain('CTA principal** : demo'); // pas le slug brut
  });

  it('mappe le statut en libellé FR', () => {
    const md = analysisToMarkdown(baseAnalysis);
    expect(md).toContain('Bon timing');
  });

  it('omet la stack technique si vide', () => {
    const md = analysisToMarkdown({
      ...baseAnalysis,
      signals: { ...baseAnalysis.signals, techStack: [] },
    });
    expect(md).not.toContain('## Stack technique');
  });

  it('omet géographie / verticales si non renseignés', () => {
    const md = analysisToMarkdown({
      ...baseAnalysis,
      signals: {
        ...baseAnalysis.signals,
        icp: { ...baseAnalysis.signals.icp, geography: null, verticals: [] },
      },
    });
    expect(md).not.toMatch(/Géographie/);
    expect(md).not.toMatch(/Verticales/);
  });

  it('omet le hint de blog si null', () => {
    const md = analysisToMarkdown({
      ...baseAnalysis,
      signals: {
        ...baseAnalysis.signals,
        maturity: { ...baseAnalysis.signals.maturity, blogLastPostHint: null },
      },
    });
    expect(md).not.toMatch(/Dernier post/);
  });

  it('utilise oui/non en français pour les booléens', () => {
    const md = analysisToMarkdown(baseAnalysis);
    expect(md).toMatch(/Pricing public\*\* : oui/);
    expect(md).toMatch(/Free trial \/ freemium\*\* : oui/);
  });

  it('finit avec le footer Konsole', () => {
    const md = analysisToMarkdown(baseAnalysis);
    expect(md).toContain('Konsole · Cas pratique Youno');
  });
});
