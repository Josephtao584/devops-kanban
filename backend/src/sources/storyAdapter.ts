import { DevOpsBaseAdapter } from './devOpsBase.js';
import type { ImportedTask, SourceDefinition } from '../types/sources.ts';

type UnknownRecord = Record<string, unknown>;

const WORKITEM_LIST_PATH = '/devops-workitem/api/v1/query/workitems';
const WORKITEM_DETAIL_SUFFIX = '/document_detail';

class StoryAdapter extends DevOpsBaseAdapter {
  static override type = 'INTERNAL_API';

  static override metadata: SourceDefinition = {
    type: 'INTERNAL_API',
    name: 'Internal API',
    description: '从内部 API 同步任务（预留两步式适配器配置）',
  };

  userId: string | undefined;
  category: string;
  status: string;

  constructor(source: { config: Record<string, unknown> }) {
    super(source);
    const config = source.config;
    this.userId = typeof config.userId === 'string' && config.userId ? config.userId : undefined;
    this.category = typeof config.category === 'string' && config.category ? config.category : '5';
    this.status = typeof config.status === 'string' && config.status ? config.status : '131';
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
          value: [this.userId != null ? (Number(this.userId) || this.userId) : ''],
        },
        {
          key: 'status',
          operator: '||',
          value: [Number(this.status) || this.status],
        },
      ],
      sort: {
        key: 'updated_time',
        value: 'desc',
      },
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
      description,
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

    // Use description from list response directly if available (no detail fetch needed)
    const description = typeof item.description === 'string' ? item.description : '';
    if (description) {
      return this._buildWorkitemTask(item, description, identifier);
    }

    // Fall back to detail API if description not in list response
    const detailResponse = await this._request(this._buildDetailPath(identifier));
    this._assertWorkitemSuccessResponse(detailResponse);
    const detailRecords = this._extractDetailRecords(detailResponse);
    const detailDescription = this._selectLatestContent(detailRecords);
    return this._buildWorkitemTask(item, detailDescription, identifier);
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

  async _fetchGenericTasks(options?: { limit?: number; offset?: number }): Promise<ImportedTask[]> {
    const listResponse = await this._request(this.listPath);
    const items = this._extractListItems(listResponse);
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? items.length;
    const sliced = items.slice(offset, offset + limit);
    return this._fetchTasks(sliced, this._fetchGenericTask);
  }

  async _fetchWorkitemTasks(options?: { limit?: number; offset?: number }): Promise<ImportedTask[]> {
    const items = await this._fetchWorkitemItems(options);
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? items.length;
    const sliced = items.slice(offset, offset + limit);
    return this._fetchTasks(sliced, this._fetchWorkitemTask);
  }

  async _fetchWorkitemItems(options?: { limit?: number; offset?: number }): Promise<UnknownRecord[]> {
    const items: UnknownRecord[] = [];
    let currentPage = 1;
    const limit = options?.limit;

    while (true) {
      const response = await this._request(this.listPath, {
        method: 'POST',
        body: this._buildWorkitemListBody(currentPage),
      });
      this._assertWorkitemSuccessResponse(response);
      const pageItems = this._extractListItems(response);
      items.push(...pageItems);

      if (limit != null && items.length >= limit) {
        return items.slice(0, limit);
      }

      if (this._isLastWorkitemPage(response, pageItems.length)) {
        return items;
      }

      currentPage += 1;
    }
  }

  override async fetch(options?: { limit?: number; offset?: number }): Promise<ImportedTask[]> {
    if (!this.baseUrl) {
      throw new Error('Internal API baseUrl is required.');
    }
    if (!this.listPath) {
      throw new Error('Internal API listPath is required.');
    }
    if (!this.detailPath) {
      throw new Error('Internal API detailPath is required.');
    }

    const fetchOptions = {
      ...(options?.limit !== undefined ? { limit: options.limit } : {}),
      ...(options?.offset !== undefined ? { offset: options.offset } : {}),
    };

    if (this._usesWorkitemEndpoints()) {
      return this._fetchWorkitemTasks(fetchOptions);
    }

    return this._fetchGenericTasks(fetchOptions);
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
    const rawDescription = [record.description, record.body, record.content].find((value) => typeof value === 'string') as string | undefined;
    const description = this._usesWorkitemEndpoints()
      ? this._normalizeWorkitemDescription(rawDescription || '')
      : (rawDescription || '');
    const externalUrl = [record.url, record.external_url, record.html_url].find((value) => typeof value === 'string') as string | undefined;

    return {
      external_id: String(record.external_id ?? record.id ?? ''),
      title: title || 'Untitled',
      description,
      external_url: externalUrl || '',
      status: this._mapStatus(record.status ?? record.state),
      labels: this._mapLabels(record.labels),
      created_at: record.created_at ?? null,
      updated_at: record.updated_at ?? null,
    };
  }
}

export { StoryAdapter };
export { StoryAdapter as InternalApiAdapter };
export default StoryAdapter;
