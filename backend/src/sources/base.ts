import { request as httpsRequest } from 'node:https';
import type { IncomingMessage } from 'node:http';
import type { AdapterRequestConfig, AdapterResponseConfig } from '../config/taskSources.js';
import type { ImportedTask, SourceRecord } from '../types/sources.ts';
import { logger } from '../utils/logger.js';

type UnknownRecord = Record<string, unknown>;
type TransformConfig = string | Record<string, unknown>;
type RequestHeaders = Record<string, string>;
type RequestParams = Record<string, string>;
type TaskSourceLike = Pick<SourceRecord, 'config' | 'type'>;

type UniversalAdapterConfig = {
  request?: AdapterRequestConfig;
  response?: AdapterResponseConfig;
  mapping?: Record<string, string>;
  transforms?: Record<string, TransformConfig>;
};

type FetchOptions = {
  limit?: number;
  offset?: number;
};

abstract class TaskSourceAdapter {
  static type: string | null = null;
  static metadata: Record<string, unknown> | null = null;

  source: TaskSourceLike;

  constructor(source: TaskSourceLike) {
    this.source = source;
  }

  async fetch(_options?: FetchOptions): Promise<ImportedTask[]> {
    throw new Error('fetch() must be implemented by subclass');
  }

  async testConnection(): Promise<boolean> {
    throw new Error('testConnection() must be implemented by subclass');
  }

  convertToTask(_item: unknown): ImportedTask {
    throw new Error('convertToTask() must be implemented by subclass');
  }

  static validateDefinition(this: typeof TaskSourceAdapter) {
    if (!this.type || typeof this.type !== 'string') {
      throw new Error(`${this.name || 'Adapter'} must define static type`);
    }
  }
}

class UniversalAdapter extends TaskSourceAdapter {
  adapterConfig: UniversalAdapterConfig;
  request: AdapterRequestConfig;
  response: AdapterResponseConfig;
  mapping: Record<string, string>;
  transforms: Record<string, TransformConfig>;

  constructor(source: TaskSourceLike, adapterConfig: UniversalAdapterConfig) {
    super(source);
    this.adapterConfig = adapterConfig;
    this.request = adapterConfig.request ?? { baseUrl: '', path: '' };
    this.response = adapterConfig.response ?? { type: 'array' };
    this.mapping = adapterConfig.mapping ?? {};
    this.transforms = adapterConfig.transforms ?? {};
  }

  _normalizeRepo(repo: unknown): string {
    if (typeof repo !== 'string' || !repo) return '';

    const githubMatch = repo.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (githubMatch) {
      return `${githubMatch[1]}/${githubMatch[2]}`;
    }

    const gitlabMatch = repo.match(/gitlab\.com[/:]([^/]+)\/([^/.]+)/);
    if (gitlabMatch) {
      return `${gitlabMatch[1]}/${gitlabMatch[2]}`;
    }

    return repo;
  }

  _substituteWithNormalization(value: unknown, config: UnknownRecord): string | unknown {
    if (typeof value !== 'string') {
      return value;
    }

    return value.replace(/\{([^}]+)\}/g, (_, key: string) => {
      const keys = key.split('.');
      let resolved: unknown = config;
      for (const part of keys) {
        if (resolved == null || typeof resolved !== 'object') {
          return '';
        }
        resolved = (resolved as UnknownRecord)[part];
      }
      if (resolved != null) {
        if (key === 'repo') {
          resolved = this._normalizeRepo(resolved);
        }
        return typeof resolved === 'string' ? resolved : String(resolved);
      }
      return '';
    });
  }

  _substitutePlaceholders(value: unknown): string | unknown {
    if (typeof value !== 'string') {
      return value;
    }

    return value.replace(/\{([^}]+)\}/g, (_, key: string) => {
      const keys = key.split('.');
      let resolved: unknown = this.source.config;
      for (const part of keys) {
        if (resolved == null || typeof resolved !== 'object') {
          return '';
        }
        resolved = (resolved as UnknownRecord)[part];
      }
      return resolved != null ? String(resolved) : '';
    });
  }

  _buildUrl(pathValue: string, params?: RequestParams): URL {
    const baseUrl = this._substitutePlaceholders(this.request.baseUrl);
    const resolvedPath = this._substituteWithNormalization(pathValue, this.source.config);
    const normalizedBaseUrl = typeof baseUrl === 'string' ? baseUrl : '';
    const normalizedPath = typeof resolvedPath === 'string' ? resolvedPath : '';
    const normalizedBaseWithSlash = normalizedBaseUrl.endsWith('/') ? normalizedBaseUrl : `${normalizedBaseUrl}/`;
    const relativePath = normalizedPath.replace(/^\/+/, '');

    const url = new URL(relativePath, normalizedBaseWithSlash);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        const resolvedValue = this._substituteWithNormalization(value, this.source.config);
        if (typeof resolvedValue === 'string' && resolvedValue) {
          url.searchParams.set(key, resolvedValue);
        }
      }
    }

    return url;
  }

  _buildHeaders(headers?: RequestHeaders): RequestHeaders {
    if (!headers) return {};

    const resolved: RequestHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      const resolvedValue = this._substitutePlaceholders(value);
      if (typeof resolvedValue !== 'string' || !resolvedValue.trim()) {
        continue;
      }
      if (key === 'Authorization' && resolvedValue === 'token ') {
        continue;
      }
      resolved[key] = resolvedValue;
    }
    return resolved;
  }

  _httpRequest(url: string, method: string, headers: RequestHeaders): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options: Record<string, unknown> = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers,
        method: method.toUpperCase(),
      };

      if (urlObj.protocol === 'https:') {
        options.rejectUnauthorized = (this.source.config as UnknownRecord).rejectUnauthorized !== false;
      }

      const req = httpsRequest(options as Record<string, string | number | boolean | Record<string, string>>, (res: IncomingMessage) => {
        let data = '';

        res.on('data', (chunk: Buffer | string) => {
          data += chunk.toString();
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ data });
            }
          } else {
            reject(new Error(`HTTP error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  _getNestedValue(obj: unknown, pathValue: string): unknown {
    if (!pathValue) {
      return obj;
    }

    if (pathValue.startsWith('$.')) {
      const parts = pathValue.slice(2).split('.');
      let current: unknown = obj;

      for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;

        if (part.includes('[*]')) {
          const [arrayKey, prop] = part.split('[*].');
          const arr = (current as UnknownRecord)[arrayKey ?? ''];
          if (!Array.isArray(arr)) return undefined;
          if (prop) {
            return arr.map((item) => (item && typeof item === 'object' ? (item as UnknownRecord)[prop] : undefined)).filter((v) => v != null);
          }
          return arr;
        }

        current = (current as UnknownRecord)[part];
      }

      return current;
    }

    return undefined;
  }

  _applyTransform(value: unknown, transform: TransformConfig): unknown {
    if (value == null) return value;

    if (transform && typeof transform === 'object' && !Array.isArray(transform)) {
      return transform[String(value)] ?? value;
    }

    if (typeof transform === 'string') {
      switch (transform) {
        case 'toString':
          return String(value);
        case 'toInt':
          return Number.parseInt(String(value), 10);
        case 'toFloat':
          return Number.parseFloat(String(value));
        case 'toBoolean':
          return Boolean(value);
        case 'arrayMap(name)':
          if (Array.isArray(value)) {
            return value.map((item) => (item && typeof item === 'object' ? ((item as UnknownRecord).name ?? item) : item)).filter((v) => v != null);
          }
          return value;
        case 'arrayMap(id)':
          if (Array.isArray(value)) {
            return value.map((item) => (item && typeof item === 'object' ? ((item as UnknownRecord).id ?? item) : item)).filter((v) => v != null);
          }
          return value;
        default:
          return value;
      }
    }

    return value;
  }

  _mapItem(item: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [field, jsonPath] of Object.entries(this.mapping)) {
      let value = this._getNestedValue(item, jsonPath);
      const transform = this.transforms[field];
      if (transform) {
        value = this._applyTransform(value, transform);
      }
      result[field] = value;
    }

    return result;
  }

  override async fetch(options?: FetchOptions): Promise<ImportedTask[]> {
    const { method = 'GET', params = {} } = this.request;
    const headers = this._buildHeaders(this.request.headers);
    const url = this._buildUrl(this.request.path, params);

    logger.info('BaseSource', `Fetch request URL: ${url.toString()}`);
    const response = await this._httpRequest(url.toString(), method, headers);

    const items = this.response.path ? this._getNestedValue(response, this.response.path) : response;
    if (!Array.isArray(items)) {
      throw new Error(`Expected array in response, got ${typeof items}`);
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? items.length;
    const sliced = items.slice(offset, offset + limit);

    return sliced.map((item) => this.convertToTask(this._mapItem(item)));
  }

  override async testConnection(): Promise<boolean> {
    try {
      const url = this._buildUrl(this.request.path, {});
      logger.info('BaseSource', `Test connection URL: ${url.toString()}`);
      await this._httpRequest(url.toString(), 'GET', this._buildHeaders(this.request.headers));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('BaseSource', `Connection test failed: ${message}`);
      return false;
    }
  }

  override convertToTask(item: unknown): ImportedTask {
    const mappedItem = (item ?? {}) as Record<string, unknown>;
    return {
      title: typeof mappedItem.title === 'string' && mappedItem.title ? mappedItem.title : 'Untitled',
      description: typeof mappedItem.description === 'string' ? mappedItem.description : '',
      external_id: mappedItem.external_id != null ? String(mappedItem.external_id) : '',
      external_url: typeof mappedItem.external_url === 'string' ? mappedItem.external_url : '',
      status: typeof mappedItem.status === 'string' ? mappedItem.status : 'TODO',
      labels: Array.isArray(mappedItem.labels) ? mappedItem.labels.filter((label): label is string => typeof label === 'string') : [],
      created_at: mappedItem.created_at ?? null,
      updated_at: mappedItem.updated_at ?? null,
    };
  }
}

export { TaskSourceAdapter, UniversalAdapter };
export type { TaskSourceLike, UniversalAdapterConfig, FetchOptions };
