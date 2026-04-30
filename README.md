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
