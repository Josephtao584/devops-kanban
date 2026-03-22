import { request as httpsRequest } from 'node:https';
import type { IncomingMessage } from 'node:http';
import { TaskSourceAdapter, type TaskSourceLike } from './base.js';
import type { ImportedTask, SourceDefinition, SourceRecord } from '../types/sources.ts';

type SourceConfig = SourceRecord['config'];
type Headers = Record<string, string>;
type GitLabIssue = {
  id: number;
  title: string;
  description?: string | null;
  web_url: string;
  state: string;
  labels?: string[];
  created_at?: string;
  updated_at?: string;
};

class GitLabAdapter extends TaskSourceAdapter {
  static override type = 'GITLAB';

  static override metadata: SourceDefinition = {
    type: 'GITLAB',
    name: 'GitLab Issues',
    description: '从 GitLab Issues 同步任务',
    configFields: {
      repo: {
        type: 'string',
        required: true,
        description: 'Project path in format group/project',
      },
      token: {
        type: 'string',
        required: false,
        description: 'GitLab Personal Access Token',
      },
      baseUrl: {
        type: 'string',
        required: false,
        description: 'GitLab API base URL',
      },
      labels: {
        type: 'array',
        required: false,
        description: 'Filter by labels',
      },
    },
  };

  baseUrl: string;
  repo: string;
  token: string | undefined;
  labels: string[] | undefined;

  constructor(source: TaskSourceLike) {
    super(source);
    const config = source.config as SourceConfig;
    this.baseUrl = this._normalizeBaseUrl(config.baseUrl);
    this.repo = this._normalizeRepo(config.repo);
    this.token = typeof config.token === 'string' ? config.token : undefined;
    this.labels = Array.isArray(config.labels) ? config.labels.filter((label): label is string => typeof label === 'string') : undefined;
  }

  _normalizeBaseUrl(baseUrl: unknown): string {
    if (typeof baseUrl !== 'string' || !baseUrl) {
      return 'https://gitlab.com/api/v4';
    }

    return baseUrl.replace(/\/$/, '');
  }

  _normalizeRepo(repo: unknown): string {
    if (typeof repo !== 'string' || !repo) return '';

    const match = repo.match(/gitlab\.com[/:](.+?)(?:\.git)?$/);
    if (match && match[1]) {
      return match[1].replace(/^\/+/, '');
    }

    return repo.replace(/^\/+/, '').replace(/\.git$/, '');
  }

  _getHeaders(): Headers {
    const headers: Headers = {
      'User-Agent': 'DevOps-Kanban-App',
      Accept: 'application/json',
    };

    if (this.token) {
      headers['PRIVATE-TOKEN'] = this.token;
    }

    return headers;
  }

  _request(pathValue: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(pathValue, `${this.baseUrl}/`);
      if (this.labels && this.labels.length > 0) {
        url.searchParams.set('labels', this.labels.join(','));
      }

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: this._getHeaders(),
        method: 'GET',
      };

      const req = httpsRequest(options, (res: IncomingMessage) => {
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
            reject(new Error(`GitLab API error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  override async fetch(): Promise<ImportedTask[]> {
    if (!this.repo) {
      throw new Error('GitLab project not configured. Please set the repo in task source settings.');
    }

    const issues = await this._request(`/projects/${encodeURIComponent(this.repo)}/issues`);
    if (!Array.isArray(issues)) {
      throw new Error(`Unexpected GitLab API response: expected array, got ${typeof issues}`);
    }

    return issues.map((issue) => this.convertToTask(issue));
  }

  override async testConnection(): Promise<boolean> {
    if (!this.repo) {
      return false;
    }

    try {
      await this._request(`/projects/${encodeURIComponent(this.repo)}`);
      return true;
    } catch {
      return false;
    }
  }

  override convertToTask(issue: unknown): ImportedTask {
    const item = issue as GitLabIssue;
    return {
      title: item.title,
      description: item.description || '',
      external_id: item.id.toString(),
      external_url: item.web_url,
      status: item.state === 'opened' ? 'TODO' : 'DONE',
      labels: item.labels || [],
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  }
}

export default GitLabAdapter;
export { GitLabAdapter };
