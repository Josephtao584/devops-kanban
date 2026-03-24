import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { TaskSourceAdapter, type TaskSourceLike } from './base.js';
import type { ImportedTask, SourceDefinition, SourceRecord } from '../types/sources.ts';

type SourceConfig = SourceRecord['config'];
type Headers = Record<string, string>;
type UnknownRecord = Record<string, unknown>;

class InternalApiAdapter extends TaskSourceAdapter {
  static override type = 'INTERNAL_API';

  static override metadata: SourceDefinition = {
    type: 'INTERNAL_API',
    name: 'Internal API',
    description: '从内部 API 同步任务（预留两步式适配器配置）',
    configFields: {
      baseUrl: {
        type: 'string',
        required: true,
        description: 'Base URL for the internal API',
      },
      token: {
        type: 'string',
        required: false,
        description: 'Authentication token or API key',
      },
      listPath: {
        type: 'string',
        required: true,
        description: 'Placeholder path for listing records',
      },
      detailPath: {
        type: 'string',
        required: false,
        description: 'Placeholder path template for fetching a single record',
      },
      detailIdField: {
        type: 'string',
        required: false,
        description: 'Placeholder field name used to build detail requests',
      },
    },
  };

  baseUrl: string;
  token: string | undefined;
  listPath: string;
  detailPath: string;
  detailIdField: string;

  constructor(source: TaskSourceLike) {
    super(source);
    const config = source.config as SourceConfig;
    this.baseUrl = this._normalizeBaseUrl(config.baseUrl);
    this.token = typeof config.token === 'string' ? config.token : undefined;
    this.listPath = typeof config.listPath === 'string' ? config.listPath : '';
    this.detailPath = typeof config.detailPath === 'string' ? config.detailPath : '';
    this.detailIdField = typeof config.detailIdField === 'string' && config.detailIdField ? config.detailIdField : 'id';
  }

  _normalizeBaseUrl(baseUrl: unknown): string {
    if (typeof baseUrl !== 'string' || !baseUrl) {
      return '';
    }

    return baseUrl.replace(/\/$/, '');
  }

  _getHeaders(): Headers {
    const headers: Headers = {
      Accept: 'application/json',
      'User-Agent': 'DevOps-Kanban-App',
    };

    if (this.token) {
      headers.Authorization = this.token;
    }

    return headers;
  }

  _getRequestFactory(url: URL) {
    return url.protocol === 'http:' ? httpRequest : httpsRequest;
  }

  _buildRequestOptions(url: URL) {
    return {
      hostname: url.hostname,
      port: url.port || undefined,
      path: url.pathname + url.search,
      headers: this._getHeaders(),
      method: 'GET',
    };
  }

  _request(pathValue: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(pathValue, `${this.baseUrl}/`);
      const requestFactory = this._getRequestFactory(url);
      const options = this._buildRequestOptions(url);

      const req = requestFactory(options, (res: IncomingMessage) => {
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
            reject(new Error(`Internal API error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  _extractListItems(response: unknown): UnknownRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is UnknownRecord => Boolean(item) && typeof item === 'object');
    }

    if (response && typeof response === 'object') {
      const data = (response as UnknownRecord).data;
      if (Array.isArray(data)) {
        return data.filter((item): item is UnknownRecord => Boolean(item) && typeof item === 'object');
      }
    }

    throw new Error('Internal API list response must be an array or { data: [] }');
  }

  _extractDetailObject(response: unknown): UnknownRecord {
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const data = (response as UnknownRecord).data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data as UnknownRecord;
      }

      return response as UnknownRecord;
    }

    throw new Error('Internal API detail response must be an object or { data: {} }');
  }

  _getNestedValue(record: UnknownRecord, fieldPath: string): unknown {
    if (!fieldPath.includes('.')) {
      return record[fieldPath];
    }

    let current: unknown = record;
    for (const part of fieldPath.split('.')) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = (current as UnknownRecord)[part];
    }
    return current;
  }

  _buildDetailPath(identifier: unknown): string {
    const normalizedIdentifier = identifier != null ? String(identifier) : '';
    return this.detailPath.replace(`{${this.detailIdField}}`, encodeURIComponent(normalizedIdentifier));
  }

  _mapStatus(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      return 'TODO';
    }

    const normalized = value.trim().toLowerCase();
    if (['open', 'opened', 'todo'].includes(normalized)) {
      return 'TODO';
    }
    if (['in_progress', 'doing'].includes(normalized)) {
      return 'IN_PROGRESS';
    }
    if (['done', 'closed', 'resolved'].includes(normalized)) {
      return 'DONE';
    }
    if (normalized === 'blocked') {
      return 'BLOCKED';
    }
    if (['cancelled', 'canceled'].includes(normalized)) {
      return 'CANCELLED';
    }

    return normalized.toUpperCase();
  }

  _mapLabels(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && typeof (item as UnknownRecord).name === 'string') {
          return (item as UnknownRecord).name as string;
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
  }

  override async fetch(): Promise<ImportedTask[]> {
    if (!this.baseUrl) {
      throw new Error('Internal API baseUrl is required.');
    }
    if (!this.listPath) {
      throw new Error('Internal API listPath is required.');
    }
    if (!this.detailPath) {
      throw new Error('Internal API detailPath is required.');
    }

    const listResponse = await this._request(this.listPath);
    const items = this._extractListItems(listResponse);

    const tasks: ImportedTask[] = [];
    for (const item of items) {
      const identifier = this._getNestedValue(item, this.detailIdField) ?? item.id ?? item.external_id;
      if (identifier == null || identifier === '') {
        throw new Error(`Internal API list item is missing detail identifier field: ${this.detailIdField}`);
      }
      const detailResponse = await this._request(this._buildDetailPath(identifier));
      const detail = this._extractDetailObject(detailResponse);
      tasks.push(this.convertToTask({
        ...item,
        ...detail,
        ...(detail.id == null && item.id == null ? { id: identifier } : {}),
        ...(detail.external_id == null && item.external_id == null ? { external_id: identifier } : {}),
      }));
    }

    return tasks;
  }

  override async testConnection(): Promise<boolean> {
    if (!this.baseUrl || !this.listPath) {
      return false;
    }

    try {
      await this._request(this.listPath);
      return true;
    } catch {
      return false;
    }
  }

  override convertToTask(item: unknown): ImportedTask {
    const record = (item ?? {}) as UnknownRecord;
    const title = [record.title, record.subject, record.name].find((value) => typeof value === 'string' && value) as string | undefined;
    const description = [record.description, record.body, record.content].find((value) => typeof value === 'string') as string | undefined;
    const externalUrl = [record.url, record.external_url, record.html_url].find((value) => typeof value === 'string') as string | undefined;

    return {
      external_id: String(record.id ?? record.external_id ?? ''),
      title: title || 'Untitled',
      description: description || '',
      external_url: externalUrl || '',
      status: this._mapStatus(record.status ?? record.state),
      labels: this._mapLabels(record.labels),
      created_at: record.created_at ?? null,
      updated_at: record.updated_at ?? null,
    };
  }
}

export { InternalApiAdapter };
export default InternalApiAdapter;
