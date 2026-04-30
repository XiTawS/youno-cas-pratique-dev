import type { AnalysisStatus, Signals } from '@youno/shared/schemas/signals';
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Table users - synchronisée avec Clerk (1 ligne = 1 user authentifié au moins une fois).
// Voir docs/01-architecture.md §Stockage pour le modèle complet.
// Lazy-upsert : on crée la ligne à la 1ère analyse (J3) plutôt que via webhook Clerk.
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Table analyses - historique des analyses d'URL.
// Voir docs/01-architecture.md §Stockage et ADR-013 pour le statut qualitatif.
//
// Pipeline status flow : 'pending' (insert au début) → 'success' OU 'error'.
// status (qualitatif) : null tant que pipeline_status != 'success', sinon enum.
// recommendation : généré par LLM, dupliqué hors signals JSONB pour query SQL facile.
export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    domain: text('domain').notNull(),
    // Statut opérationnel du pipeline.
    pipelineStatus: text('pipeline_status', { enum: ['pending', 'success', 'error'] }).notNull(),
    errorMessage: text('error_message'),
    // Signaux factuels extraits par le LLM. JSONB conforme à SignalsSchema.
    // null tant que pipeline_status != 'success'.
    signals: jsonb('signals').$type<Signals>(),
    // Statut qualitatif calculé en code à partir de signals.maturity. Voir ADR-013.
    // null tant que pipeline_status != 'success'.
    status: text('status', {
      enum: ['too_early', 'to_watch', 'good_timing', 'mature'],
    }).$type<AnalysisStatus>(),
    // Recommandation actionnable générée par le LLM (dupliquée hors signals
    // pour query SQL facile - ex. lister les analyses avec une reco non vide).
    recommendation: text('recommendation'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Cache lookup : "y a-t-il une analyse success de ce domain dans les 24h ?"
    index('analyses_domain_created_idx').on(t.domain, sql`${t.createdAt} DESC`),
    // History page : "les N dernières analyses de cet utilisateur"
    index('analyses_user_created_idx').on(t.userId, sql`${t.createdAt} DESC`),
  ],
);

export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
