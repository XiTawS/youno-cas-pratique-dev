# progress/current.md

## État (au 2026-04-30)

Phase **Pipeline LLM & scoring** (J3 de la roadmap). Brief reçu le 2026-04-27, échéance livraison ~2026-05-04. **J1 + J2 terminés** : monorepo pnpm + Fastify + Vite/React/Tailwind/shadcn + Clerk (email + password admin-managed) + Neon/Drizzle (table `users` vide) + déploiement Vercel + Render + endpoint `POST /api/analyze` (Firecrawl + Wappalyzer en parallèle, 3-5 pages markdown + tech stack en 2-15s sur Stripe / Linear / Notion).

## En cours

Démarrage J3 — pipeline LLM & scoring. Schema Zod des signaux GTM, wrapper Claude Agent SDK avec tool use forcé, formule Maturité GTM /100, persistance des analyses en DB + cache 24h.

**⚠️ Action utilisateur requise avant le prochain push** : ajouter `FIRECRAWL_API_KEY` aux envs Render (Settings → Environment), sinon le redeploy de l'API en prod échouera au boot via la validation Zod fail-fast.

## Prochaines actions

### J1 — Bootstrap & deploy stub

- [x] `pnpm init` à la racine, configurer `pnpm-workspace.yaml`
- [x] Fondations repo (`.gitignore`, `.nvmrc`, Prettier, `tsconfig.base.json`, `.env.example`)
- [x] Init `packages/shared` avec un schema Zod `healthResponseSchema`
- [x] Init `apps/api` avec Fastify + TS + `fastify-type-provider-zod` + CORS + Pino
- [x] Endpoint `GET /api/health` côté API
- [x] Init `apps/web` avec Vite + React 19 + TS + Tailwind 4 + shadcn (composant Button)
- [x] React Router (3 routes) + TanStack Query + page Home qui ping `/api/health`
- [x] Créer comptes : Clerk, Neon (Firecrawl à créer en J2)
- [x] Setup Clerk (front + back), login email + password OK en local et en prod
- [x] Setup Neon Postgres + Drizzle, première migration (table `users` vide)
- [x] Premier deploy : Vercel (front) + Render (API)
- [x] CORS + flow login bout-en-bout validés sur le déployé

### J2 — Pipeline scraping

- [x] Wrapper `apps/api/src/services/scraping.ts` (Firecrawl `/map` + `/scrape`)
- [x] Wrapper `apps/api/src/services/tech-stack.ts` (Wappalyzer via simple-wappalyzer)
- [x] Endpoint `POST /api/analyze` qui retourne markdown + tech stack pour une URL
- [x] Test sur 3 sites variés : Stripe (3.5s, 4 techs), Linear (1.7s, 8 techs), Notion (15.5s, 14 techs)

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
