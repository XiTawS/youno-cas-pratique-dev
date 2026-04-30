import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit est exécuté hors du process serveur, donc on charge nous-mêmes
// les .env de la racine (cohérent avec apps/api/src/lib/env.ts).
config({ path: '../../.env' });
config({ path: '../../.env.local', override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL manquant - voir .env.example à la racine du monorepo');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  // Logs verbeux quand on génère ou applique une migration - utile en dev.
  verbose: true,
  strict: true,
});
