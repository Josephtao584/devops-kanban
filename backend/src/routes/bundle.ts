import type { FastifyPluginAsync } from 'fastify';
import { BundleService } from '../services/bundleService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, logError } from '../utils/http.js';
import type { BundleExportFile, BundleImportConfirmInput } from '../types/dto/bundle.js';

type BundleRouteOptions = {
  bundleService?: BundleService;
  storagePath?: string;
};

export const bundleRoutes: FastifyPluginAsync<BundleRouteOptions> = async (
  fastify,
  options = {}
) => {
  const bundleService = options.bundleService || new BundleService({
    ...(options.storagePath ? { storagePath: options.storagePath } : {}),
  });

  // Resolve dependencies for selected workflow templates
  fastify.post<{ Body: { templateIds?: string[] } }>('/resolve', async (request, reply) => {
    try {
      const { templateIds } = request.body || {};
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        reply.code(400);
        return errorResponse('templateIds must be a non-empty array');
      }
      const result = await bundleService.resolve(templateIds);
      return successResponse(result);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to resolve dependencies'));
    }
  });

  // Build bundle export file (JSON)
  fastify.post<{
    Body: { templateIds?: string[]; agentNames?: string[]; skillIdentifiers?: string[]; mcpServerNames?: string[] };
  }>('/export', async (request, reply) => {
    try {
      const { templateIds, agentNames, skillIdentifiers, mcpServerNames } = request.body || {};
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        reply.code(400);
        return errorResponse('templateIds must be a non-empty array');
      }
      const exportFile = await bundleService.exportBundle({
        templateIds,
        agentNames: agentNames || [],
        skillIdentifiers: skillIdentifiers || [],
        mcpServerNames: mcpServerNames || [],
      });
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="bundle-${Date.now()}.json"`);
      return exportFile;
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to export bundle'));
    }
  });

  // Build bundle export file (ZIP with skill files)
  fastify.post<{
    Body: { templateIds?: string[]; agentNames?: string[]; skillIdentifiers?: string[]; mcpServerNames?: string[] };
  }>('/export-zip', async (request, reply) => {
    try {
      const { templateIds, agentNames, skillIdentifiers, mcpServerNames } = request.body || {};
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        reply.code(400);
        return errorResponse('templateIds must be a non-empty array');
      }
      const zipBuffer = await bundleService.exportBundleAsZipBuffer({
        templateIds,
        agentNames: agentNames || [],
        skillIdentifiers: skillIdentifiers || [],
        mcpServerNames: mcpServerNames || [],
      });
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="bundle-${Date.now()}.zip"`);
      return reply.send(zipBuffer);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to export bundle as ZIP'));
    }
  });

  // Import preview (JSON)
  fastify.post<{ Body: BundleExportFile }>('/import', async (request, reply) => {
    try {
      const exportData = request.body;
      if (!exportData || !Array.isArray(exportData.templates)) {
        reply.code(400);
        return errorResponse('Invalid import file: templates array is required');
      }
      const preview = await bundleService.previewImport(exportData);
      return successResponse(preview);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to preview import'));
    }
  });

  // Import preview (ZIP)
  fastify.post<{ Body: { zip?: string } }>('/import-zip', async (request, reply) => {
    try {
      const { zip } = request.body || {};
      if (!zip || typeof zip !== 'string') {
        reply.code(400);
        return errorResponse('zip field is required and must be a base64 string');
      }
      if (zip.length > 67108864) {
        reply.code(400);
        return errorResponse('ZIP file too large, maximum size is 50MB');
      }
      const zipBuffer = Buffer.from(zip, 'base64');
      const preview = await bundleService.previewImportFromZip(zipBuffer);
      return successResponse(preview);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to preview import from ZIP'));
    }
  });

  // Confirm import (JSON)
  fastify.post<{ Body: BundleImportConfirmInput }>('/import/confirm', async (request, reply) => {
    try {
      const input = request.body;
      if (!input || !Array.isArray(input.templates)) {
        reply.code(400);
        return errorResponse('Invalid import data: templates array is required');
      }
      if (!input.strategy || !['skip', 'overwrite', 'copy'].includes(input.strategy)) {
        reply.code(400);
        return errorResponse('strategy must be one of: skip, overwrite, copy');
      }
      if (input.agents !== undefined && !Array.isArray(input.agents)) {
        reply.code(400);
        return errorResponse('agents must be an array');
      }
      if (input.skills !== undefined && !Array.isArray(input.skills)) {
        reply.code(400);
        return errorResponse('skills must be an array');
      }
      if (input.mcpServers !== undefined && !Array.isArray(input.mcpServers)) {
        reply.code(400);
        return errorResponse('mcpServers must be an array');
      }
      const result = await bundleService.confirmImport(input);
      return successResponse(result, 'Import completed');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to import bundle'));
    }
  });

  // Confirm import (ZIP)
  fastify.post<{ Body: { zip?: string; strategy?: string } }>('/import-zip/confirm', async (request, reply) => {
    try {
      const { zip, strategy } = request.body || {};
      if (!zip || typeof zip !== 'string') {
        reply.code(400);
        return errorResponse('zip field is required and must be a base64 string');
      }
      if (zip.length > 67108864) {
        reply.code(400);
        return errorResponse('ZIP file too large, maximum size is 50MB');
      }
      if (!strategy || !['skip', 'overwrite', 'copy'].includes(strategy)) {
        reply.code(400);
        return errorResponse('strategy must be one of: skip, overwrite, copy');
      }
      const zipBuffer = Buffer.from(zip, 'base64');
      const result = await bundleService.confirmImportFromZip(zipBuffer, strategy as 'skip' | 'overwrite' | 'copy');
      return successResponse(result, 'Import completed');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to import bundle from ZIP'));
    }
  });
};
