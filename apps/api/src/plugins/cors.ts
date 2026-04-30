import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { env } from '../lib/env.js';

// CORS restreint au seul domaine front, configurable via CORS_ORIGIN.
export async function registerCorsPlugin(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
}
