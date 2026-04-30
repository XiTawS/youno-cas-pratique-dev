import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Table users - synchronisée avec Clerk (1 ligne = 1 user authentifié au moins une fois).
// Voir docs/01-architecture.md §Stockage pour le modèle complet.
// Pas encore peuplée en J1 : on créera la première ligne en J3 quand le pipeline
// d'analyse écrira son premier résultat (lazy upsert sur user_id).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
