import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import { TaskSourceAdapter, type TaskSourceLike } from './base.js';
import type { SourceRecord } from '../types/sources.ts';

type SourceConfig = SourceRecord['config'];
type Headers = Record<string, string>;
type UnknownRecord = Record<string, unknown>;
type RequestOptions = {
  method?: string;
  body?: unknown;
};

abstract class DevOpsBaseAdapter extends TaskSourceAdapter {
  static override type: string | null = null;
  static override metadata: Record<string, unknown> | null = null;

  baseUrl: string;
  token: string | undefined;
  listPath: string;
  detailPath: string;
  detailIdField: string;
  pageSize: number;
  rejectUnauthorized: boolean;

  constructor(source: TaskSourceLike) {
    super(source);
    const config = source.config as SourceConfig;
    this.baseUrl = this._normalizeBaseUrl(config.baseUrl);
    this.token = typeof config.token === 'string' ? config.token : undefined;
    this.listPath = typeof config.listPath === 'string' ? config.listPath : '';
    this.detailPath = typeof config.detailPath === 'string' ? config.detailPath : '';
    this.detailIdField = typeof config.detailIdField === 'string' && config.detailIdField ? config.detailIdField : 'id';
    this.pageSize = this._parsePositiveInt(config.pageSize, 10);
    this.rejectUnauthorized = config.rejectUnauthorized !== false;
  }

  _normalizeBaseUrl(baseUrl: unknown): string {
    if (typeof baseUrl !== 'string' || !baseUrl) {
      return '';
    }

    return baseUrl.replace(/\/$/, '');
  }

  _parsePositiveInt(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return fallback;
  }

  _getHeaders(body?: string): Headers {
    const headers: Headers = {
      Accept: 'application/json',
      'User-Agent': 'Coplat-App',
    };

    if (this.token) {
      headers.Authorization = this.token;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(body));
    }

    return headers;
  }

  _getRequestFactory(url: URL) {
    return url.protocol === 'http:' ? httpRequest : httpsRequest;
  }

  _buildRequestOptions(url: URL, requestOptions: RequestOptions = {}, body?: string) {
    const options: Record<string, unknown> = {
      hostname: url.hostname,
      port: url.port || undefined,
      path: url.pathname + url.search,
      headers: this._getHeaders(body),
      method: requestOptions.method || 'GET',
    };
    if (url.protocol === 'https:') {
      options.rejectUnauthorized = this.rejectUnauthorized;
    }
    return options;
  }

  _decodeResponseBuffer(buffer: Buffer, contentEncoding: string | string[] | undefined): Buffer {
    const encoding = Array.isArray(contentEncoding) ? contentEncoding.join(',').toLowerCase() : contentEncoding?.toLowerCase() ?? '';

    if (encoding.includes('gzip')) {
      return gunzipSync(buffer);
    }
    if (encoding.includes('br')) {
      return brotliDecompressSync(buffer);
    }
    if (encoding.includes('deflate')) {
      return inflateSync(buffer);
    }

    return buffer;
  }

  _bufferToText(buffer: Buffer): string {
    return buffer.toString('utf8').replace(/^\uFEFF/, '');
  }

  _parseResponseBody(buffer: Buffer, contentEncoding: string | string[] | undefined): unknown {
    const decodedBuffer = this._decodeResponseBuffer(buffer, contentEncoding);
    const decodedText = this._bufferToText(decodedBuffer);
    return JSON.parse(decodedText);
  }

  _formatResponseBody(buffer: Buffer, contentEncoding: string | string[] | undefined): string {
    const decodedBuffer = this._decodeResponseBuffer(buffer, contentEncoding);
    return this._bufferToText(decodedBuffer);
  }

  _request(pathValue: string, requestOptions: RequestOptions = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(pathValue, `${this.baseUrl}/`);
      const requestFactory = this._getRequestFactory(url);
      const body = requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body);
      const options = this._buildRequestOptions(url, requestOptions, body);
      (options as Record<string, unknown>).timeout = 10000;

      console.log(`[DevOpsBaseAdapter] → ${options.method} ${url.toString()}`);

      const req = requestFactory(options, (res: IncomingMessage) => {
        console.log(`[DevOpsBaseAdapter] ← ${url.toString()} status: ${res.statusCode}`);
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer | string) => {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        });

        res.on('end', () => {
          const responseBuffer = Buffer.concat(chunks);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(this._parseResponseBody(responseBuffer, res.headers['content-encoding']));
            } catch {
              const rawText = this._formatResponseBody(responseBuffer, res.headers['content-encoding']);
              resolve({ data: rawText });
            }
          } else {
            reject(new Error(`Internal API error: ${res.statusCode} - ${this._formatResponseBody(responseBuffer, res.headers['content-encoding'])}`));
          }
        });
      });

      req.on('error', (err) => {
        console.error(`[DevOpsBaseAdapter] ✗ ${url.toString()} error: ${err.message}`);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy(new Error('API request timeout after 10s'));
      });

      if (body !== undefined) {
        req.write(body);
      }
      req.end();
    });
  }

  _normalizeJsonLikeResponse(response: unknown): unknown {
    if (typeof response !== 'string') {
      return response;
    }

    const trimmed = response.trim();
    if (!trimmed) {
      return response;
    }

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return response;
      }
    }

    return response;
  }

  _toObjectArray(value: unknown): UnknownRecord[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    return value.filter((item): item is UnknownRecord => Boolean(item) && typeof item === 'object');
  }

  _describeObjectKeys(value: unknown): string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return '';
    }

    return Object.keys(value as UnknownRecord).join(',');
  }

  _valueType(value: unknown): string {
    return Array.isArray(value) ? 'array' : typeof value;
  }

  _extractListItems(response: unknown): UnknownRecord[] {
    const normalizedResponse = this._normalizeJsonLikeResponse(response);
    const directArray = this._toObjectArray(normalizedResponse);
    if (directArray) {
      return directArray;
    }

    const dataValue = normalizedResponse && typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse)
      ? this._normalizeJsonLikeResponse((normalizedResponse as UnknownRecord).data)
      : undefined;

    // Handle double-encoded JSON strings: if data is a string that looks like
    // a JSON object or array, try parsing it.
    let dataValueForResult = dataValue;
    if (typeof dataValueForResult === 'string') {
      const trimmed = dataValueForResult.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          dataValueForResult = JSON.parse(trimmed);
        } catch {
          // Keep original string
        }
      } else if (trimmed.startsWith('"')) {
        // Double-encoded: '"{"result":[]}"' -> first parse gives '{"result":[]}'
        try {
          const firstParse = JSON.parse(trimmed);
          if (typeof firstParse === 'string') {
            const inner = firstParse.trim();
            if (inner.startsWith('{') || inner.startsWith('[')) {
              dataValueForResult = JSON.parse(inner);
            }
          } else if (typeof firstParse === 'object' && firstParse !== null) {
            dataValueForResult = firstParse;
          }
        } catch {
          // Keep original string
        }
      }
    }

    const dataArray = this._toObjectArray(dataValue);
    if (dataArray) {
      return dataArray;
    }

    const resultValue = dataValueForResult && typeof dataValueForResult === 'object' && !Array.isArray(dataValueForResult)
      ? this._normalizeJsonLikeResponse((dataValueForResult as UnknownRecord).result)
      : undefined;
    const resultArray = this._toObjectArray(resultValue);
    if (resultArray) {
      return resultArray;
    }

    const candidatePaths = [
      'result',
      'items',
      'list',
      'records',
      'data.result',
      'data.data.result',
      'data.items',
      'data.list',
      'data.records',
      'result.items',
    ];

    // Also search through dataValueForResult (double-decoded data) using candidate paths.
    if (dataValueForResult && typeof dataValueForResult === 'object' && !Array.isArray(dataValueForResult)) {
      for (const pathValue of candidatePaths) {
        const candidate = this._normalizeJsonLikeResponse(this._getNestedValue(dataValueForResult as UnknownRecord, pathValue));
        const items = this._toObjectArray(candidate);
        if (items) {
          return items;
        }
      }
    }

    if (normalizedResponse && typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse)) {
      for (const pathValue of candidatePaths) {
        const candidate = this._normalizeJsonLikeResponse(this._getNestedValue(normalizedResponse as UnknownRecord, pathValue));
        const items = this._toObjectArray(candidate);
        if (items) {
          return items;
        }
      }
    }

    throw new Error(
      `Internal API list response must be an array, { data: [] }, or { data: { result: [] } }. ` +
      `Received type: ${this._valueType(normalizedResponse)}, ` +
      `rootKeys: [${this._describeObjectKeys(normalizedResponse)}], ` +
      `dataType: ${this._valueType(dataValue)}, ` +
      `dataKeys: [${this._describeObjectKeys(dataValue)}], ` +
      `resultType: ${this._valueType(resultValue)}`
    );
  }

  _extractDetailObject(response: unknown): UnknownRecord {
    const normalizedResponse = this._normalizeJsonLikeResponse(response);

    if (normalizedResponse && typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse)) {
      const data = this._normalizeJsonLikeResponse((normalizedResponse as UnknownRecord).data);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data as UnknownRecord;
      }

      return normalizedResponse as UnknownRecord;
    }

    throw new Error('Internal API detail response must be an object or { data: {} }');
  }

  _extractDetailRecords(response: unknown): UnknownRecord[] {
    const normalizedResponse = this._normalizeJsonLikeResponse(response);

    if (Array.isArray(normalizedResponse)) {
      return normalizedResponse.filter((item): item is UnknownRecord => Boolean(item) && typeof item === 'object');
    }

    if (normalizedResponse && typeof normalizedResponse === 'object') {
      const data = this._normalizeJsonLikeResponse((normalizedResponse as UnknownRecord).data);
      if (Array.isArray(data)) {
        return data.filter((item): item is UnknownRecord => Boolean(item) && typeof item === 'object');
      }
    }

    throw new Error('Internal API detail response must be an array or { data: [] }');
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
    if (['open', 'opened', 'todo', '待处理', '待办', '未开始'].includes(normalized)) {
      return 'TODO';
    }
    if (['in_progress', 'doing', '处理中', '进行中', '处理中...'].includes(normalized)) {
      return 'IN_PROGRESS';
    }
    if (['done', 'closed', 'resolved', '已完成', '完成', '已关闭'].includes(normalized)) {
      return 'DONE';
    }
    if (['blocked', '阻塞', '已阻塞', '挂起'].includes(normalized)) {
      return 'BLOCKED';
    }
    if (['cancelled', 'canceled', '已取消', '取消'].includes(normalized)) {
      return 'CANCELLED';
    }

    return normalized.toUpperCase();
  }

  _mapLabels(value: unknown): string[] {
    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }

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

  _decodeHtmlEntities(value: string): string {
    const namedEntities: Record<string, string> = {
      amp: '&',
      apos: "'",
      gt: '>',
      lt: '<',
      nbsp: ' ',
      quot: '"',
      '#39': "'",
    };

    return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, rawCode) => {
      const code = String(rawCode).toLowerCase();
      if (code.startsWith('#x')) {
        const parsed = Number.parseInt(code.slice(2), 16);
        return Number.isNaN(parsed) ? entity : String.fromCodePoint(parsed);
      }
      if (code.startsWith('#')) {
        const parsed = Number.parseInt(code.slice(1), 10);
        return Number.isNaN(parsed) ? entity : String.fromCodePoint(parsed);
      }
      return namedEntities[code] ?? entity;
    });
  }

  _normalizeWorkitemDescription(value: string): string {
    if (!value) {
      return '';
    }

    let normalized = value.replace(/\r\n?/g, '\n');
    const hasHtmlLikeMarkup = /<\/?[a-z][^>]*>/i.test(normalized) || /&(#x[0-9a-f]+|#\d+|[a-z]+);/i.test(normalized);
    if (!hasHtmlLikeMarkup) {
      return normalized.trim();
    }

    normalized = normalized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    normalized = normalized.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    normalized = normalized.replace(/<br\s*\/?>/gi, '\n');
    normalized = normalized.replace(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, '\n```\n$1\n```\n');
    normalized = normalized.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
    normalized = normalized.replace(/<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_match, _quote, href, inner) => {
      const link = String(href).trim();
      if (!link) {
        return String(inner);
      }
      return `${String(inner)} (${link})`;
    });
    normalized = normalized.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
    normalized = normalized.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*');
    normalized = normalized.replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_match, inner) => `\n## ${String(inner).replace(/<[^>]+>/g, ' ').trim()}\n`);
    normalized = normalized.replace(/<li\b[^>]*>/gi, '\n- ');
    normalized = normalized.replace(/<\/li>/gi, '');
    normalized = normalized.replace(/<\/?(ul|ol)\b[^>]*>/gi, '\n');
    normalized = normalized.replace(/<\/?(p|div|section|article|blockquote|header|footer|table|tbody|thead|tfoot|tr)\b[^>]*>/gi, '\n');
    normalized = normalized.replace(/<img\b[^>]*src=(['"])(.*?)\1[^>]*>/gi, (_match, _quote, src) => `\n图片: ${String(src).trim()}\n`);
    normalized = normalized.replace(/<[^>]+>/g, '');
    normalized = this._decodeHtmlEntities(normalized);
    normalized = normalized.replace(/\u00A0/g, ' ');
    normalized = normalized.replace(/[ \t]+\n/g, '\n');
    normalized = normalized.replace(/\n{3,}/g, '\n\n');

    return normalized.trim();
  }
}

export { DevOpsBaseAdapter };
export default DevOpsBaseAdapter;
