# Stack & conventions

Source de vérité unique pour la stack technique du projet. Toute décision de stack est référencée ici. Les arbitrages historiques (vs alternatives) sont dans `docs/99-decisions.md`.

## Versions

| Élément    | Version | Notes                       |
| ---------- | ------- | --------------------------- |
| Node.js    | 22 LTS  | Fixé via `.nvmrc`           |
| pnpm       | 9.x     | Package manager du monorepo |
| TypeScript | 5.6+    | Strict mode partout         |

## Monorepo — pnpm workspaces

Outillage : `pnpm` workspaces vanilla, sans Turborepo ni Nx.

**Pourquoi** : 3 packages seulement (`apps/web`, `apps/api`, `packages/shared`). Un task graph et un cache de build sont inutiles à cette taille. pnpm workspaces est natif, sans config exotique, et migrable vers Turborepo plus tard sans casser l'existant.

Structure :

```
youno-cas-pratique-dev/
├── apps/
│   ├── web/          ← React + Vite
│   └── api/          ← Fastify
└── packages/
    └── shared/       ← Schémas Zod
```

Les packages internes sont référencés via `workspace:*` dans les `package.json`. Le package shared est nommé `@youno/shared`.

## Front — React + Vite

### React 19 + Vite

**Pourquoi Vite** : build ultra-rapide, HMR natif, preset React mature, pas de framework opinionated (vs Next) qui imposerait du SSR ou des conventions inutiles pour un MVP. Déploiement Vercel natif.

### Tailwind CSS + shadcn/ui

**Pourquoi cette combo** : shadcn/ui fournit des composants accessibles (basés sur Radix UI sous le capot) dont le code est copié dans le repo (pas une dépendance externe à versionner). Customisation totale via Tailwind, dark mode trivial, look pro instantané sans temps perdu sur du CSS custom. C'est le standard 2026 pour les SaaS modernes.

### TanStack Query

**Pourquoi** : gère states de chargement / erreur / succès sans boilerplate, cache par URL d'analyse (refetch évité si déjà analysée), retries automatiques sur erreur réseau, devtools pour debug. Devenu standard de fait pour le data fetching async côté React. Évite de réinventer cache + loading + error + dedup à la main.

### React Router

**Pourquoi** : standard de fait, doc et exemples partout. 3 routes suffisent (`/`, `/analysis/:id`, `/history`), pas besoin du file-based routing de TanStack Router. Intégration triviale avec TanStack Query.

### React Hook Form + Zod

**Pourquoi** : RHF est le standard 2026 pour les formulaires React (perfs supérieures grâce aux uncontrolled inputs, DX excellente avec TS). Couplé avec Zod via `@hookform/resolvers/zod`, on réutilise les schémas Zod de `packages/shared` côté front : la validation client est strictement identique à celle de l'API. Une seule source de vérité.

### Clerk (côté front)

`@clerk/clerk-react` pour le SDK front. Wrapping de l'`App` avec `<ClerkProvider>`, composant `<SignIn />` pour la page login, hook `useUser()` pour l'état authentifié.

## API — Fastify + TypeScript

### Fastify (vs Express, Hono)

**Pourquoi Fastify** :

1. **Validation par schéma JSON intégrée nativement** — couplée avec `fastify-type-provider-zod`, on déclare un schéma Zod sur la route, validation automatique avant le handler. Erreur 400 propre renvoyée si invalide. Zéro code de validation à écrire.
2. **TypeScript first-class** — types inférés depuis les schémas. `request.body`, `request.params`, `reply.send()` sont typés automatiquement.
3. **Performance** — ~2x Express sur des charges typiques, sérialisation accélérée via `fast-json-stringify` quand un response schema est déclaré.
4. **Async/await natif** — les erreurs remontent à l'error handler global sans wrapper, contrairement à Express qui demande `express-async-errors`.
5. **Logger Pino intégré** — logs JSON structurés, request-id auto par requête, niveaux configurables. Production-ready out of the box.
6. **Plugins officiels qualité homogène** — `@fastify/cors`, `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/auth` maintenus par l'équipe core.

Express aurait demandé plus de boilerplate pour un résultat équivalent. Hono aurait été pertinent pour un déploiement edge (Cloudflare Workers, Vercel Edge), mais Render = Node classique, donc Fastify domine.

### `fastify-type-provider-zod`

Plugin officiel pour utiliser des schémas Zod comme schémas de validation Fastify. Permet de partager les schémas entre `apps/api` et `packages/shared` sans conversion manuelle.

### Plugins Fastify utilisés

- `@fastify/cors` — CORS restreint au domaine front
- `@fastify/rate-limit` — rate limiting in-memory par IP/user (10 analyses / h)
- `@fastify/helmet` — headers de sécurité (CSP, HSTS, etc.)
- `@clerk/fastify` — middleware d'auth Clerk officiel

### Clerk (côté API)

`@clerk/fastify` pour vérifier le JWT de session sur chaque requête. Middleware appliqué globalement sauf sur `/api/health`. Double vérification applicative : après auth Clerk OK, on vérifie que `user.email ∈ AUTH_ALLOWED_EMAILS`.

## Communication front / API — REST + Zod schemas partagés

**Pourquoi REST plutôt que tRPC**, malgré le contexte monorepo qui rendrait tRPC viable :

1. **Sens produit Konsole** — Konsole est un SaaS B2B qui exposera des APIs à ses utilisateurs et intégrations. REST raconte mieux ce contexte d'intégration que tRPC, qui est un pattern interne front/back.
2. **API consommable par tout client** — mobile, autre service, Postman pour démo. tRPC verrouille sur le couplage TS.
3. **Débuggage Network tab** — important en démo live avec Kaio. tRPC batche les appels et rend le Network tab moins lisible.
4. **Adapter Fastify pour tRPC moins mature** — l'écosystème tRPC est centré sur Next.js. Friction technique évitable.

**Zod schemas partagés** dans `packages/shared` apportent 80% du bénéfice tRPC (type safety end-to-end) sans le coupling :

- Côté API : Fastify utilise le schéma Zod pour validation + sérialisation typée
- Côté front : même schéma Zod pour parser et valider la réponse avant affichage
- Si l'API change le schéma, le front pète à la compilation TS

Le schéma Zod sert aussi de doc vivante de l'API.

## Base de données — Neon Postgres + Drizzle

### Neon Postgres (vs Turso, Supabase)

**Pourquoi Neon** :

1. **Free tier permanent** — 3 GB de stockage par projet, sans expiration ni pause définitive. Une instance Supabase free se met en pause après 7 jours d'inactivité, ce qui casserait la démo accessible long terme. Neon a juste un auto-suspend de quelques minutes avec wake-up en ~500ms, invisible en usage.
2. **Postgres standard** — c'est ce que Konsole utiliserait en prod. Cohérent avec le contexte SaaS B2B, contrairement à Turso (libSQL) qui est moins courant.
3. **Branching natif** — création d'une branche DB par feature, comme Git. Talking point fort en restitution même si pas exploité dans le scope MVP.
4. **Compatibilité ORM** — Postgres standard, fonctionne avec n'importe quel ORM TS.

### Drizzle ORM (vs Prisma)

**Pourquoi Drizzle** :

1. **TS-first** — schéma déclaré directement en TypeScript, types inférés sans génération de client. Pas de fichier `.prisma` séparé à maintenir.
2. **Synergie avec Zod** — la lib `drizzle-zod` génère automatiquement des schémas Zod depuis les tables Drizzle. Un seul schema source pour DB + validation API + types front.
3. **Léger** — pas de runtime client à plusieurs MB comme Prisma. Cold start Render plus rapide.
4. **Migrations versionnables** — `drizzle-kit generate` produit du SQL versionnable dans Git.
5. **Compatible Postgres et SQLite** — si bascule de Neon vers Turso plus tard, code métier identique, juste le driver à changer.

## Scraping — Firecrawl (MVP) → Playwright (cible prod)

### Firecrawl pour le MVP

`@mendable/firecrawl-js` SDK officiel. Endpoints utilisés :

- `/map` — découvre les pages clés du domaine (1 credit)
- `/scrape` — récupère le markdown propre d'une page (1 credit)

**Pourquoi pas Playwright/Puppeteer en local sur Render free** :

Render free tier limite la RAM à 512 MB. Chromium en cours d'exécution consomme ~250-400 MB en idle, plus le process Node Fastify (~80-150 MB) → risque OOM élevé, surtout sur requêtes concurrentes. Les fuites mémoire de Playwright/Puppeteer sont documentées même sur des machines avec 20 GB de RAM.

**Pourquoi Firecrawl plutôt que Jina Reader ou autre** :

- Free tier 500 credits one-time sans carte bancaire
- Markdown propre prêt pour LLM (vs HTML brut à nettoyer)
- Endpoint `/map` qui découvre les pages clés (utile pour notre stratégie multi-pages)
- SDK Node officiel mature
- Open source AGPL, self-hostable en prod

### Cible prod : Playwright

Sur une infrastructure dédiée (≥ 2 GB RAM, instance scraping isolée), la migration vers Playwright deviendrait préférable :

- Coût marginal nul par scrape (vs credits Firecrawl)
- Contrôle total des actions (clic, scroll, wait, anti-bot)
- Pas de dépendance externe ni quota
- Cohérent avec ce qu'utiliserait Konsole pour scaler

Mention en restitution comme évolution prévue. Pas implémenté dans le MVP par contrainte d'environnement.

## Détection tech stack — Wappalyzer

Lib npm self-hostée. Parse le HTML brut récupéré par Firecrawl et identifie les technologies utilisées (~3000 supportées : frameworks JS, analytics, CMS, payments, CRM, etc.).

**Pourquoi pas l'API BuiltWith** : free tier ridicule (1 lookup/jour), inutilisable.

**Pourquoi pas demander à Claude de deviner** : risque d'hallucination sur les techs, et Wappalyzer fait ça déterministe à partir du HTML factuel (signatures CSS, scripts, headers). On garde Claude pour le qualitatif.

## LLM — Claude Sonnet via OpenRouter

OpenRouter agrège l'accès à 200+ modèles (Claude, GPT, Gemini, etc.) derrière une seule API OpenAI-compatible et une seule clé. On l'utilise via le package `openai` côté Node avec `baseURL: 'https://openrouter.ai/api/v1'`.

### Pourquoi OpenRouter (vs Anthropic API directe vs Claude Agent SDK)

Le plan initial (ADR-009 v1) prévoyait `@anthropic-ai/claude-agent-sdk` avec auth OAuth liée à l'abonnement Max. **Découvert pendant l'implémentation J3** : ce SDK est un wrapper autour du CLI `claude` (Claude Code) qui lit une session interactive locale ; il est inutilisable depuis un serveur Node sur Render. Voir ADR-009 mis à jour.

Trois alternatives évaluées :

- **Anthropic API directe** (`@anthropic-ai/sdk` + `ANTHROPIC_API_KEY`) : standard, mature, mais nécessite création de compte Anthropic + crédit.
- **OpenRouter** : un seul endpoint pour Claude + tous les autres modèles, $1 gratuit à l'inscription, switch de modèle trivial via le slug `model: 'anthropic/claude-sonnet-4.5'`.
- **GitHub Models API** : preview, rate limits sévères (~150 req/jour), risque de breaking changes pendant la fenêtre de démo.

OpenRouter retenu pour le coût d'entrée nul, la flexibilité multi-modèles (talking point en restitution sur l'évolution possible), et la simplicité d'intégration via SDK OpenAI-compatible.

### Modèle

`anthropic/claude-sonnet-4.5` (slug OpenRouter). Sweet spot qualité / vitesse / coût pour cette tâche. Opus serait surdimensionné, Haiku risquerait des hallucinations sur l'extraction qualitative. Le slug est porté par la variable d'env `LLM_MODEL` pour pouvoir switcher en 1 ligne.

### Pattern d'appel

1 appel par analyse, pas de chaînage multi-étapes :

- **Tool use forcé** — un outil `extract_company_signals` est défini avec un input schema dérivé du schema Zod `@youno/shared/schemas/signals`. OpenRouter expose le format OpenAI-compatible (`tools: [{ type: 'function', function: { name, parameters } }]` + `tool_choice: { type: 'function', function: { name } }`). Le LLM est obligé de retourner un JSON conforme. Aucun parsing de JSON cassé à gérer.
- **Temperature 0** — tâche d'extraction déterministe, pas créative. Mêmes inputs → même output.
- **Prompt système court et tranché** — instruction explicite "mets `null` plutôt que d'inventer" pour limiter les hallucinations sur les signaux absents.
- **Max tokens** — 2000 (large marge pour le JSON de signaux, qui fait ~500-1000 tokens en pratique).

### Validation post-appel

Même si tool use force la conformité, validation Zod redondante côté API en post-pro pour double sécurité avant écriture DB.

### Coût indicatif

~$0.01-0.02 par analyse (Sonnet 4.5 via OpenRouter, ~5K input + 1K output tokens). $1 gratuit à l'inscription couvre largement le scope démo (~50 analyses test).

## Auth — Clerk

### Choix Clerk (vs token statique, auth maison, Supabase Auth, WorkOS)

**Pourquoi pas token statique** : si le token leak (Loom public, partage Kaio à un collègue), il faut redéployer pour le changer. Pas révocable individuellement.

**Pourquoi pas auth maison (magic link + JWT + Resend)** : ~2h45 de scope cramées sur l'auth = 35-55% du temps total disponible. Le brief insiste sur "MVP qui tourne > projet ambitieux qui plante". Mauvais arbitrage.

**Pourquoi pas Supabase Auth** : projets Supabase free se mettent en pause après 7 jours d'inactivité. Risque concret pour la démo accessible long terme post-restitution. Et mélanger Supabase Auth + Neon DB = setup bancal.

**Pourquoi pas WorkOS** : free tier plus généreux (1M MAU vs 10k Clerk) mais on n'en utilisera jamais 1%. Clerk a une DX supérieure et un setup plus rapide pour ce scope.

**Pourquoi Clerk** :

- Setup en 30-45 min : SDK React + plugin Fastify, composants `<SignIn />` prêts
- Email + password gérés nativement, pas de self-service sign-up à coder
- Allowlist email gérée dans le dashboard sans redéploiement
- Création des users + reset password via API Clerk (scriptable depuis Bash)
- Free tier 10k MAU largement suffisant
- Plugin Fastify officiel (`@clerk/fastify`)

### Configuration

Mode **admin-managed** : pas de sign-up self-service, l'admin crée chaque compte (email + password prédéfini) via le dashboard ou l'API Clerk, et transmet les credentials out-of-band (Slack, mail séparé). Pas de magic link, pas de vérification email — les comptes créés par API sont déjà "verified" à la création.

| Réglage Clerk           | Valeur                                                    |
| ----------------------- | --------------------------------------------------------- |
| Email address           | Required + Used for sign-in                               |
| Password                | Activé (méthode primaire)                                 |
| Email verification link | Désactivé                                                 |
| Email verification code | Désactivé                                                 |
| OAuth providers         | Désactivés                                                |
| Sign-up modes           | Restricted (allowlist)                                    |
| Allowlist               | Voir env `AUTH_ALLOWED_EMAILS` côté API + dashboard Clerk |
| Session lifetime        | 7 jours                                                   |

Double vérification applicative côté API : après validation du JWT Clerk, on vérifie que `user.email ∈ AUTH_ALLOWED_EMAILS`. Belt + suspenders.

Voir ADR-012 pour le contexte du choix admin-managed (vs self-service magic link initialement prévu).

## Hébergement

### Front — Vercel

Free tier généreux, support Vite natif, deploy depuis GitHub en 1 clic. Pas de cold start côté front (CDN edge).

### API — Render

Free tier permanent (750 h / mois), Render Blueprint (`render.yaml`) pour Infrastructure-as-Code. Un cold start de 10-30s après 15 min d'inactivité, mitigé par warm-up manuel avant démo (ping `/health`) ou cron externe gratuit (UptimeRobot).

**Pourquoi pas Railway** : pas de free tier permanent depuis 2024, juste 5 $ de crédit one-time. Insuffisant pour la contrainte "0 €" du brief si la démo doit rester accessible plusieurs semaines.

## Conventions de code

### TypeScript

- **Strict mode obligatoire** dans tous les `tsconfig.json`. `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` activés.
- **Pas de `any` non commenté**. Si exception nécessaire, commentaire `// any: <raison>` obligatoire.
- **Types inférés > types explicites** quand l'inférence est claire et lisible.

### Linting & formatting

- ESLint flat config (`eslint.config.mjs`), preset `@typescript-eslint/recommended-strict`. Configuré par app (front et API ont des règles différentes), pas au niveau racine.
- Prettier au niveau racine (`.prettierrc.json` + `.prettierignore`), `prettier --check` en CI via `pnpm format:check`. Config : `singleQuote`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 2`, `endOfLine: lf`. Toute la doc (`.md`) est passée par Prettier — les tables markdown sont alignées automatiquement, ne pas chercher à formater à la main.
- Hooks Git : non mis en place dans ce scope (CI suffit pour bloquer un push qui ne passe pas `format:check`/`typecheck`).

### Tests

Vitest pour la logique pure, voir `apps/api/src/services/*.test.ts`, `apps/web/src/lib/*.test.ts`, `packages/shared/src/schemas/*.test.ts`. Couvre :

- `computeStatus()` (déterministe, 4 niveaux, edge cases booléens)
- `pickPagesToScrape()` (sélection de pages à scraper, dédup, host www-aware)
- `analysisToMarkdown()` (formatage de l'export, mappings FR, omission champs nullables)
- `SignalsSchema` + `AnalysisStatusSchema` (validation Zod, bornes max, enums)

41 tests au total. Lancement via `pnpm test` (récursif) ou par workspace via `pnpm --filter @apps/api test`.

Pas de tests d'intégration sur les services externes (Firecrawl, OpenRouter, Clerk, DB) ni de tests E2E Playwright — ces couches demandent des fixtures lourdes ou des mocks complexes, hors scope MVP. Talking point de restitution : "les premiers ajouts si je continuais seraient les tests d'intégration sur `/api/analyze` avec Firecrawl/OpenRouter mockés, puis un Playwright sur le golden path login → analyse → détail".

### Imports

- Absolute imports via `tsconfig` paths : `@/components/...`, `@youno/shared/schemas/...`.
- Pas de relative imports `../../../` au-delà de 2 niveaux.

### Commits

Conventional Commits : `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Scope optionnel entre parenthèses : `feat(api): ...`.

### Langue

- **Code, identifiants, noms de fichiers** : anglais.
- **Commentaires de code** : français (cohérent avec le reste de la doc).
- **Docs et commits** : français.

### Variables d'environnement

Validation Zod centralisée dans `apps/api/src/lib/env.ts` au démarrage. Si une env var requise manque ou est invalide, le serveur refuse de démarrer (fail fast). Voir `.env.example` à la racine.

### Gestion des erreurs

- **Côté API** : error handler Fastify global. Erreurs typées (`AnalysisError`, `ScrapingError`, `LLMError`) avec status code HTTP approprié.
- **Côté front** : Error Boundaries React + toasts pour les erreurs API non bloquantes. TanStack Query gère retries et error states.
