/**
 * Error Handler Middleware
 */

/**
 * Register global error handler
 * @param {FastifyInstance} fastify - Fastify instance
 */
async function errorHandlerPlugin(fastify) {
  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    // Validation errors
    if (error.validation) {
      return reply.code(400).send({
        success: false,
        message: 'Validation error',
        errors: error.validation,
        data: null,
      });
    }

    // Not found
    if (error.code === 'FWR_NOT_FOUND') {
      return reply.code(404).send({
        success: false,
        message: 'Not found',
        error: error.message,
        data: null,
      });
    }

    // Default error
    const statusCode = error.statusCode || error.status || 500;
    return reply.code(statusCode).send({
      success: false,
      message: error.message || 'Internal server error',
      error: statusCode === 500 ? 'Internal server error' : error.message,
      data: null,
    });
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      message: 'Route not found',
      error: `${request.method} ${request.url}`,
      data: null,
    });
  });
}

module.exports = errorHandlerPlugin;
