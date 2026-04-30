# IDEE.md

## Contexte

Cas pratique technique reçu de Kaio (Youno) le 2026-04-27 dans le cadre d'une candidature pour un poste de Développeur (Alternance / Stage). Brief complet dans `docs/00-brief.md`.

Délai de livraison : 1 semaine. Temps de dev cible : 5 à 8 heures. Restitution prévue en call de 45 min avec Kaio.

## Problème

Konsole est la plateforme SaaS de Youno qui aide les équipes sales/marketing à **industrialiser leur Revenue Engineering**. Un de ses modules analyse une URL de site web et restitue des informations exploitables sur l'entreprise qui le détient.

Concrètement, un SDR Konsole reçoit une liste de prospects (URLs) et doit décider lesquels attaquer en priorité. Pour ça, il a besoin de qualifier rapidement chaque prospect sur trois questions :

1. **Comment ils vendent** (self-serve / sales-led / hybride) → comment je dois les approcher
2. **Sont-ils en croissance / en train d'acheter** → timing de la prospection
3. **Est-ce un ICP qui me correspond** → est-ce que je perds mon temps

L'app construite ici fournit une réponse structurée à ces trois questions à partir d'une URL.

## Vision (succès dans 6-12 mois)

Pour ce cas pratique, le succès est défini sur l'horizon de la restitution avec Kaio (~7-10 jours) :

- **Une URL en input → une analyse structurée et actionnable en output, en moins de 30 secondes**
- Application **déployée en ligne et accessible** sans bricolage local
- Chaque choix technique défendable en 1 phrase en restitution
- Le scoring **transparent et auditable** (formule explicite, pas de boîte noire)
- Code propre, README clair, Loom qui pitche le sens produit

À plus long terme (si le cas pratique mène à un poste et que le projet est repris en prod chez Konsole), la vision serait d'ajouter : multi-tenancy par ICP, scoring paramétrable, historique d'évolution des signaux dans le temps, intégrations CRM (HubSpot / Salesforce), webhooks de mise à jour.

## Non-objectifs

Ce que ce projet **refuse explicitement de faire**, pour rester dans le scope 5-8h et garder un MVP qui tourne :

- **Pas de tests automatisés**. Le scope ne le permet pas. Mention explicite dans le README comme "ce que j'améliorerais avec plus de temps".
- **Pas de mobile-first**. UI desktop suffit pour la démo et la restitution. Responsive correct mais pas optimisé mobile.
- **Pas d'auth complexe** (SSO entreprise, RBAC, multi-tenant). Clerk email + password (comptes créés par admin) + allowlist couvrent le besoin.
- **Pas de scraping multi-domaine ni de crawl récursif**. Une URL = une boîte = 3-5 pages clés analysées.
- **Pas de scoring paramétrable par ICP utilisateur**. Le statut qualitatif (Trop tôt / À surveiller / Bon timing / Prospect mature, voir ADR-013) est calculé avec une formule fixe ; la version paramétrable est une évolution v2 documentée.
- **Pas d'export CSV / PDF / API publique**. Stretch goal seulement si temps restant en fin de scope.
- **Pas de wrapping d'APIs tierces de data brokerage** (Clearbit, Apollo, ZoomInfo). Le brief les suggérait mais Clearbit a été sunsetée par HubSpot en avril 2025, et l'angle "j'agrège des APIs" est moins défendable que "j'extrais avec mon propre pipeline LLM". Voir ADR-009.

## Roadmap

5 jalons réalistes pour tenir les 5-8h de dev. Chaque jalon est livrable indépendamment.

### J1 — Bootstrap & deploy stub

- Init monorepo pnpm (`apps/web`, `apps/api`, `packages/shared`)
- Setup Vite + Fastify + tsconfig partagé
- Configuration Neon Postgres + Drizzle (schema vide, migration de base)
- Setup Clerk (front + back) avec allowlist email
- Premier deploy Vercel (front) + Render (API) avec endpoint `/health`
- **Critère de succès** : URL Vercel répond, URL Render répond, CORS OK, login Clerk fonctionnel

### J2 — Pipeline scraping

- Wrapper `services/scraping.ts` (Firecrawl `/map` + `/scrape` multi-pages)
- Wrapper `services/tech-stack.ts` (Wappalyzer en lib npm)
- Endpoint `POST /api/analyze` qui prend une URL et retourne le markdown brut + tech stack
- **Critère de succès** : `POST /api/analyze {url: "stripe.com"}` retourne 3-5 pages markdown + stack détectée

### J3 — Pipeline LLM & scoring

- Schema Zod des signaux GTM dans `packages/shared`
- Wrapper `services/extraction.ts` (Claude Agent SDK, 1 appel, tool use, temperature 0)
- Wrapper `services/scoring.ts` (formule Maturité GTM /100, transparente)
- Persistance des analyses en DB (table `analyses`)
- **Critère de succès** : `POST /api/analyze` retourne signaux structurés + statut qualitatif + recommandation actionnable (voir ADR-013)

### J4 — UI complète

- Page Home (input URL + bouton Analyser)
- Page Analysis (affichage statut qualitatif + recommandation + 3 cards signaux + stack technique)
- Page History (liste des analyses passées de l'utilisateur)
- Loading states, error handling
- **Critère de succès** : démo end-to-end fluide sur 3 URLs (Stripe, Linear, une early-stage)

### J5 — Polish & livrables

- Rédaction du README final (choix techniques, démarrage, limites, évolutions)
- Enregistrement Loom principal (5-8 min)
- Enregistrement Loom side project (3-5 min, bonus)
- Tag de release `v1.0.0` sur GitHub
- Email à Kaio avec les 3 liens (app, repo, Loom)

## Évolutions identifiées hors scope

À mentionner en restitution comme axes d'amélioration :

- Tests automatisés (Vitest pour les services, Playwright pour les flows critiques)
- Multi-pages avancé (sitemap.xml, robots.txt, gestion robuste des erreurs par page)
- Enrichissement WHOIS / DNS pour signaux infrastructure
- Migration Playwright/Puppeteer en cible prod sur infra dédiée (voir ADR-008)
- Scoring paramétrable par ICP utilisateur
- Intégration CRM (HubSpot, Salesforce) pour push automatique des analyses
- Webhooks de mise à jour quand un signal change pour une boîte déjà analysée
- Mode batch (CSV en input → analyses en parallèle)
