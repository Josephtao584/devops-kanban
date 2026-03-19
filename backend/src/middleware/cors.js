import fastifyCors from '@fastify/cors';

export default async function corsPlugin(fastify) {
  fastify.register(fastifyCors, {
    origin: fastify.config?.CORS_ORIGINS || ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}
