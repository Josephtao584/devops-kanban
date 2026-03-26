import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import { TaskSourceAdapter, type TaskSourceLike } from './base.js';
import type { ImportedTask, SourceDefinition, SourceRecord } from '../types/sources.ts';

type SourceConfig = SourceRecord['config'];
type Headers = Record<string, string>;
type UnknownRecord = Record<string, unknown>;
type RequestOptions = {
  method?: string;
  body?: unknown;
};

const WORKITEM_LIST_PATH = '/devops-workitem/api/v1/query/workitems';
const WORKITEM_DETAIL_SUFFIX = '/document_detail';

class InternalApiAdapter extends TaskSourceAdapter {
  static override type = 'INTERNAL_API';

  static override metadata: SourceDefinition = {
    type: 'INTERNAL_API',
    name: 'Internal API',
    description: '从内部 API 同步任务（预留两步式适配器配置）',
  };

  baseUrl: string;
  token: string | undefined;
  listPath: string;
  detailPath: string;
  detailIdField: string;
  userId: string | undefined;
  category: string;
  pageSize: number;

  constructor(source: TaskSourceLike) {
    super(source);
    const config = source.config as SourceConfig;
    this.baseUrl = this._normalizeBaseUrl(config.baseUrl);
    this.token = typeof config.token === 'string' ? config.token : undefined;
    this.listPath = typeof config.listPath === 'string' ? config.listPath : '';
    this.detailPath = typeof config.detailPath === 'string' ? config.detailPath : '';
    this.detailIdField = typeof config.detailIdField === 'string' && config.detailIdField ? config.detailIdField : 'id';
    this.userId = typeof config.userId === 'string' && config.userId ? config.userId : undefined;
    this.category = typeof config.category === 'string' && config.category ? config.category : '5';
    this.pageSize = this._parsePositiveInt(config.pageSize, 10);
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
      'User-Agent': 'DevOps-Kanban-App',
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
    return {
      hostname: url.hostname,
      port: url.port || undefined,
      path: url.pathname + url.search,
      headers: this._getHeaders(body),
      method: requestOptions.method || 'GET',
    };
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

      const req = requestFactory(options, (res: IncomingMessage) => {
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
              resolve({ data: this._formatResponseBody(responseBuffer, res.headers['content-encoding']) });
            }
          } else {
            reject(new Error(`Internal API error: ${res.statusCode} - ${this._formatResponseBody(responseBuffer, res.headers['content-encoding'])}`));
          }
        });
      });

      req.on('error', reject);
      if (body !== undefined) {
        req.write(body);
      }
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

      if (data && typeof data === 'object') {
        const result = (data as UnknownRecord).result;
        if (Array.isArray(result)) {
          return result.filter((item): item is UnknownRecord => Boolean(item) && typeof item === 'object');
        }
      }
    }

    throw new Error('Internal API list response must be an array, { data: [] }, or { data: { result: [] } }');
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

  _extractDetailRecords(response: unknown): UnknownRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is UnknownRecord => Boolean(item) && typeof item === 'object');
    }

    if (response && typeof response === 'object') {
      const data = (response as UnknownRecord).data;
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

  _usesWorkitemEndpoints(): boolean {
    return Boolean(this.userId)
      && this.listPath.includes(WORKITEM_LIST_PATH)
      && this.detailPath.includes(WORKITEM_DETAIL_SUFFIX);
  }

  _assertWorkitemSuccessResponse(response: unknown) {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return;
    }

    const code = (response as UnknownRecord).code;
    if (typeof code === 'number' && code !== 200) {
      const message = typeof (response as UnknownRecord).message === 'string'
        ? (response as UnknownRecord).message
        : 'Unknown workitem API error';
      throw new Error(`Internal workitem API error: ${code} - ${message}`);
    }
  }

  _buildWorkitemListBody(page: number) {
    return {
      first_filters: [
        {
          key: 'category',
          operator: '||',
          value: [this.category],
        },
        {
          key: 'mine_todo',
          operator: '||',
          value: [this.userId],
        },
      ],
      sort: {
        key: 'updated_time',
        value: 'desc',
      },
      select_field: ['simple_domain'],
      pagination: {
        current_page: page,
        page_size: this.pageSize,
      },
    };
  }

  _isLastWorkitemPage(response: unknown, itemCount: number): boolean {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return itemCount < this.pageSize;
    }

    const data = (response as UnknownRecord).data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return itemCount < this.pageSize;
    }

    const lastPage = (data as UnknownRecord).last_page;
    if (typeof lastPage === 'boolean') {
      return lastPage;
    }

    const responseCurrentPage = (data as UnknownRecord).current_page;
    const totalPages = (data as UnknownRecord).total_pages;
    if (typeof responseCurrentPage === 'number' && typeof totalPages === 'number') {
      return responseCurrentPage >= totalPages;
    }

    return itemCount < this.pageSize;
  }

  _selectLatestContent(records: UnknownRecord[]): string {
    const contentRecords = records.filter((record) => typeof record.content === 'string' && record.content);
    if (contentRecords.length === 0) {
      return '';
    }

    const firstRecord = contentRecords[0];
    if (!firstRecord) {
      return '';
    }

    let latestRecord: UnknownRecord = firstRecord;
    let latestTime = typeof firstRecord.created_time === 'string' ? firstRecord.created_time : '';

    for (const record of contentRecords.slice(1)) {
      const currentTime = typeof record.created_time === 'string' ? record.created_time : '';

      if (!latestTime && currentTime) {
        latestRecord = record;
        latestTime = currentTime;
        continue;
      }

      if (currentTime > latestTime) {
        latestRecord = record;
        latestTime = currentTime;
      }
    }

    return typeof latestRecord.content === 'string' ? latestRecord.content : '';
  }

  _buildWorkitemTask(item: UnknownRecord, description: string, identifier: unknown): ImportedTask {
    return this.convertToTask({
      ...item,
      content: description,
      id: item.id ?? identifier,
      external_id: item.external_id ?? item.number ?? identifier,
    });
  }

  async _fetchWorkitemTask(item: UnknownRecord): Promise<ImportedTask> {
    const identifier = this._getNestedValue(item, this.detailIdField) ?? item.number ?? item.id ?? item.external_id;
    if (identifier == null || identifier === '') {
      throw new Error(`Internal API list item is missing detail identifier field: ${this.detailIdField}`);
    }

    const detailResponse = await this._request(this._buildDetailPath(identifier));
    this._assertWorkitemSuccessResponse(detailResponse);
    const detailRecords = this._extractDetailRecords(detailResponse);
    const description = this._selectLatestContent(detailRecords);
    return this._buildWorkitemTask(item, description, identifier);
  }

  async _fetchGenericTask(item: UnknownRecord): Promise<ImportedTask> {
    const identifier = this._getNestedValue(item, this.detailIdField) ?? item.id ?? item.external_id;
    if (identifier == null || identifier === '') {
      throw new Error(`Internal API list item is missing detail identifier field: ${this.detailIdField}`);
    }

    const detailResponse = await this._request(this._buildDetailPath(identifier));
    const detail = this._extractDetailObject(detailResponse);
    return this.convertToTask({
      ...item,
      ...detail,
      ...(detail.id == null && item.id == null ? { id: identifier } : {}),
      ...(detail.external_id == null && item.external_id == null ? { external_id: identifier } : {}),
    });
  }

  async _fetchTasks(items: UnknownRecord[], fetchTask: (item: UnknownRecord) => Promise<ImportedTask>): Promise<ImportedTask[]> {
    return Promise.all(items.map((item) => fetchTask.call(this, item)));
  }

  async _fetchGenericTasks(): Promise<ImportedTask[]> {
    const listResponse = await this._request(this.listPath);
    const items = this._extractListItems(listResponse);
    return this._fetchTasks(items, this._fetchGenericTask);
  }

  async _fetchWorkitemTasks(): Promise<ImportedTask[]> {
    const items = await this._fetchWorkitemItems();
    return this._fetchTasks(items, this._fetchWorkitemTask);
  }

  async _fetchWorkitemItems(): Promise<UnknownRecord[]> {
    const items: UnknownRecord[] = [];
    let currentPage = 1;

    while (true) {
      const response = await this._request(this.listPath, {
        method: 'POST',
        body: this._buildWorkitemListBody(currentPage),
      });
      this._assertWorkitemSuccessResponse(response);
      const pageItems = this._extractListItems(response);
      items.push(...pageItems);

      if (this._isLastWorkitemPage(response, pageItems.length)) {
        return items;
      }

      currentPage += 1;
    }
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

    if (this._usesWorkitemEndpoints()) {
      return this._fetchWorkitemTasks();
    }

    return this._fetchGenericTasks();
  }

  override async testConnection(): Promise<boolean> {
    if (!this.baseUrl || !this.listPath) {
      return false;
    }

    try {
      if (this._usesWorkitemEndpoints()) {
        const response = await this._request(this.listPath, {
          method: 'POST',
          body: this._buildWorkitemListBody(1),
        });
        this._assertWorkitemSuccessResponse(response);
        return true;
      }

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
      external_id: String(record.external_id ?? record.id ?? ''),
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
