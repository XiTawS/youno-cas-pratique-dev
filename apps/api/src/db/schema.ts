import type { GtmSignals, ScoreBreakdown } from '@youno/shared/schemas/signals';
import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
// Voir docs/01-architecture.md §Stockage et ADR-010 pour le scoring.
//
// Status flow : 'pending' (insert au début du pipeline) → 'success' OU 'error'.
// Le pending permet de tracer une analyse qui plante en cours de pipeline
// pour le debug et l'observabilité (et plus tard une retry policy si besoin).
export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    domain: text('domain').notNull(),
    // JSONB types : on stocke les blobs Zod-validés en JSONB Postgres.
    // $type<...>() ne génère pas de check côté DB, juste du typage TS côté
    // Drizzle. La validation runtime est garantie en amont (Zod côté API).
    signals: jsonb('signals').$type<GtmSignals>(),
    techStack: jsonb('tech_stack').$type<string[]>(),
    scoreMaturity: integer('score_maturity'),
    scoreBreakdown: jsonb('score_breakdown').$type<ScoreBreakdown>(),
    status: text('status', { enum: ['pending', 'success', 'error'] }).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Cache lookup : "y a-t-il une analyse success de ce domain dans les 24h ?"
    index('analyses_domain_created_idx').on(t.domain, sql`${t.createdAt} DESC`),
    // History page J4 : "les N dernières analyses de cet utilisateur"
    index('analyses_user_created_idx').on(t.userId, sql`${t.createdAt} DESC`),
  ],
);

export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
