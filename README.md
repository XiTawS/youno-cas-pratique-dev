# youno-cas-pratique-dev

Cas pratique technique pour le poste Développeur (Alternance / Stage) chez Youno.

L'app prend en entrée une URL d'entreprise et restitue une analyse GTM structurée : signaux extraits depuis le site, tech stack détectée, score "Maturité GTM" /100. Pensée pour être utilisable par un SDR Konsole qualifiant des prospects.

## Stack

- **Front** : React + Vite + Tailwind + shadcn/ui + TanStack Query + React Router + React Hook Form + Zod
- **API** : Fastify + TypeScript + `fastify-type-provider-zod`
- **Auth** : Clerk (magic link + password fallback + allowlist email)
- **DB** : Neon Postgres + Drizzle ORM
- **Scraping** : Firecrawl (`@mendable/firecrawl-js`) + Wappalyzer en lib
- **LLM** : Claude Sonnet 4.6 via `@anthropic-ai/claude-agent-sdk`
- **Hébergement** : Vercel (front) + Render (API)
- **Monorepo** : pnpm workspaces

Détail des choix et arbitrages dans `docs/02-stack.md` et `docs/99-decisions.md`.

## Démarrage local

### Prérequis

- Node.js 22 (voir `.nvmrc`)
- pnpm 9+
- Comptes (gratuits) : Clerk, Neon, Firecrawl, Anthropic Max (pour Claude Agent SDK)

### Installation

```bash
# Cloner et installer
git clone <repo-url>
cd youno-cas-pratique-dev
pnpm install

# Configurer les variables d'environnement (gitignored)
cp .env.example .env.local
# Éditer .env.local avec les vraies valeurs (voir .env.example pour la liste)

# Setup DB (migrations Drizzle)
pnpm --filter @apps/api db:migrate
```

### Lancement

```bash
# Tout en parallèle (front + API)
pnpm dev

# Ou séparément
pnpm --filter @apps/web dev   # http://localhost:5173
pnpm --filter @apps/api dev   # http://localhost:3000
```

## Variables d'environnement

Toutes les variables nécessaires sont documentées dans `.env.example` à la racine. Aucune valeur réelle n'est versionnée.

## Déploiement

Front sur Vercel, API sur Render, DB sur Neon, auth sur Clerk. Tout en free tier permanent, zéro CB.

### Front — Vercel

1. **Import du repo** depuis le dashboard Vercel (https://vercel.com/new)
2. **Root directory** : `apps/web`
3. **Framework preset** : Vite (auto-détecté)
4. **Build command** : `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @youno/shared build && pnpm --filter @apps/web build`
5. **Output directory** : `dist` (relatif à `apps/web`)
6. **Install command** : laisser par défaut (Vercel détecte pnpm via `packageManager` dans `package.json` racine)
7. **Environment variables** :
   - `VITE_API_URL` : URL publique de l'API Render (à remplir après le 1er deploy Render)
   - `CLERK_PUBLISHABLE_KEY` : `pk_test_...` (Vite l'expose au front via `define` dans `vite.config.ts`)

### API — Render

Render lit le `render.yaml` à la racine pour provisionner le service automatiquement.

1. **New → Blueprint** depuis le dashboard Render (https://dashboard.render.com/blueprints)
2. Sélectionner le repo GitHub
3. Render lit `render.yaml`, confirme la création du service `youno-cas-pratique-api`
4. Une fois créé, **renseigner les envs secrets** dans l'onglet Environment du service :
   - `CLERK_SECRET_KEY` : `sk_test_...`
   - `CLERK_PUBLISHABLE_KEY` : `pk_test_...`
   - `AUTH_ALLOWED_EMAILS` : liste séparée par virgules
   - `DATABASE_URL` : connection string Neon
   - `CORS_ORIGIN` : URL Vercel (ex. `https://youno-cas-pratique.vercel.app`) — peut être une liste séparée par virgules pour autoriser plusieurs domaines (preview Vercel, custom domain, etc.)
5. Render rebuild auto à chaque push sur `main`

### Clerk — domaines autorisés

Une fois le déploiement Vercel fait, ajouter le domaine Vercel à Clerk :
Dashboard Clerk → Configure → **Domains** → ajouter `https://<projet>.vercel.app`

## État du projet

Voir `progress/current.md` pour l'état vivant.

## Documentation

- `IDEE.md` — pourquoi ce projet existe (vision, non-objectifs, roadmap)
- `docs/00-brief.md` — brief original Youno
- `docs/01-architecture.md` — vue technique synthétique
- `docs/02-stack.md` — stack précise et conventions de code
- `docs/99-decisions.md` — decisions log (ADRs)

## Limites actuelles

À détailler dans le README final avant livraison Loom :

- Pas de tests automatisés (out of scope 5-8h)
- Pas de mobile-first (UI responsive correcte mais pas optimisée)
- Pas de scoring paramétrable par ICP utilisateur
- Pas d'enrichissement WHOIS / DNS / firmographic external API
- Cold start Render free ~30s sur 1ère requête après inactivité
- Quota Firecrawl free 500 credits one-time (largement suffisant pour le scope démo)

## Évolutions prévues

- Tests automatisés (Vitest + Playwright)
- Migration Playwright/Puppeteer en cible prod sur infra dédiée (voir ADR-007)
- Scoring multi-dimensionnel + tags + recommandation textuelle
- Mode batch (CSV en input)
- Intégration CRM (HubSpot, Salesforce)
- Webhooks de mise à jour des signaux
