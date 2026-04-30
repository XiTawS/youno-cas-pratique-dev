// MUST stay first - charge dotenv avant tout autre import qui lirait process.env
// (notamment @clerk/fastify qui init son clerkClient singleton au moment de l'import).
import './lib/load-env.js';

import { clerkPlugin } from '@clerk/fastify';
import { fastify, type FastifyError } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './lib/env.js';
import { registerAuthHook } from './plugins/auth.js';
import { registerCorsPlugin } from './plugins/cors.js';
import { analysesRoutes } from './routes/analyses.js';
import { analyzeRoute } from './routes/analyze.js';
import { healthRoute } from './routes/health.js';
import { meRoute } from './routes/me.js';

async function main(): Promise<void> {
  const app = fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      ...(env.NODE_ENV !== 'production' && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Configuration des compilers Zod pour la validation et la sérialisation
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Plugins - ordre important :
  // 1. CORS d'abord (préflight OPTIONS doit passer avant tout)
  // 2. Clerk au scope racine pour que getAuth fonctionne dans les routes
  // 3. Hook auth qui s'appuie sur les décorations Clerk
  await registerCorsPlugin(app);
  await app.register(clerkPlugin, {
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
  registerAuthHook(app);

  // Routes - prefix /api appliqué globalement aux routes métier
  await app.register(healthRoute, { prefix: '/api' });
  await app.register(meRoute, { prefix: '/api' });
  await app.register(analyzeRoute, { prefix: '/api' });
  await app.register(analysesRoutes, { prefix: '/api' });

  // Error handler global - format de réponse uniforme
  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error({ err }, 'unhandled error');
    void reply.status(err.statusCode ?? 500).send({
      error: err.name || 'InternalServerError',
      message: err.message,
    });
  });

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((err: unknown) => {
  console.error('Boot failure:', err);
  process.exit(1);
});
