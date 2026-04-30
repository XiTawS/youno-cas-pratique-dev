# Architecture

Vue technique synthétique du projet. Pour la stack précise et les conventions de code, voir `docs/02-stack.md`. Pour les décisions historiques, voir `docs/99-decisions.md`.

## Composants

### `apps/web` — Front React

Application React 19 + Vite, déployée sur Vercel. Responsabilité : interface utilisateur, formulaires, affichage des analyses, gestion de la session Clerk côté client.

### `apps/api` — API Fastify

API Node.js Fastify (TypeScript), déployée sur Render. Responsabilité : orchestration du pipeline d'analyse (scraping → tech stack → LLM → statut qualitatif), persistance, vérification d'authentification Clerk, exposition REST.

### `packages/shared` — Schémas Zod partagés

Package interne consommé par `apps/web` et `apps/api`. Source de vérité unique pour les types et schémas de l'API : signaux factuels (`SignalsSchema`), statut qualitatif (`AnalysisStatus`), résultat d'analyse. Les schémas Zod servent à la fois à la validation runtime (Fastify, front) et à la dérivation de types TS.

### Neon Postgres — Base de données

Postgres serverless hébergé. Stocke deux tables principales : `users` (synchronisée avec Clerk via lazy-upsert à la 1ʳᵉ analyse) et `analyses` (historique des analyses, signaux JSONB, statut qualitatif, recommandation textuelle).

### Clerk — Authentification

Service d'auth managé. Email + password uniquement, comptes créés par admin via le dashboard Clerk (pas de self-service sign-up). Password transmis aux users out-of-band (Slack, mail séparé). Allowlist email configurée côté Clerk dashboard ; double vérification applicative côté API via `AUTH_ALLOWED_EMAILS`.

### Firecrawl — Scraping

Service externe. Endpoint `/map` pour découvrir les pages d'un domaine, endpoint `/scrape` pour récupérer le markdown propre de pages spécifiques. Géré via le SDK officiel `@mendable/firecrawl-js`.

### Wappalyzer — Détection tech stack

Lib npm self-hostée, parse le HTML brut récupéré pour identifier les technologies utilisées (frameworks, analytics, CMS, payments, etc.). Aucun appel externe.

### Claude via OpenRouter — Extraction LLM

Modèle Claude Sonnet 4.5 via OpenRouter (API OpenAI-compatible, voir ADR-009). Un seul appel par analyse, tool use forcé pour sortie JSON conforme à `SignalsSchema`, temperature 0. Le LLM génère aussi `signals.recommendation` (texte 2-3 phrases FR actionnable pour le commercial).

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
[8] Claude via OpenRouter                (services/extraction.ts)
       → JSON conforme SignalsSchema (tool use)
       → inclut signals.recommendation (texte 2-3 phrases FR)
       ↓
[9] computeStatus(signaux)               (services/status.ts)
       → statut qualitatif déterministe (too_early / to_watch / good_timing / mature)
       ↓
[10] DB.update(analyse complète)         (db/)
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

Voir ADR-013 pour la refonte (statut qualitatif + recommandation, plus de score numérique).

| Colonne           | Type            | Notes                                                                                                  |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `id`              | uuid (PK)       |                                                                                                        |
| `user_id`         | uuid (FK users) | ON DELETE CASCADE                                                                                      |
| `url`             | text            | URL canonique normalisée                                                                               |
| `domain`          | text            | Extrait pour cache et lookup                                                                           |
| `pipeline_status` | text            | `pending` / `success` / `error` - statut opérationnel du pipeline                                      |
| `error_message`   | text            | Si `pipeline_status = error`                                                                           |
| `signals`         | jsonb           | Conforme `@youno/shared/schemas/signals` `SignalsSchema`                                               |
| `status`          | text            | `too_early` / `to_watch` / `good_timing` / `mature` - statut qualitatif calculé en code (voir ADR-013) |
| `recommendation`  | text            | Recommandation actionnable générée par Claude (dupliquée hors signals JSONB pour query SQL)            |
| `created_at`      | timestamptz     |                                                                                                        |

Index sur `domain` + `created_at desc` pour le cache et l'historique.

## Dépendances externes

| Service             | Critique ?  | Plan                       | Failure mode                                  |
| ------------------- | ----------- | -------------------------- | --------------------------------------------- |
| Vercel              | Oui (front) | Free                       | Démo inaccessible si down                     |
| Render              | Oui (API)   | Free                       | API down, front affiche erreur                |
| Neon Postgres       | Oui         | Free 3 GB                  | Pas de persistance, analyses live impossibles |
| Clerk               | Oui         | Free 10k MAU               | Login impossible                              |
| Firecrawl           | Oui         | Free 500 credits one-time  | Analyses impossibles                          |
| OpenRouter (Claude) | Oui         | $1 gratuit + pay-per-token | Extraction LLM impossible                     |

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
