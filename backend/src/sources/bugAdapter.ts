import { DevOpsBaseAdapter } from './devOpsBase.js';
import type { TaskSourceLike } from './base.js';
import type { ImportedTask, SourceDefinition } from '../types/sources.ts';
import { logger } from '../utils/logger.js';

type UnknownRecord = Record<string, unknown>;

interface BugDescriptionNode {
  value?: string | null;
  children?: BugDescriptionNode[];
}

const DEFAULT_BUG_LIST_PATH = '/vision-defect-management/api/query/issues';
const DEFAULT_BUG_DETAIL_PATH = '/vision-defect-management/api/bugs/bugDetail/{number}';

class BugAdapter extends DevOpsBaseAdapter {
  static override type = 'CLOUDDEVOPS_BUG';

  static override metadata: SourceDefinition = {
    type: 'CLOUDDEVOPS_BUG',
    name: 'CloudDevOps Bug',
    description: '从 CloudDevOps 同步 Bug 任务',
  };

  userId: string | undefined;

  constructor(source: TaskSourceLike) {
    super(source);
    const config = source.config as Record<string, unknown>;
    this.userId = typeof config.userId === 'string' && config.userId ? config.userId : undefined;
    if (!this.listPath) this.listPath = DEFAULT_BUG_LIST_PATH;
    if (!this.detailPath) this.detailPath = DEFAULT_BUG_DETAIL_PATH;
    if (typeof config.detailIdField !== 'string' || !config.detailIdField) this.detailIdField = 'number';
  }

  _buildBugListBody(page: number): Record<string, unknown> {
    return {
      filters: [
        { key: 'user_status', operator: '!', value: ['ISSUE_STATUS_DONE'] },
        { key: 'current_owners', operator: '||', value: [this.userId != null ? (Number(this.userId) || this.userId) : ''] },
      ],
      sorts: [
        { key: 'updated_time', value: 'desc' },
      ],
      pagination: { current_page: page, page_size: this.pageSize },
    };
  }

  _isLastBugPage(response: unknown, itemCount: number): boolean {
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

    return itemCount < this.pageSize;
  }

  _parseBugDescriptionFromNodes(nodes: BugDescriptionNode[]): string {
    const parts: string[] = [];
    function traverse(items: BugDescriptionNode[]) {
      for (const node of items) {
        if (node.value) {
          parts.push(node.value);
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    }
    traverse(nodes);
    return parts.join('\n');
  }

  _parseBugDescription(response: unknown): string {
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

    const descriptionField = (data as UnknownRecord).description;
    if (typeof descriptionField !== 'string' || !descriptionField) {
      return '';
    }

    let nodes: BugDescriptionNode[];
    try {
      nodes = JSON.parse(descriptionField);
    } catch {
      return this._normalizeWorkitemDescription(descriptionField);
    }

    if (!Array.isArray(nodes)) {
      return this._normalizeWorkitemDescription(descriptionField);
    }

    const rawDescription = this._parseBugDescriptionFromNodes(nodes);
    return this._normalizeWorkitemDescription(rawDescription);
  }

  _assertBugSuccessResponse(response: unknown): void {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return;
    }

    const code = (response as UnknownRecord).code;
    if (typeof code === 'number' && code !== 200) {
      const message = typeof (response as UnknownRecord).message === 'string'
        ? (response as UnknownRecord).message
        : 'Unknown Bug API error';
      throw new Error(`Bug API error: ${code} - ${message}`);
    }
  }

  async _fetchBugItems(options?: { limit?: number; offset?: number }): Promise<UnknownRecord[]> {
    const items: UnknownRecord[] = [];
    let currentPage = 1;
    const maxPages = 20;
    const limit = options?.limit;

    while (currentPage <= maxPages) {
      const body = this._buildBugListBody(currentPage);
      let response: unknown;
      try {
        response = await this._request(this.listPath, {
          method: 'POST',
          body,
        });
        this._assertBugSuccessResponse(response);
      } catch (error) {
        logger.warn('BugAdapter', `Page ${currentPage} request failed, stopping pagination`);
        break;
      }

      let pageItems: UnknownRecord[] = [];
      try {
        pageItems = this._extractListItems(response);
      } catch (error) {
        logger.warn('BugAdapter', `Page ${currentPage} response format invalid, stopping pagination`);
        break;
      }

      items.push(...pageItems);

      if (limit != null && items.length >= limit) {
        return items.slice(0, limit);
      }

      if (this._isLastBugPage(response, pageItems.length)) {
        return items;
      }

      currentPage += 1;
    }

    return items;
  }

  override async fetch(options?: { limit?: number; offset?: number }): Promise<ImportedTask[]> {
    if (!this.baseUrl) {
      throw new Error('Bug API baseUrl is required.');
    }
    if (!this.userId) {
      throw new Error('Bug API userId is required.');
    }

    const items = await this._fetchBugItems(options);
    const tasks: ImportedTask[] = [];

    for (const item of items) {
      const identifier = this._getNestedValue(item, this.detailIdField) ?? item.number ?? item.id;
      if (identifier == null || identifier === '') {
        throw new Error(`Bug API list item is missing identifier field: ${this.detailIdField}`);
      }

      const detailPath = this._buildDetailPath(identifier);
      const detailResponse = await this._request(detailPath);
      const description = this._parseBugDescription(detailResponse);

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
        body: this._buildBugListBody(1),
      });
      this._assertBugSuccessResponse(response);
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
      ? `${this.baseUrl}/#/bug/${externalId}`
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

export { BugAdapter };
export default BugAdapter;
