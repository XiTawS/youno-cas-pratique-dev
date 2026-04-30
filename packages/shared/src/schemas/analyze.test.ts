import { describe, expect, it } from 'vitest';
import { analyzeRequestSchema } from './analyze.js';

describe('analyzeRequestSchema', () => {
  it('accepte une URL https complète et la garde telle quelle', () => {
    const result = analyzeRequestSchema.parse({ url: 'https://stripe.com' });
    expect(result.url).toBe('https://stripe.com');
  });

  it('accepte une URL http complète et la garde telle quelle', () => {
    const result = analyzeRequestSchema.parse({ url: 'http://example.com' });
    expect(result.url).toBe('http://example.com');
  });

  it('préfixe https:// quand le protocole est absent', () => {
    const result = analyzeRequestSchema.parse({ url: 'tec6.fr' });
    expect(result.url).toBe('https://tec6.fr');
  });

  it('préfixe https:// pour un domaine www.', () => {
    const result = analyzeRequestSchema.parse({ url: 'www.cal.com' });
    expect(result.url).toBe('https://www.cal.com');
  });

  it('garde le path/query après normalisation', () => {
    const result = analyzeRequestSchema.parse({ url: 'stripe.com/pricing' });
    expect(result.url).toBe('https://stripe.com/pricing');
  });

  it('trim les espaces avant normalisation', () => {
    const result = analyzeRequestSchema.parse({ url: '  tec6.fr  ' });
    expect(result.url).toBe('https://tec6.fr');
  });

  it('rejette une string vide', () => {
    const result = analyzeRequestSchema.safeParse({ url: '' });
    expect(result.success).toBe(false);
  });

  it('rejette une saisie qui ne ressemble pas à un domaine valide', () => {
    const result = analyzeRequestSchema.safeParse({ url: 'pas une url' });
    expect(result.success).toBe(false);
  });

  it('rejette un protocole autre que http(s)', () => {
    const result = analyzeRequestSchema.safeParse({ url: 'ftp://example.com' });
    expect(result.success).toBe(false);
  });

  it('idempotent : passer une URL déjà transformée donne le même résultat', () => {
    const first = analyzeRequestSchema.parse({ url: 'tec6.fr' });
    const second = analyzeRequestSchema.parse({ url: first.url });
    expect(second.url).toBe(first.url);
  });
});
