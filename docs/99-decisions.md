# Decisions log

Decisions importantes du projet au format ADR (Architecture Decision Record). Le **why** prime sur le **what** : la stack précise est dans `docs/02-stack.md`, ici on grave **pourquoi** les choix ont été faits face aux alternatives.

Format strict :

```
ADR-NNN — Titre court — YYYY-MM-DD
Status: accepted | superseded | deprecated
Superseded-by: ADR-NNN  (si applicable)

Contexte : ...
Décision : ...
Pourquoi : ...
Conséquences acceptées : ...
```

---

## ADR-001 — Architecture monorepo pnpm — 2026-04-30

**Status** : accepted

**Contexte** : le brief impose un seul repo GitHub. Le projet a un front (React) et une API (Node) qui doivent partager des types et schémas de validation. Trois packages prévus : `apps/web`, `apps/api`, `packages/shared`.

**Décision** : monorepo avec pnpm workspaces vanilla, sans Turborepo ni Nx.

**Pourquoi** :

- 3 packages seulement → un task graph et un cache de build sont inutiles à cette taille.
- pnpm workspaces est natif, sans config exotique.
- Migration vers Turborepo possible plus tard sans casser l'existant.
- Permet le partage trivial des schémas Zod via `@youno/shared` (workspace dependency).

**Conséquences acceptées** : pas de cache de build incrémental (acceptable pour le scope), pas de visualisation du dependency graph, conventions pnpm (workspace protocol) à respecter dans les `package.json`.

---

## ADR-002 — Framework API Fastify — 2026-04-30

**Status** : accepted

**Contexte** : choix d'un framework Node.js pour l'API. Trois candidats sérieux : Express (standard), Fastify (TS-first moderne), Hono (edge-ready).

**Décision** : Fastify + `fastify-type-provider-zod`.

**Pourquoi** :

- Validation par schéma JSON intégrée nativement, couplée à Zod via `fastify-type-provider-zod`. Zéro code de validation à écrire pour l'URL d'entrée et les payloads.
- Types TypeScript inférés depuis les schémas. `request.body`, `request.params` typés automatiquement.
- ~2x plus rapide qu'Express, sérialisation accélérée via `fast-json-stringify` quand response schema déclaré.
- Async/await natif (vs Express qui demande `express-async-errors` ou wrapper try/catch).
- Logger Pino intégré, request-id auto par requête → debug du pipeline gratuit.
- Plugins officiels (`@fastify/cors`, `@fastify/rate-limit`, `@fastify/helmet`) maintenus par l'équipe core, qualité homogène.

Express aurait demandé plus de boilerplate. Hono aurait eu du sens sur Cloudflare Workers ou Vercel Edge, mais Render = Node classique → l'argument portabilité de Hono ne sert pas.

**Conséquences acceptées** : moins de tutos / réponses Stack Overflow qu'Express (compensé par la qualité de la doc Fastify et l'assistance LLM).

---

## ADR-003 — Communication front / API : REST + Zod schemas partagés — 2026-04-30

**Status** : accepted

**Contexte** : monorepo pnpm avec front et API. Choix entre REST classique (universel mais types non partagés automatiquement) et tRPC (types end-to-end automatiques mais coupling fort).

**Décision** : REST classique, schémas Zod centralisés dans `packages/shared`, importés côté API (validation Fastify) et côté front (validation TanStack Query après fetch).

**Pourquoi** :

- Sens produit Konsole = SaaS B2B qui exposera des APIs à ses utilisateurs et intégrations. REST raconte mieux ce contexte que tRPC, qui est un pattern interne front/back.
- API consommable par tout client (mobile, autre service, Postman pour démo). tRPC verrouille sur le couplage TS.
- Débuggage Network tab du navigateur → important en démo live. tRPC batche les appels et rend le Network tab moins lisible.
- Adapter Fastify pour tRPC moins mature que la version Next.js → friction technique évitable.
- Avec les schémas Zod partagés, on récupère ~80% du bénéfice tRPC (type safety end-to-end) sans le coupling.

**Conséquences acceptées** : on écrit la couche fetch côté front à la main (~30 lignes via wrapper TanStack Query), pas de génération automatique des hooks.

---

## ADR-004 — Hébergement : Render pour l'API — 2026-04-30

**Status** : accepted

**Contexte** : besoin d'héberger l'API Node sur un service gratuit, accessible publiquement, depuis GitHub. Candidats : Render, Railway, Fly.io, ton VPS perso.

**Décision** : Render free tier pour l'API.

**Pourquoi** :

- Free tier **permanent** (750 h / mois), pas d'expiration. La démo reste accessible plusieurs semaines après la restitution.
- Brief explicitement "0 €" → exclut Railway (plus de free tier permanent depuis 2024, juste 5 $ de crédit one-time).
- Render Blueprint (`render.yaml`) = Infrastructure-as-Code versionnée, plus mature pour le repo public.
- Deploy GitHub trivial, support pnpm workspaces correct (Root Directory + Build Command).
- Cold start (~30s après 15 min d'inactivité) mitigé par warm-up manuel avant démo, ou cron externe gratuit (UptimeRobot).

**Conséquences acceptées** : cold start visible si l'app est inactive depuis > 15 min, RAM 512 MB qui exclut Chromium embarqué (voir ADR-008), build plus lent que Railway (1-3 min vs 30-90 s).

---

## ADR-005 — Base de données : Neon Postgres — 2026-04-30

**Status** : accepted

**Contexte** : besoin d'une DB pour persister les analyses. Render free n'a pas de disque persistant (filesystem éphémère), donc SQLite local fichier impossible. Candidats : Turso (SQLite hébergé), Neon Postgres, Supabase Postgres, Render Postgres.

**Décision** : Neon Postgres + Drizzle ORM.

**Pourquoi** :

- Free tier permanent 3 GB, sans expiration ni pause définitive (vs Supabase qui pause les projets après 7 jours d'inactivité, et Render Postgres qui expire après 30 jours en free).
- Postgres standard = ce qu'utiliserait Konsole en prod. Cohérent avec le contexte SaaS B2B, contrairement à Turso (libSQL) qui est moins courant dans cet écosystème.
- Branching DB natif (création d'une branche DB par feature, comme Git). Talking point fort en restitution même si non exploité dans le scope MVP.
- Auto-suspend Neon après quelques minutes d'inactivité avec wake-up en ~500ms : invisible en usage normal (vs pause définitive Supabase qui demande une réactivation manuelle).

Drizzle plutôt que Prisma : TS-first sans génération de client, synergie avec Zod via `drizzle-zod`, runtime léger (cold start Render plus rapide), schéma directement en TS dans le repo.

**Conséquences acceptées** : ~500 ms de cold start DB après inactivité, qui s'ajoute au cold start Render (négligeable en démo après warm-up). Dépendance à un service externe (vs DB locale).

---

## ADR-006 — Auth : Clerk (vs token statique, auth maison, alternatives) — 2026-04-30

**Status** : accepted

**Contexte** : besoin de protéger l'app pour éviter qu'un tiers crame le quota Anthropic Max via la clé OAuth liée à mon abonnement. Candidats : token statique partagé, magic link maison (jose + Resend), Clerk, Supabase Auth, WorkOS, Better Auth.

**Décision** : Clerk avec magic link en méthode primaire + email/password en fallback, allowlist email configurée côté Clerk dashboard, double vérification applicative côté API via env `AUTH_ALLOWED_EMAILS`.

**Pourquoi** :

- Token statique : pas révocable individuellement, si leak (Loom public, partage à un collègue) → redéploiement obligatoire pour changer.
- Magic link maison : ~2h45 de scope estimé = 35-55 % du temps total. Le brief insiste sur "MVP qui tourne > projet ambitieux qui plante" → mauvais arbitrage de cramer la moitié du scope sur l'auth quand le sens produit Konsole est le vrai sujet.
- Supabase Auth : projets free pausés après 7 jours d'inactivité, risque concret pour la démo accessible long terme. Et mélanger Supabase Auth + Neon DB = setup bancal.
- WorkOS : free tier généreux (1M MAU) mais on n'en utilisera jamais 1%, et la DX Clerk est supérieure pour ce scope.
- Clerk : setup 30-45 min, magic link + password natifs, allowlist gérée dans le dashboard sans redéploiement, plugin Fastify officiel, free tier 10k MAU largement suffisant.

**Conséquences acceptées** : dépendance à un service externe (Clerk down → login impossible, mais service très stable historiquement). "Clerk-specific JWT" = lock-in modéré, migration possible mais non triviale.

---

## ADR-007 — Scraping : Firecrawl en MVP, Playwright en cible prod — 2026-04-30

**Status** : accepted

**Contexte** :

- Render free tier limite la RAM à 512 MB.
- Chromium en cours d'exécution consomme ~250-400 MB en idle.
- Process Node Fastify ~80-150 MB.
- Total au pic > 512 MB → risque OOM élevé sur requêtes concurrentes.
- Fuites mémoire de Playwright/Puppeteer documentées même hors contraintes RAM (issues GitHub Microsoft/playwright).
- Brief impose 0 € et déploiement cloud accessible.
- Sites SaaS modernes en SPA (Linear, Cal.com) : `fetch + cheerio` simple ne suffit pas, le HTML initial est quasi vide.

**Décision** :

- **MVP** : Firecrawl Cloud free tier (500 credits one-time), via SDK `@mendable/firecrawl-js`. Endpoints `/map` (découverte des pages clés) + `/scrape` (markdown propre des pages sélectionnées).
- **Cible prod** : migration vers Playwright (préféré à Puppeteer pour son support multi-navigateurs et son auto-wait) sur infrastructure dédiée (≥ 2 GB RAM, instance dédiée scraping ou worker queue). Mention explicite en restitution comme évolution prévue.

**Pourquoi** :

- Firecrawl résout immédiatement la contrainte mémoire de Render free (browser hosté chez eux) et fournit du markdown LLM-ready, ce qui maximise la qualité d'analyse Claude pour un MVP de 5-8 h.
- Playwright en prod offre un coût marginal nul par scrape, un contrôle total (actions, anti-bot, timeouts custom), et l'absence de dépendance externe — trois critères clés pour un produit qui scale comme Konsole.

**Conséquences acceptées** :

- Le MVP dépend de la disponibilité Firecrawl et d'un quota fini (500 credits one-time, mais 5 % suffisent pour le scope).
- En prod, l'équipe devra gérer une infra de scraping (orchestration, rotation de proxies, gestion mémoire), coût d'ingénierie assumé.
- Pas d'abstraction `ScrapeService` dans le code MVP (over-engineering pour le scope) : la migration prod implique un refactor mineur du wrapper `services/scraping.ts`.

---

## ADR-008 — Sources d'enrichissement : choix et exclusions — 2026-04-30

**Status** : accepted

**Contexte** : le brief mentionne "APIs publiques : Clearbit, Hunter, BuiltWith, etc. (plans gratuits)". Veille technique nécessaire pour vérifier la disponibilité actuelle de ces APIs et identifier des alternatives.

**Décision** : pipeline d'enrichissement composé de Firecrawl (scraping markdown), Wappalyzer (lib npm pour tech stack), et Claude (extraction qualitative via tool use). Aucune des APIs citées dans le brief n'est utilisée.

**Pourquoi** :

**Clearbit exclu** : sunsetée par HubSpot après l'acquisition de 2023. <br>Le 30 avril 2025, le Free Clearbit Platform, le Weekly Visitor Report, Clearbit Connect, le TAM Calculator, et l'intégration Slack gratuite ont été discontinués. La Logo API a été sunsetée le 1er décembre 2025. Aujourd'hui Clearbit s'appelle "Breeze Intelligence" dans HubSpot, accessible uniquement via une souscription HubSpot ($75 / mois minimum). Inutilisable pour le scope "0 €".

**Hunter exclu** : email finder spécialisé. Hors scope (objectif = analyser un site, pas trouver l'email d'une personne).

**BuiltWith API exclue** : free tier limité à ~1 lookup gratuit / jour. Inutilisable.

**Wappalyzer (lib npm) inclus** : self-hosté, gratuit illimité, ~3000 technologies détectées via parsing du HTML brut. Apporte un signal factuel précis sur la stack tech, complémentaire à l'extraction LLM (qui peut halluciner sur ce sujet précis).

**Talking point en restitution** : _"Le brief mentionnait Clearbit, Hunter, BuiltWith — j'ai constaté en faisant ma veille que Clearbit a été sunsetée par HubSpot en 2025, Hunter est un email finder hors de mon scope, et BuiltWith free tier est trop limité. J'ai donc construit ma propre stack : Firecrawl + Claude pour l'analyse qualitative, Wappalyzer en lib pour la détection tech stack. En prod chez Konsole, j'enrichirais avec WHOIS/DNS et potentiellement Apollo pour le firmographic."_

**Conséquences acceptées** :

- Pas de données firmographic structurées (taille employés exacte, levée de fonds, secteur normalisé). Tout est déduit par Claude depuis le contenu du site, ou laissé `null` si non détecté.
- Pas de validation croisée des signaux entre plusieurs sources. Le pipeline est mono-source (le site).
- Évolution v2 documentée : ajout de WHOIS/DNS lookups et éventuellement API firmographic en prod.

---

## ADR-009 — Extraction LLM : Claude Sonnet via OpenRouter, 1 appel + tool use + temperature 0 — 2026-04-30 (révisé)

**Status** : accepted (révise la version initiale qui retenait `@anthropic-ai/claude-agent-sdk`)

**Contexte** : choix de la stratégie de prompting pour extraire les signaux GTM depuis le markdown Firecrawl. Trois axes à trancher : nombre d'appels (one-shot vs multi-shot vs pipeline étagé), format de sortie (JSON libre vs balises XML vs tool use), provider/modèle.

**Décision (initiale)** : Claude Agent SDK avec OAuth Max, modèle `claude-sonnet-4-6`, one-shot + tool use + temperature 0.

**Découverte pendant l'implémentation J3** : `@anthropic-ai/claude-agent-sdk` est un wrapper autour du CLI `claude` (Claude Code) qui lit une session OAuth stockée localement après un `claude login` interactif. Le SDK ne peut pas s'authentifier programmatiquement depuis un serveur Node — sur Render, il n'y a personne pour faire `claude login`, et la session n'existe pas. Le SDK est conçu pour des workflows agentiques multi-tours dans le runtime Claude Code, pas pour des appels API one-shot depuis un backend.

**Décision révisée** :

- **Provider** : OpenRouter (accès Claude + 200+ autres modèles via API OpenAI-compatible)
- **Modèle** : `anthropic/claude-sonnet-4.5` (slug OpenRouter), porté par `LLM_MODEL` pour switch trivial
- **SDK** : `openai` npm avec `baseURL: 'https://openrouter.ai/api/v1'` + `OPENROUTER_API_KEY`
- **1 seul appel** par analyse (one-shot)
- **Tool use forcé** avec format OpenAI : `tools: [{ type: 'function', function: { name, parameters } }]` + `tool_choice: { type: 'function', function: { name } }`
- **Temperature 0**, max_tokens 2000
- **Prompt système court** avec instruction explicite "mets `null` plutôt que d'inventer"
- **Validation Zod redondante** côté API en post-pro (double sécurité)

**Pourquoi OpenRouter (vs Anthropic API direct vs GitHub Models API)** :

- **Anthropic API direct** (`@anthropic-ai/sdk` + `ANTHROPIC_API_KEY`) : option de réference, mature, $5 crédit minimum sur compte Anthropic. **Talking point en restitution un peu plus standard**.
- **OpenRouter** : $1 gratuit à l'inscription, agrège tous les providers derrière une seule clé, switch de modèle en changeant le slug. **Talking point en restitution : flexibilité multi-modèles** (évolution possible vers GPT-5 ou Gemini sans refactor du code).
- **GitHub Models API** : preview, rate limits sévères (~150 req/jour, 8K tokens max), risque de breaking changes pendant la fenêtre de démo. Écarté.

OpenRouter retenu : coût d'entrée nul (essentiel pour le brief 0 €), flexibilité multi-modèles défendable en restitution, et l'API OpenAI-compatible reste une compétence transférable sur n'importe quel projet futur.

**Pourquoi one-shot + tool use + temperature 0** (inchangé vs ADR initial) :

- One-shot suffit : le markdown Firecrawl d'une homepage + 2-4 pages clés fait ~3-15k tokens, Claude Sonnet gère ça sans dégradation. Multi-shot multiplierait le coût sans gain notable.
- Tool use vs JSON libre : élimine le risque de JSON cassé / parsing fragile / retries. Pattern standard 2026.
- Temperature 0 : tâche d'extraction déterministe, mêmes inputs → même output, reproductible.
- Sonnet 4.5 plutôt qu'Opus : surdimensionné pour cette tâche. Plutôt qu'Haiku : risque d'hallucinations sur l'extraction qualitative.
- Instruction "null > inventer" : limite drastiquement les hallucinations sur signaux absents.

**Conséquences acceptées** :

- Une couche d'intermédiation (OpenRouter) en plus → +50-200ms de latence vs API direct, négligeable vs les ~5-15s du scraping Firecrawl.
- Le prompt caching natif Anthropic n'est pas exposé via OpenRouter — pas critique pour 1 appel one-shot, mais talking point en moins en restitution.
- Si le markdown source est partiel ou mal extrait, l'analyse en pâtit (garbage in, garbage out). Mitigé par la stratégie multi-pages.
- Pas de fallback automatique sur un autre modèle si OpenRouter ou Sonnet indisponible. Mention possible en restitution comme évolution (le slug `LLM_MODEL` permettrait un fallback trivial).

---

## ADR-010 — Scoring : "Maturité GTM", calcul hybride — 2026-04-30

**Status** : superseded
**Superseded-by** : ADR-013

**Contexte** : le brief suggère "fit pour une boîte qui vend à des SaaS B2B" comme exemple de scoring, mais laisse le choix libre. Trois angles possibles : fit ICP B2B SaaS (générique), maturité GTM (alignée Konsole), buyer intent (signaux d'achat).

**Décision** :

- **Angle** : score "Maturité GTM" /100.
- **Calcul** : hybride. Claude extrait les signaux factuels via tool use (qualitatif). Une formule déterministe en code calcule le score à partir des signaux booléens (transparence, reproductibilité).
- **Affichage** : score numérique + détail des points par signal (auditable).

**Pourquoi** :

**Choix de l'angle "Maturité GTM" plutôt que "fit B2B SaaS"** :

- Konsole vend du Revenue Engineering, donc un commercial Konsole qualifie ses prospects sur la question "ont-ils déjà construit leur GTM ?". Une boîte avec une GTM zéro n'est pas un bon prospect (trop tôt). Une boîte avec une GTM mature en a besoin pour scaler.
- "Fit B2B SaaS" est l'angle générique attendu (et que tous les autres candidats vont sans doute implémenter).
- "Maturité GTM" est différenciant et exactement aligné avec la qualification SDR de Konsole.

**Choix du calcul hybride plutôt que score 100 % LLM ou 100 % règles** :

- 100 % LLM : "boîte noire", non auditable, peut osciller subtilement entre runs.
- 100 % règles déterministes sur du HTML brut : limité aux signaux booléens, rate les nuances qualitatives (ton, positionnement).
- Hybride : Claude fait ce qu'il sait bien faire (extraction qualitative) + formule fait ce qu'elle sait bien faire (transparence). Le score est défendable en restitution avec la formule sous les yeux. L'utilisateur Konsole voit pourquoi son prospect est noté X / 100.

**Formule v0** (à ajuster au moment du dev sur des cas réels) :

| Signal                                                      | Poids   | Présent → |
| ----------------------------------------------------------- | ------- | --------- |
| Pricing page publique                                       | 15      | +15       |
| CTA principal clair (demo / trial / signup)                 | 15      | +15       |
| Page Customers / logos clients                              | 20      | +20       |
| Blog actif (dernier post < 60 jours)                        | 15      | +15       |
| Social proof externe (G2, ProductHunt, Capterra mentionnés) | 15      | +15       |
| Newsletter / lead capture top funnel                        | 10      | +10       |
| Postes sales/marketing ouverts                              | 10      | +10       |
| **Total max**                                               | **100** |           |

**Conséquences acceptées** :

- Le score est calibré pour un ICP type "SaaS B2B avec produit mature". Si l'utilisateur Konsole a un autre ICP, le score est moins pertinent. Évolution v2 : scoring paramétrable par ICP.
- Les pondérations sont arbitraires en v0, à ajuster avec du feedback. Pas de tuning automatique (out of scope).

---

## ADR-011 — Scoring optionnel — affichage simple — 2026-04-30

**Status** : superseded
**Superseded-by** : ADR-013

**Contexte** : le brief dit "Optionnel mais apprécié" pour le scoring. Discussion initiale envisageait un affichage riche multi-scores (3 scores indépendants + tags + recommandation textuelle), mais le scope 5-8 h impose des arbitrages.

**Décision** : un seul score "Maturité GTM" /100 avec détail des points par signal. Pas de multi-scores ni de système de tags ni de recommandation textuelle générée par LLM.

**Pourquoi** :

- Le scoring est optionnel selon le brief, donc le scope alloué doit rester contenu.
- Un score unique avec détail transparent répond à 80 % du besoin produit.
- Multi-scores + tags + recommandation = ~1h30 de scope supplémentaire, mieux investis sur la qualité de l'extraction LLM et la robustesse du pipeline.
- Talking point en restitution : _"j'ai gardé un score simple mais auditable dans le scope MVP. La version multi-dimensionnelle (3 scores + tags + reco textuelle) est documentée comme évolution v2 dans IDEE.md."_

**Conséquences acceptées** : moins "wow" en démo qu'un dashboard multi-scores. Mitigé par la qualité de l'extraction et du détail par signal.

---

## ADR-012 — Auth Clerk : bascule de magic link self-service vers email + password admin-managed — 2026-04-30

**Status** : accepted (révise ADR-006 sur le mode d'authentification, garde le choix de Clerk)

**Contexte** : ADR-006 retenait Clerk avec magic link en méthode primaire. À l'implémentation, deux frictions sont apparues :

- Le flow Clerk standard distingue strictement `<SignIn>` (users existants) de `<SignUp>` (nouveaux). Pour un MVP avec une allowlist de 4 emails connus, le passage par `/sign-up` à la 1ʳᵉ visite de chaque user était une étape inutile.
- Volonté d'éviter la friction "compte à créer" pour Kaio + Christian + Martin, sans toucher au composant Clerk natif (un flow custom passwordless aurait demandé ~50 lignes de hooks et de UI).

**Décision** : bascule en mode **admin-managed** :

- Désactivation de `email_link` et `email_code` côté Clerk dashboard. Méthode primaire = `password`.
- Comptes créés par admin (Léo) via API Clerk (`POST /v1/users` avec password généré). Allowlist remplie en parallèle (`POST /v1/allowlist_identifiers`).
- Credentials transmis out-of-band (Slack, mail séparé) aux users.
- Front : suppression de la page `/sign-up`, le composant `<SignIn />` n'affiche plus le lien "Don't have an account?" (`appearance.elements.footer: { display: 'none' }`).

**Pourquoi pas un flow custom passwordless** (1 champ email → magic link auto sign-in OR sign-up) :

- ~50 lignes de code à écrire et maintenir, vs 0 ligne pour le mode admin-managed.
- Perte de la UI shadcn-like polish de Clerk.
- Le scope MVP n'a pas le temps pour ça, et ce n'est pas un sujet produit Konsole.

**Conséquences acceptées** :

- L'admin (Léo) doit créer chaque compte manuellement à l'avance (mais l'API Clerk rend ça scriptable en 30 secondes).
- Les users doivent gérer un password (mitigé : password manager moderne, ou reset trivial via dashboard Clerk).
- Pas de "magic link" comme talking point en restitution — remplacé par "j'ai assumé une UX simple cohérente avec un cas pratique 4 utilisateurs ; le flow magic link aurait été un coût de scope sans valeur produit ici".

---

## ADR-013 — Refonte scoring : statut qualitatif + recommandation Claude — 2026-04-30

**Status** : accepted (supersede ADR-010 et ADR-011)

**Contexte** : à l'usage de l'app refonte par Léo, deux problèmes majeurs avec le scoring numérique mis en place dans ADR-010 + ADR-011 :

1. **Score inactionnable** pour l'utilisateur final (un commercial ou Léo lui-même). "Stripe noté 55/100" ne dit rien à un humain qui prospecte — quoi en faire ? Approcher ou pas ? Le score numérique est défendable en ingénierie ("formule transparente") mais pas en produit ("comment je m'en sers ?").
2. **Pondérations cassées sur des cas réels**. Les buckets 20/40/25/15 d'ADR-011 donnent des scores incohérents : Stripe (référence du SaaS B2B) sortait à 55/100, plus bas que beaucoup de boîtes plus immatures, parce que les buckets growth/tech-stack ne discriminaient pas bien sur les leaders du marché. La formule était cassée pour 80% des cas réels.
3. **UI inadaptée**. Page Analysis pleine de termes franglais ("Sales motion", "Growth signals", "ICP fit", "Hiring actif"...) inutilement techniques pour un commercial.

**Décision** :

- **Suppression du score numérique /100** (front + back). Plus de formule pondérée, plus de "score breakdown", plus de barres de progression.
- **Statut qualitatif déterministe à 4 niveaux** calculé en code à partir de signaux booléens factuels :
  - `too_early` 🌱 Trop tôt — 0/4 signaux maturity présents
  - `to_watch` 👀 À surveiller — 1-2/4 signaux
  - `good_timing` ✨ Bon timing — 3/4 signaux
  - `mature` 🔥 Prospect mature — 4/4 signaux
- **Recommandation textuelle générée par Claude** dans le même appel d'extraction. 2-3 phrases actionnables ("approche commerciale recommandée + angle d'accroche concret"). Persistée dans une colonne `recommendation` text dédiée.
- **Refonte du schema Zod des signaux** (Signals au lieu de GtmSignals) :
  - structure FR avec blocs `company` / `salesMotion` / `maturity` / `icp`
  - `techStack` déplacé du top-level vers `signals.techStack`
  - termes franglais bannis de l'UI (sauf enums GTM standards : PLG, Sales-led, Hybrid, SMB, Mid-market, Enterprise)

**Calcul du statut** (`apps/api/src/services/status.ts`) :

```ts
const hasPricing = signals.salesMotion.pricingPublic;
const hasCustomers = signals.maturity.customersPage || (signals.maturity.clientLogosCount ?? 0) > 0;
const hasActiveBlog = signals.maturity.blogActive;
const hasHiring = signals.maturity.salesMarketingHiring;
const count = [hasPricing, hasCustomers, hasActiveBlog, hasHiring].filter(Boolean).length;
if (count === 4) return 'mature';
if (count === 3) return 'good_timing';
if (count >= 1) return 'to_watch';
return 'too_early';
```

**Pourquoi statut qualitatif > score numérique** :

- **Actionnabilité** : "Bon timing" + recommandation Claude = un commercial sait quoi faire. "55/100" demande au commercial de mentaliser ce que ça veut dire.
- **Honnêteté** : 4 niveaux = on assume qu'on classe grossièrement. 100 niveaux suggère une précision qu'on n'a pas (le LLM extrait des signaux booléens, pas des graduations).
- **Talking point en restitution renforcé** : "j'ai retiré le score numérique parce qu'il était inactionnable et la formule cassait sur les leaders du marché — j'ai préféré un statut qualitatif déterministe + une recommandation textuelle générée par Claude".

**Pourquoi calcul déterministe en code (pas par Claude)** :

- Reproductibilité : mêmes signaux → même statut, debuggable.
- Transparence : la règle est explicite dans le code, pas dans une boîte noire.
- Coût : 0 token supplémentaire vs faire calculer par le LLM.

**Pourquoi recommandation par Claude (pas par template)** :

- Adaptation au contexte (le LLM sait dire "approchez par leur post LinkedIn récent sur le hiring SDR" vs un template générique).
- Pas de cost notable : 1 champ ajouté au tool schema, même appel.

**Conséquences acceptées** :

- Migration DB destructive : drop `score_maturity` + `score_breakdown` + `tech_stack`, ajout `pipeline_status` (renommé depuis `status`) + `status` (qualitatif) + `recommendation`. Les rows existantes ont été supprimées (`DELETE FROM analyses` dans 0002*refonte_status_recommendation.sql) — pas de migration de données pour le scope cas pratique (4 rows de test). Voir `apps/api/drizzle/0002*\*.sql`.
- Le statut peut paraître grossier (4 niveaux) — assumé, voir "Pourquoi statut qualitatif".
- Le seuil "blog < 60 jours" pour `blogActive` est basé sur la date de génération du contenu telle que perçue par le LLM (subjective). Talking point en restitution comme limite connue.
