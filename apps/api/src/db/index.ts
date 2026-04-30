import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../lib/env.js';
import * as schema from './schema.js';

// Pool postgres-js partagé pour toute la durée du process Fastify.
// max=10 est confortable pour le free tier Render (1 instance, charge MVP).
// prepare:false évite des conflits avec PgBouncer/pooling Neon.
const client = postgres(env.DATABASE_URL, {
  max: 10,
  prepare: false,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
