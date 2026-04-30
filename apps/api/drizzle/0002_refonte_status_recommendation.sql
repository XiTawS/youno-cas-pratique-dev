-- Refonte ADR-013 : retire scoring numérique, ajoute statut qualitatif + recommandation
-- Voir docs/99-decisions.md ADR-013.

-- 1. Renomme l'ancienne colonne "status" (pending/success/error) en "pipeline_status"
--    pour libérer le nom au profit du statut qualitatif (too_early/.../mature).
ALTER TABLE "analyses" RENAME COLUMN "status" TO "pipeline_status";--> statement-breakpoint

-- 2. Drop des colonnes du scoring numérique obsolète et de tech_stack
--    (déplacé dans signals.techStack JSONB).
ALTER TABLE "analyses" DROP COLUMN "score_maturity";--> statement-breakpoint
ALTER TABLE "analyses" DROP COLUMN "score_breakdown";--> statement-breakpoint
ALTER TABLE "analyses" DROP COLUMN "tech_stack";--> statement-breakpoint

-- 3. Ajout des nouvelles colonnes pour le statut qualitatif et la recommandation.
ALTER TABLE "analyses" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "recommendation" text;--> statement-breakpoint

-- 4. Clean les rows existantes : signals (JSONB) avait l'ancien shape gtmSignalsSchema,
--    incompatible avec le nouveau SignalsSchema. On préfère repartir clean plutôt
--    que d'écrire un script de migration de données pour le scope cas pratique.
DELETE FROM "analyses";
