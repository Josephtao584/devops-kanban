import type { FastifyPluginAsync } from 'fastify';
import { PresetService } from '../services/presetService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, logError } from '../utils/http.js';

type PresetRouteOptions = {
  presetService?: PresetService;
  kanbanTemplatePath?: string;
  storagePath?: string;
};

export const presetRoutes: FastifyPluginAsync<PresetRouteOptions> = async (
  fastify,
  options = {}
) => {
  const presetService = options.presetService || new PresetService({
    ...(options.kanbanTemplatePath ? { kanbanTemplatePath: options.kanbanTemplatePath } : {}),
    ...(options.storagePath ? { storagePath: options.storagePath } : {}),
  });

  // List presets
  fastify.get('/', async (request, reply) => {
    try {
      const presets = await presetService.listPresets();
      return successResponse(presets);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to list presets'));
    }
  });

  // Import a preset
  fastify.post<{
    Params: { name: string };
    Body: { strategy?: string };
  }>('/:name/import', async (request, reply) => {
    try {
      const { name } = request.params;
      const { strategy } = request.body || {};

      const validStrategy = strategy && ['skip', 'overwrite', 'copy'].includes(strategy)
        ? strategy as 'skip' | 'overwrite' | 'copy'
        : 'copy';

      const result = await presetService.importPreset(name, validStrategy);
      return successResponse(result, 'Preset imported');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to import preset'));
    }
  });
};
