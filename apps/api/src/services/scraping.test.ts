import { describe, expect, it } from 'vitest';
// Importe directement le fichier d'utilitaires purs pour ne pas charger env
// (qui ferait fail-fast en environnement de test sans variables).
import { pickPagesToScrape } from './scraping-utils.js';

describe('pickPagesToScrape', () => {
  it('inclut la home (path "/" ou vide) en premier', () => {
    const result = pickPagesToScrape('https://example.com', [
      'https://example.com/blog/article-1',
      'https://example.com/',
      'https://example.com/about',
    ]);
    expect(result[0]).toBe('https://example.com/');
  });

  it('priorise /pricing, /customers, /about, /careers, /jobs, /products', () => {
    const result = pickPagesToScrape('https://acme.com', [
      'https://acme.com/random-page',
      'https://acme.com/blog/post-1',
      'https://acme.com/pricing',
      'https://acme.com/customers',
      'https://acme.com/legal',
    ]);
    expect(result).toContain('https://acme.com/pricing');
    expect(result).toContain('https://acme.com/customers');
  });

  it('limite à 5 pages maximum', () => {
    const links = Array.from({ length: 20 }, (_, i) => `https://example.com/page-${i}`);
    const result = pickPagesToScrape('https://example.com', links);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("filtre les URLs hors du domaine de l'URL racine", () => {
    const result = pickPagesToScrape('https://acme.com', [
      'https://acme.com/',
      'https://acme.com/pricing',
      'https://other.com/page',
      'https://different.io/something',
    ]);
    expect(result).not.toContain('https://other.com/page');
    expect(result).not.toContain('https://different.io/something');
  });

  it('matche les domaines avec et sans www. (Firecrawl normalise souvent)', () => {
    // rootUrl utilise www., les links retournés par Firecrawl sont sans www.
    const result = pickPagesToScrape('https://www.cal.com', [
      'https://cal.com/',
      'https://cal.com/pricing',
      'https://cal.com/about',
    ]);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('https://cal.com/');
  });

  it('retourne un array vide si aucun lien du même domaine', () => {
    const result = pickPagesToScrape('https://acme.com', [
      'https://other.com/',
      'https://different.io/',
    ]);
    expect(result).toEqual([]);
  });

  it('déduplique - jamais deux fois la même URL', () => {
    const result = pickPagesToScrape('https://example.com', [
      'https://example.com/',
      'https://example.com/pricing',
      'https://example.com/pricing', // doublon
      'https://example.com/about',
    ]);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('ignore les URLs malformées sans crasher', () => {
    const result = pickPagesToScrape('https://example.com', [
      'https://example.com/',
      'not-a-valid-url',
      '',
      'https://example.com/pricing',
    ]);
    expect(result).toContain('https://example.com/');
    expect(result).toContain('https://example.com/pricing');
  });
});
