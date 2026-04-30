# progress/current.md

## État (au 2026-04-30)

Phase **Bootstrap** (J1 de la roadmap). Brief reçu le 2026-04-27, échéance livraison ~2026-05-04. J1 est en cours : monorepo pnpm fonctionnel en local, API Fastify avec `/api/health`, front Vite + React 19 + Tailwind 4 + shadcn opérationnel, page Home qui ping l'API avec succès. Reste : Clerk (étape 5), Neon + Drizzle (étape 6), premier deploy Vercel + Render (étape 7).

## En cours

Étape 5 J1 — intégration Clerk. En attente côté utilisateur pour créer l'app Clerk (ou fournir les clés existantes) et choisir les emails de l'allowlist avant d'ajouter les envs `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `AUTH_ALLOWED_EMAILS`.

## Prochaines actions

### J1 — Bootstrap & deploy stub

- [x] `pnpm init` à la racine, configurer `pnpm-workspace.yaml`
- [x] Fondations repo (`.gitignore`, `.nvmrc`, Prettier, `tsconfig.base.json`, `.env.example`)
- [x] Init `packages/shared` avec un schema Zod `healthResponseSchema`
- [x] Init `apps/api` avec Fastify + TS + `fastify-type-provider-zod` + CORS + Pino
- [x] Endpoint `GET /api/health` côté API
- [x] Init `apps/web` avec Vite + React 19 + TS + Tailwind 4 + shadcn (composant Button)
- [x] React Router (3 routes) + TanStack Query + page Home qui ping `/api/health`
- [ ] Créer comptes (si pas déjà faits) : Clerk, Neon, Firecrawl
- [ ] Setup Clerk (front + back), tester login magic link en local
- [ ] Setup Neon Postgres + Drizzle, première migration (table `users` vide)
- [ ] Premier deploy : Vercel (front) + Render (API)
- [ ] Vérifier CORS + flow login bout-en-bout sur le déployé

### J2 — Pipeline scraping

- [ ] Wrapper `apps/api/src/services/scraping.ts` (Firecrawl `/map` + `/scrape`)
- [ ] Wrapper `apps/api/src/services/tech-stack.ts` (Wappalyzer)
- [ ] Endpoint `POST /api/analyze` qui retourne markdown + tech stack pour une URL
- [ ] Test manuel sur 3 sites variés : Stripe (SSR), Linear (SPA), une early-stage random

### J3 — Pipeline LLM & scoring

- [ ] Schema Zod des signaux dans `packages/shared/src/schemas/signals.ts`
- [ ] Wrapper `apps/api/src/services/extraction.ts` (Claude Agent SDK + tool use)
- [ ] Wrapper `apps/api/src/services/scoring.ts` (formule Maturité GTM)
- [ ] Migration Drizzle pour table `analyses`
- [ ] Persistance des analyses + cache 24h dans `POST /api/analyze`

### J4 — UI complète

- [ ] Page Home avec input URL et bouton Analyser (RHF + Zod)
- [ ] Page Analysis : affichage 3 axes + score + détail
- [ ] Page History : liste des analyses passées de l'utilisateur connecté
- [ ] Loading states + error handling propres

### J5 — Polish & livrables

- [ ] README final avec choix techniques détaillés
- [ ] Loom principal (5-8 min)
- [ ] Loom side project (3-5 min, bonus)
- [ ] Tag `v1.0.0` sur GitHub
- [ ] Email à Kaio

## Bloqueurs

Aucun pour le moment.

## Notes

- Brief original dans `docs/00-brief.md`. Délai : 1 semaine à partir du 2026-04-27.
- Coût cible : 0 €. Tout est validé en free tier.
- Restitution prévue en call 45 min avec Kaio.
- Auth via Clerk pour éviter qu'un tiers crame le quota Anthropic Max sur l'app publique. Allowlist email = uniquement emails autorisés peuvent se créer un compte.
