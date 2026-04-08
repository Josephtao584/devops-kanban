import { DevOpsBaseAdapter } from './devOpsBase.js';
import type { TaskSourceLike } from './base.js';
import type { ImportedTask, SourceDefinition } from '../types/sources.ts';
import { logger } from '../utils/logger.js';

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
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return itemCount < this.pageSize;
    }

    const data = (response as UnknownRecord).data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return itemCount < this.pageSize;
    }

    const totalPages = (data as UnknownRecord).total_pages;
    const currentPage = (data as UnknownRecord).current_page;
    if (typeof totalPages === 'number' && typeof currentPage === 'number') {
      return currentPage >= totalPages;
    }

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
      logger.info('RRAdapter', `_parseRRDescriptionResponse: invalid response type: ${typeof response}`);
      return '';
    }

    const code = (response as UnknownRecord).code;
    if (typeof code === 'number' && code !== 200) {
      logger.info('RRAdapter', `_parseRRDescriptionResponse: non-200 code: ${code}`);
      return '';
    }

    const data = (response as UnknownRecord).data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      logger.info('RRAdapter', `_parseRRDescriptionResponse: invalid data, type: ${typeof data}, isArray: ${Array.isArray(data)}`);
      return '';
    }

    const descriptions = (data as UnknownRecord).descriptions;
    if (!Array.isArray(descriptions)) {
      logger.info('RRAdapter', `_parseRRDescriptionResponse: descriptions is not array, data keys: ${Object.keys(data as UnknownRecord).join(',')}`);
      return '';
    }

    logger.info('RRAdapter', `_parseRRDescriptionResponse: found ${descriptions.length} description nodes`);
    const rawDescription = this._concatDescriptions(descriptions as DescriptionNode[]);
    logger.info('RRAdapter', `_parseRRDescriptionResponse: raw HTML length=${rawDescription.length}`);
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

  async _fetchRRItems(): Promise<UnknownRecord[]> {
    const items: UnknownRecord[] = [];
    let currentPage = 1;

    logger.info('RRAdapter', `Fetching list page ${currentPage}, listPath: ${this.listPath}`);

    while (true) {
      const body = this._buildRRListBody(currentPage);
      logger.info('RRAdapter', `List request body: ${JSON.stringify(body)}`);
      const response = await this._request(this.listPath, {
        method: 'POST',
        body,
      });
      logger.info('RRAdapter', `List response: ${JSON.stringify(response)}`);
      this._assertRRSuccessResponse(response);
      const pageItems = this._extractListItems(response);
      logger.info('RRAdapter', `Page ${currentPage} extracted ${pageItems.length} items`);
      items.push(...pageItems);

      if (this._isLastRRPage(response, pageItems.length)) {
        logger.info('RRAdapter', `Total items fetched: ${items.length}`);
        return items;
      }

      currentPage += 1;
    }
  }

  override async fetch(): Promise<ImportedTask[]> {
    if (!this.baseUrl) {
      throw new Error('RR API baseUrl is required.');
    }
    if (!this.userId) {
      throw new Error('RR API userId is required.');
    }

    const items = await this._fetchRRItems();
    const tasks: ImportedTask[] = [];

    for (const item of items) {
      const identifier = this._getNestedValue(item, this.detailIdField) ?? item.number ?? item.id;
      if (identifier == null || identifier === '') {
        throw new Error(`RR API list item is missing identifier field: ${this.detailIdField}`);
      }

      const detailPath = `/vision-workitem/api/raw_requirements/${encodeURIComponent(String(identifier))}/description`;
      logger.info('RRAdapter', `Fetching detail for identifier: ${identifier}, detailPath: ${detailPath}, detailIdField: ${this.detailIdField}`);
      const detailResponse = await this._request(detailPath);
      logger.info('RRAdapter', `Detail response for ${identifier}: ${JSON.stringify(detailResponse)}`);
      const description = this._parseRRDescriptionResponse(detailResponse);
      logger.info('RRAdapter', `Parsed description for ${identifier}: length=${description.length}, preview=${description.substring(0, 200)}`);

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
