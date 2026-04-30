# CLAUDE.md

Règles d'interaction pour les outils de coding (Claude Code CLI, Cursor, etc.) qui liront ce fichier à chaque session.

## La règle d'or

**Maintenir `progress/current.md` à chaque session significative.**

Une session est significative si la réponse à _"où j'en suis sur le projet ?"_ aurait changé après ta session. Si rien ne bouge sur cette question, ne touche pas au fichier.

Quand tu mets à jour `current.md` :

- Mets à jour la section État avec la date du jour (`YYYY-MM-DD`)
- Avance les checkboxes des Prochaines actions
- Ajoute / retire des Bloqueurs si pertinent
- Garde les Notes très courtes (1-2 lignes max par note)

Critères d'archivage (l'un OU l'autre) :

- Le fichier dépasse ~200 lignes
- Un jalon de la roadmap est atteint
- Inactif depuis ~1 mois

Archivage : déplacer dans `progress/archive/YYYY-MM-DD.md`, repartir avec un `current.md` minimal.

## Conventions de langue

- **Code, identifiants, noms de fichiers** : anglais
- **Commentaires de code** : français
- **Docs et commits** : français

## Conventions Git

Conventional Commits stricts : `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Scope optionnel entre parenthèses : `feat(api): add scoring endpoint`.

## Demande avant modifications sensibles

Demande confirmation explicite avant de modifier :

- **Le schema Drizzle** (`apps/api/src/db/schema.ts`) — toute modif implique une migration et potentiellement une perte de données en dev.
- **Les variables d'environnement** (`.env.example`, validation Zod dans `apps/api/src/lib/env.ts`) — toute ajout doit être réfléchi (où on récupère la valeur ? c'est un secret ?).
- **Le pipeline LLM** (`apps/api/src/services/extraction.ts`) — la qualité des analyses dépend du prompt et du tool schema. Explique d'abord ce que tu veux changer et pourquoi.
- **Les schémas Zod partagés** (`packages/shared/src/schemas/`) — source de vérité pour DB + API + front. Une modif casse plusieurs endroits, valide l'impact avant.
- **La formule de scoring** (`apps/api/src/services/scoring.ts`) — les pondérations sont les choix produit du projet, pas des paramètres techniques. Discute avant de changer.

## Sources de vérité

- **Stack technique précise** : `docs/02-stack.md`
- **Architecture** : `docs/01-architecture.md`
- **Décisions historiques (ADRs)** : `docs/99-decisions.md`
- **Vision et non-objectifs** : `IDEE.md`
- **État actuel** : `progress/current.md`

Ne duplique pas ces infos ailleurs. Pointe vers ces fichiers.

## Style de réponse attendu

- Concis et opinionated. 5 lignes nettes plutôt que 30 lignes molles.
- Quand une décision est non triviale : présente les options, pèse le pour/contre, recommande, demande validation.
- Pas de "magique" : explique ce que tu fais quand tu touches au pipeline LLM, au scoring, ou à l'auth.
- Évite les bullets list inutiles dans les réponses conversationnelles. Bullets OK pour des comparaisons de stacks, des checklists d'actions, des listes structurées.

## Marqueur `[?]`

Utilisé partout dans la doc pour signaler "pas tranché". Sert de signal clair plutôt que de laisser des trous silencieux. Si tu rencontres un `[?]` dans la doc, tu peux le challenger ou demander à l'utilisateur de trancher.

## Format des dates

`YYYY-MM-DD` partout (commits, ADRs, archives, current.md).
