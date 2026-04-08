import { DevOpsBaseAdapter } from './devOpsBase.js';
import type { TaskSourceLike } from './base.js';
import type { ImportedTask, SourceDefinition } from '../types/sources.ts';

type UnknownRecord = Record<string, unknown>;

interface DescriptionNode {
  attr_key?: string;
  attr_name?: string;
  value?: string | null;
  children?: DescriptionNode[];
}

const DEFAULT_RR_LIST_PATH = '/vision-workitem/api/query/requirements/single_list';
const DEFAULT_RR_DETAIL_PATH = '/vision-workitem/api/raw_requirements/{number}/description';

class RRAdapter extends DevOpsBaseAdapter {
  static override type = 'CLOUDDEVOPS_RR';

  static override metadata: SourceDefinition = {
    type: 'CLOUDDEVOPS_RR',
    name: 'CloudDevOps RR',
    description: '从 CloudDevOps 同步需求（RR）任务',
  };

  userId: string | undefined;

  constructor(source: TaskSourceLike) {
    super(source);
    const config = source.config as Record<string, unknown>;
    this.userId = typeof config.userId === 'string' && config.userId ? config.userId : undefined;
    if (!this.listPath) this.listPath = DEFAULT_RR_LIST_PATH;
    if (!this.detailPath) this.detailPath = DEFAULT_RR_DETAIL_PATH;
    if (typeof config.detailIdField !== 'string' || !config.detailIdField) this.detailIdField = 'number';
  }

  _buildRRListBody(page: number): Record<string, unknown> {
    return {
      data_type: 'list',
      select_field: ['all'],
      first_filters: [
        { key: 'user_status', operator: '!', value: ['REQ_STATUS_DONE'] },
        { key: 'current_owners', operator: '||', value: [this.userId != null ? (Number(this.userId) || this.userId) : ''] },
      ],
      sort: { key: 'updated_time', value: 'desc' },
      pagination: { current_page: page, page_size: this.pageSize },
    };
  }

  _isLastRRPage(response: unknown, itemCount: number): boolean {
    // 如果响应格式不对，立即停止（可能是错误响应）
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return true;
    }

    const data = (response as UnknownRecord).data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return true;
    }

    const totalPages = (data as UnknownRecord).total_pages;
    const currentPage = (data as UnknownRecord).current_page;
    if (typeof totalPages === 'number' && typeof currentPage === 'number') {
      return currentPage >= totalPages;
    }

    // 没有分页信息时，如果返回item数量少于pageSize，说明是最后一页
    // 否则继续请求下一页
    return itemCount < this.pageSize;
  }

  _concatDescriptions(descriptions: DescriptionNode[]): string {
    const parts: string[] = [];

    function traverse(nodes: DescriptionNode[]) {
      for (const node of nodes) {
        if (node.attr_name) {
          parts.push(node.attr_name);
        }
        if (node.value) {
          parts.push(node.value);
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    }

    traverse(descriptions);
    return parts.join('\n');
  }

  _parseRRDescriptionResponse(response: unknown): string {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return '';
    }

    const code = (response as UnknownRecord).code;
    if (typeof code === 'number' && code !== 200) {
      return '';
    }

    const data = (response as UnknownRecord).data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return '';
    }

    const descriptions = (data as UnknownRecord).descriptions;
    if (!Array.isArray(descriptions)) {
      return '';
    }

    const rawDescription = this._concatDescriptions(descriptions as DescriptionNode[]);
    return this._normalizeWorkitemDescription(rawDescription);
  }

  _assertRRSuccessResponse(response: unknown): void {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return;
    }

    const code = (response as UnknownRecord).code;
    if (typeof code === 'number' && code !== 200) {
      const message = typeof (response as UnknownRecord).message === 'string'
        ? (response as UnknownRecord).message
        : 'Unknown RR API error';
      throw new Error(`RR API error: ${code} - ${message}`);
    }
  }

  async _fetchRRItems(options?: { limit?: number; offset?: number }): Promise<UnknownRecord[]> {
    const items: UnknownRecord[] = [];
    let currentPage = 1;
    const maxPages = 20; // 安全限制，防止无限循环和过长等待
    const limit = options?.limit;

    while (currentPage <= maxPages) {
      const body = this._buildRRListBody(currentPage);
      let response: unknown;
      try {
        response = await this._request(this.listPath, {
          method: 'POST',
          body,
        });
        this._assertRRSuccessResponse(response);
      } catch (error) {
        // 请求失败或响应错误时停止分页
        console.warn(`[RRAdapter] Page ${currentPage} request failed, stopping pagination`);
        break;
      }

      let pageItems: UnknownRecord[] = [];
      try {
        pageItems = this._extractListItems(response);
      } catch (error) {
        // 响应格式错误时停止分页
        console.warn(`[RRAdapter] Page ${currentPage} response format invalid, stopping pagination`);
        break;
      }

      items.push(...pageItems);

      // 如果已达到限制数量，停止分页
      if (limit != null && items.length >= limit) {
        return items.slice(0, limit);
      }

      if (this._isLastRRPage(response, pageItems.length)) {
        return items;
      }

      currentPage += 1;
    }

    return items;
  }

  override async fetch(options?: { limit?: number; offset?: number }): Promise<ImportedTask[]> {
    if (!this.baseUrl) {
      throw new Error('RR API baseUrl is required.');
    }
    if (!this.userId) {
      throw new Error('RR API userId is required.');
    }

    const items = await this._fetchRRItems(options);
    const tasks: ImportedTask[] = [];

    for (const item of items) {
      const identifier = this._getNestedValue(item, this.detailIdField) ?? item.number ?? item.id;
      if (identifier == null || identifier === '') {
        throw new Error(`RR API list item is missing identifier field: ${this.detailIdField}`);
      }

      const detailPath = `/vision-workitem/api/raw_requirements/${encodeURIComponent(String(identifier))}/description`;
      const detailResponse = await this._request(detailPath);
      const description = this._parseRRDescriptionResponse(detailResponse);

      const task = this.convertToTask({
        ...item,
        description,
        id: item.id ?? identifier,
        external_id: item.external_id ?? item.number ?? identifier,
      });

      tasks.push(task);
    }

    return tasks;
  }

  override async testConnection(): Promise<boolean> {
    if (!this.baseUrl || !this.listPath) {
      return false;
    }

    try {
      const response = await this._request(this.listPath, {
        method: 'POST',
        body: this._buildRRListBody(1),
      });
      this._assertRRSuccessResponse(response);
      return true;
    } catch {
      return false;
    }
  }

  override convertToTask(item: unknown): ImportedTask {
    const record = (item ?? {}) as UnknownRecord;
    const title = typeof record.title === 'string' && record.title ? record.title : 'Untitled';
    const description = typeof record.description === 'string' ? record.description : '';
    const externalId = typeof record.number === 'string' && record.number
      ? record.number
      : String(record.external_id ?? record.id ?? '');
    const externalUrl = this.baseUrl && externalId
      ? `${this.baseUrl}/#/raw/${externalId}`
      : '';

    return {
      external_id: externalId,
      title,
      description,
      external_url: externalUrl,
      status: 'TODO',
      labels: [],
      created_at: record.created_time ?? null,
      updated_at: record.updated_time ?? null,
    };
  }
}

export { RRAdapter };
export default RRAdapter;
