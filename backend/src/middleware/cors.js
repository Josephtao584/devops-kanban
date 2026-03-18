/**
 * CORS Middleware Configuration
 */
const fastifyCors = require('@fastify/cors');

/**
 * Register CORS middleware
 * @param {FastifyInstance} fastify - Fastify instance
 */
async function corsPlugin(fastify) {
  fastify.register(fastifyCors, {
    origin: fastify.config?.CORS_ORIGINS || ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}

module.exports = corsPlugin;
