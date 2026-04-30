# youno-cas-pratique-dev

Cas pratique technique pour le poste Développeur (Alternance / Stage) chez Youno.

L'app prend en entrée une URL d'entreprise et restitue une analyse GTM structurée : signaux factuels extraits depuis le site (modèle commercial, maturité, ICP cible), tech stack détectée, **statut qualitatif** (Trop tôt / À surveiller / Bon timing / Prospect mature) et **recommandation actionnable** générée par Claude. Pensée pour être utilisable par un commercial Konsole qualifiant des prospects en moins de 30 secondes.

## Stack

- **Front** : React 19 + Vite + Tailwind 4 + shadcn/ui + TanStack Query + React Router + React Hook Form + Zod + Sonner
- **API** : Fastify 5 + TypeScript strict + `fastify-type-provider-zod` + Pino
- **Auth** : Clerk (username + password, comptes créés par admin via API Clerk, allowlist email applicative en double sécurité)
- **DB** : Neon Postgres + Drizzle ORM + drizzle-kit (migrations versionnées)
- **Scraping** : Firecrawl (`@mendable/firecrawl-js`) + `simple-wappalyzer` self-hosté
- **LLM** : Claude Sonnet 4.5 via OpenRouter (API OpenAI-compatible) avec tool use forcé + temperature 0
- **Tests** : Vitest sur la logique pure (status, scraping utils, schemas Zod, export Markdown) — 41 tests
- **Hébergement** : Vercel (front) + Render (API) + Neon (DB) + OpenRouter (LLM) — tout en free tier
- **Monorepo** : pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`)

Détail des choix et arbitrages dans `docs/02-stack.md` et `docs/99-decisions.md` (13 ADRs).

## Démarrage local

### Prérequis

- Node.js 22 (voir `.nvmrc`)
- pnpm 9+ (activable via `corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Comptes (gratuits, sans CB) : Clerk, Neon, Firecrawl, OpenRouter

### Installation

```bash
# Cloner et installer
git clone https://github.com/XiTawS/youno-cas-pratique-dev.git
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

### Tests

```bash
# Toute la suite (api + web + shared)
pnpm test

# Un workspace en watch mode
pnpm --filter @apps/api test:watch
```

## Variables d'environnement

Toutes documentées dans `.env.example` à la racine. Aucune valeur réelle n'est versionnée. Les principales :

- `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` (Clerk dashboard)
- `AUTH_ALLOWED_EMAILS` : liste d'emails autorisés, séparés par virgules
- `DATABASE_URL` : connection string Neon Postgres
- `FIRECRAWL_API_KEY` : `fc-...`
- `OPENROUTER_API_KEY` + `LLM_MODEL` (défaut `anthropic/claude-sonnet-4.5`)

Validation Zod fail-fast au démarrage de l'API (voir `apps/api/src/lib/env.ts`).

## Déploiement

Front sur Vercel, API sur Render, DB sur Neon, auth sur Clerk. Tout en free tier permanent.

### Front — Vercel

`vercel.json` à la racine pilote la build :

1. **Import du repo** sur https://vercel.com/new (sélectionner `XiTawS/youno-cas-pratique-dev`)
2. **Root Directory** : laisser à `./` (le `vercel.json` racine prend le dessus)
3. **Build / Output / Install** : laisser tous les overrides vides — Vercel lit `vercel.json` qui spécifie le build pnpm + output `apps/web/dist`
4. **Environment Variables** :
   - `VITE_API_URL` : URL publique Render (ex. `https://youno-cas-pratique-api.onrender.com`)
   - `CLERK_PUBLISHABLE_KEY` : `pk_test_...` (Vite l'expose au bundle via `define` dans `vite.config.ts`)

### API — Render

`render.yaml` à la racine = Blueprint Infrastructure-as-Code.

1. **New → Blueprint** sur https://dashboard.render.com/blueprints
2. Sélectionner le repo GitHub, Render lit `render.yaml`
3. Service `youno-cas-pratique-api` créé, **renseigner les envs secrets** dans l'onglet Environment :
   - `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY`
   - `AUTH_ALLOWED_EMAILS`
   - `DATABASE_URL`
   - `FIRECRAWL_API_KEY`
   - `OPENROUTER_API_KEY` (+ `LLM_MODEL` si tu veux override le défaut)
   - `CORS_ORIGIN` : URL Vercel (séparée par virgules pour multi-domaine)
4. Rebuild auto à chaque push sur `main`

### Clerk — domaines + comptes

- **Domains** (Clerk dashboard → Configure) : ajouter l'URL Vercel
- **Comptes** : créés via API Clerk (script Python interne, voir ADR-012 pour le contexte). Mode admin-managed, pas de self-service sign-up.

## Fonctionnalités

- **Login** username + password (page custom one-page, voir ADR-012)
- **Dashboard** avec stats par statut + dernières analyses
- **Nouvelle analyse** depuis n'importe quelle page (dialog modal)
- **Page Analysis** : statut qualitatif en gros, recommandation, 3 cards signaux (Comment ils vendent / Maturité commerciale / Cible visée), stack technique. En-tête boîte avec badges secteur 📂 + taille 👥 + segment + géo
- **Historique** avec data table : recherche par domaine, tri par colonne, pagination
- **Export** : Markdown (.md) + PDF (via impression navigateur, feuille de style print dédiée)
- **Dark mode** persistant (toggle dans la sidebar, détection préférence système)
- **Cache 24h** par utilisateur + domaine (économise credits Firecrawl + tokens LLM)

### Saisie d'URL et gestion d'erreurs

L'input accepte la **forme nue** (`tec6.fr`, `www.cal.com/pricing`) ou complète (`https://stripe.com`). Le préfixe `https://` est ajouté automatiquement avant validation.

Validation stricte côté client (Zod) : exige au minimum un point + un TLD alphabétique de 2+ chars. Les saisies sans TLD plausible (`hcbheuvguevigecge`) sont rejetées avant l'appel API.

Les erreurs techniques (Firecrawl, OpenRouter, réseau) sont **mappées en messages FR user-friendly** via `userFriendlyScrapingMessage()` dans `apps/api/src/services/scraping.ts`. L'utilisateur voit "Ce domaine n'existe pas ou n'est pas joignable" au lieu de "Firecrawl /map error: ENOTFOUND". Le détail technique reste dans les logs Pino côté serveur.

| Erreur technique            | Message user                                           |
| --------------------------- | ------------------------------------------------------ |
| DNS / ENOTFOUND / not found | Ce domaine n'existe pas ou n'est pas joignable         |
| timeout / ETIMEDOUT         | Le site met trop de temps à répondre                   |
| 429 / rate limit            | Trop de requêtes simultanées                           |
| 401 / 403 / forbidden       | Le site bloque les outils d'analyse automatique        |
| 402 / quota / credits       | Quota d'analyse temporairement atteint                 |
| Aucune page scrappée        | Le contenu n'a pas pu être récupéré (le site bloque ?) |
| LLM erreur                  | L'analyse IA a échoué. Réessaie dans quelques instants |

## État du projet

Voir `progress/current.md` pour l'état vivant.

## Documentation

- `IDEE.md` — pourquoi ce projet existe (vision, non-objectifs, roadmap)
- `docs/00-brief.md` — brief original Youno
- `docs/01-architecture.md` — vue technique synthétique (composants, flux pipeline, schéma DB)
- `docs/02-stack.md` — stack précise et conventions de code
- `docs/99-decisions.md` — decisions log (13 ADRs)

## Limites actuelles assumées

- **Statut qualitatif basé sur 4 signaux booléens** (pricing public, page clients, blog actif, hiring sales/marketing) — calcul transparent mais grossier vs un score multi-dimensionnel paramétrable
- **Tests partiels** : la logique pure est couverte (41 tests), mais pas les services externes (Firecrawl, OpenRouter, Clerk, DB) ni de tests E2E Playwright
- **Pas de mobile-first** : UI responsive correcte (sidebar drawer mobile) mais pas optimisée
- **Pas d'enrichissement externe** (WHOIS, DNS, firmographic API tierces — Clearbit / Apollo / ZoomInfo écartés volontairement, voir ADR-008)
- **Cold start Render free** ~30s sur 1ʳᵉ requête après 15 min d'inactivité, mitigé par warm-up manuel avant démo
- **Quota Firecrawl** 500 credits one-time, largement suffisant pour le scope démo (~6 credits / analyse fraîche)
- **Pas de fallback LLM** si OpenRouter ou Sonnet indisponible (le slug `LLM_MODEL` permettrait un fallback trivial)

## Évolutions prévues (talking points restitution)

- Tests d'intégration avec mocks Firecrawl / OpenRouter + tests E2E Playwright
- Migration Playwright/Puppeteer en cible prod sur infra dédiée (voir ADR-007)
- Scoring paramétrable par ICP utilisateur (formule actuelle = règle fixe, voir ADR-013)
- Mode batch (CSV en input → analyses en parallèle)
- Intégration CRM (HubSpot, Salesforce) pour push automatique
- Webhooks de mise à jour quand un signal change
- Multi-tenancy par espace Konsole

## Tag

`v1.0.0` — livraison cas pratique 2026-05-04.
