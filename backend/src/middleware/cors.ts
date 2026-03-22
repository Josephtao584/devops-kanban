import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export default async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyCors as never, {
    origin: (fastify.config?.CORS_ORIGINS || ['http://localhost:3000', 'http://localhost:5173']) as string[],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}
