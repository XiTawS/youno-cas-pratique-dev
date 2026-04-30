import { z } from 'zod';

// IMPORTANT : dotenv doit avoir été chargé via './load-env.js' AVANT cet import,
// car certains SDK (notamment @clerk/fastify) initialisent des singletons à
// l'import en lisant process.env. Voir apps/api/src/lib/load-env.ts.
//
// Validation Zod centralisée des variables d'environnement au démarrage.
// Le serveur refuse de démarrer si une var requise manque (fail fast).
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // Liste d'origines CORS séparées par virgules - permet local + prod simultanément.
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((s) =>
      s
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),

  // Clerk - secret côté serveur, ne jamais exposer
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY est requis'),
  // Publishable key requise aussi côté serveur pour vérifier les JWT (JWKS lookup).
  // C'est une valeur publique, partagée avec le front via Vite define.
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY est requis'),

  // Allowlist email applicative (belt + suspenders au-delà de la config Clerk dashboard)
  // Format: emails séparés par virgule, normalisés en lowercase à la validation
  AUTH_ALLOWED_EMAILS: z
    .string()
    .min(1, 'AUTH_ALLOWED_EMAILS est requis (au moins un email)')
    .transform((raw) =>
      raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().email()).min(1)),

  // Connection string Neon Postgres - format `postgresql://user:pass@host/db?sslmode=require`
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL est requis'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration env invalide:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env: Env = parsed.data;
