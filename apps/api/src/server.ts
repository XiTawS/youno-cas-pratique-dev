import { fastify, type FastifyError } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './lib/env.js';
import { registerCorsPlugin } from './plugins/cors.js';
import { healthRoute } from './routes/health.js';

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

  // Plugins
  await registerCorsPlugin(app);

  // Routes - prefix /api appliqué globalement aux routes métier
  await app.register(healthRoute, { prefix: '/api' });

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
