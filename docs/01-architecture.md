# Architecture

Vue technique synthétique du projet. Pour la stack précise et les conventions de code, voir `docs/02-stack.md`. Pour les décisions historiques, voir `docs/99-decisions.md`.

## Composants

### `apps/web` — Front React

Application React 19 + Vite, déployée sur Vercel. Responsabilité : interface utilisateur, formulaires, affichage des analyses, gestion de la session Clerk côté client.

### `apps/api` — API Fastify

API Node.js Fastify (TypeScript), déployée sur Render. Responsabilité : orchestration du pipeline d'analyse (scraping → tech stack → LLM → scoring), persistance, vérification d'authentification Clerk, exposition REST.

### `packages/shared` — Schémas Zod partagés

Package interne consommé par `apps/web` et `apps/api`. Source de vérité unique pour les types et schémas de l'API : signaux GTM, résultat d'analyse, score. Les schémas Zod servent à la fois à la validation runtime (Fastify, front) et à la dérivation de types TS.

### Neon Postgres — Base de données

Postgres serverless hébergé. Stocke deux tables principales : `users` (synchronisée avec Clerk via webhook ou lazy-load) et `analyses` (historique des analyses, signaux JSONB, score, métadonnées).

### Clerk — Authentification

Service d'auth managé. Magic link en méthode primaire, email/password en fallback. Allowlist email configurée côté Clerk dashboard ; double vérification applicative côté API via `AUTH_ALLOWED_EMAILS`.

### Firecrawl — Scraping

Service externe. Endpoint `/map` pour découvrir les pages d'un domaine, endpoint `/scrape` pour récupérer le markdown propre de pages spécifiques. Géré via le SDK officiel `@mendable/firecrawl-js`.

### Wappalyzer — Détection tech stack

Lib npm self-hostée, parse le HTML brut récupéré pour identifier les technologies utilisées (frameworks, analytics, CMS, payments, etc.). Aucun appel externe.

### Claude (Anthropic) — Extraction LLM

Modèle Claude Sonnet 4.6 via `@anthropic-ai/claude-agent-sdk`, authentifié par OAuth lié à l'abonnement Max. Un seul appel par analyse, tool use forcé pour sortie JSON conforme au schema Zod, temperature 0.

## Flux principal — Analyse d'une URL

```
[1] User entre URL                       (front)
       ↓
[2] POST /api/analyze {url}              (front → API)
       ↓
[3] Vérif auth Clerk + allowlist         (middleware API)
       ↓
[4] Cache check : analyse < 24h ?        (DB)
       ├─ HIT  → retourne cache
       └─ MISS → continue
       ↓
[5] Firecrawl /map (URL)                 (services/scraping.ts)
       → liste pages clés (/, /pricing, /careers, /customers, /about, /blog)
       ↓
[6] Firecrawl /scrape (3-5 pages)        (services/scraping.ts)
       → markdown propre + HTML brut
       ↓
[7] Wappalyzer.parse(html)               (services/tech-stack.ts)
       → liste techs détectées
       ↓
[8] Claude SDK (markdown + tech stack)   (services/extraction.ts)
       → JSON conforme schema signaux (tool use)
       ↓
[9] scoring.compute(signaux)             (services/scoring.ts)
       → score Maturité GTM /100 + détail
       ↓
[10] DB.insert(analyse complète)         (db/)
       ↓
[11] Réponse JSON                        (API → front)
       ↓
[12] Affichage UI + redirect /analysis/:id  (front)
```

## Stockage

### Table `users`

| Colonne      | Type          | Notes                     |
| ------------ | ------------- | ------------------------- |
| `id`         | uuid (PK)     | Généré côté DB            |
| `clerk_id`   | text (unique) | ID Clerk de l'utilisateur |
| `email`      | text (unique) | Synchronisé avec Clerk    |
| `created_at` | timestamptz   |                           |

### Table `analyses`

| Colonne           | Type            | Notes                                    |
| ----------------- | --------------- | ---------------------------------------- |
| `id`              | uuid (PK)       |                                          |
| `user_id`         | uuid (FK users) |                                          |
| `url`             | text            | URL canonique normalisée                 |
| `domain`          | text            | Extrait pour cache et lookup             |
| `signals`         | jsonb           | Conforme `@youno/shared/schemas/signals` |
| `tech_stack`      | jsonb           | Liste des technos Wappalyzer             |
| `score_maturity`  | integer         | 0-100                                    |
| `score_breakdown` | jsonb           | Détail des points par signal             |
| `status`          | text            | `pending` / `success` / `error`          |
| `error_message`   | text            | Si `status = error`                      |
| `created_at`      | timestamptz     |                                          |

Index sur `domain` + `created_at desc` pour le cache et l'historique.

## Dépendances externes

| Service                   | Critique ?  | Plan                      | Failure mode                                  |
| ------------------------- | ----------- | ------------------------- | --------------------------------------------- |
| Vercel                    | Oui (front) | Free                      | Démo inaccessible si down                     |
| Render                    | Oui (API)   | Free                      | API down, front affiche erreur                |
| Neon Postgres             | Oui         | Free 3 GB                 | Pas de persistance, analyses live impossibles |
| Clerk                     | Oui         | Free 10k MAU              | Login impossible                              |
| Firecrawl                 | Oui         | Free 500 credits one-time | Analyses impossibles                          |
| Anthropic (via SDK Agent) | Oui         | OAuth abo Max             | Extraction LLM impossible                     |

Toutes les dépendances ont un plan gratuit suffisant pour le scope. Aucune carte bancaire nécessaire.

## Considérations de sécurité

- **Auth obligatoire** sur toutes les routes `/api/*` sauf `/api/health`
- **Allowlist email applicative** en double sécurité au-delà de la config Clerk dashboard
- **Rate limiting** par utilisateur (10 analyses / heure) via `@fastify/rate-limit`
- **Cap quotidien global** : max 100 analyses Claude / 24h, sinon 503
- **Validation Zod** stricte sur les inputs (URL, paramètres)
- **CORS** restreint au domaine front uniquement
- **Pas de secrets côté front** : seules les clés publiques Clerk sont exposées (préfixe `VITE_`)

## Considérations de performance

- **Cache DB** : si une URL a été analysée par le même user dans les 24h, retour direct sans re-scraper / re-LLM
- **Cold start Render free** : ~30s sur la 1ère requête après 15 min d'inactivité, mitigé par warm-up manuel avant démo
- **Latence pipeline** : ~10-25s par analyse fraîche (Firecrawl 5-15s + Claude 3-8s + écritures DB ~200ms)
