import { request as httpsRequest } from 'node:https';
import type { IncomingMessage } from 'node:http';
import { TaskSourceAdapter, type TaskSourceLike } from './base.js';
import type { ImportedTask, SourceDefinition, SourceRecord } from '../types/sources.ts';

type SourceConfig = SourceRecord['config'];
type Headers = Record<string, string>;
type GitHubIssue = {
  id: number;
  title: string;
  body?: string | null;
  html_url: string;
  state: string;
  labels?: Array<{ name?: string } | string>;
  created_at?: string;
  updated_at?: string;
};

class GitHubAdapter extends TaskSourceAdapter {
  static override type = 'GITHUB';

  static override metadata: SourceDefinition = {
    type: 'GITHUB',
    name: 'GitHub Issues',
    description: '从 GitHub Issues 同步任务',
    configFields: {
      repo: {
        type: 'string',
        required: true,
        description: 'Repository in format owner/repo',
      },
      token: {
        type: 'string',
        required: false,
        description: 'GitHub Personal Access Token',
      },
      state: {
        type: 'string',
        required: false,
        description: 'Issue state filter: open, closed, or all',
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
  state: string;

  constructor(source: TaskSourceLike) {
    super(source);
    const config = source.config as SourceConfig;
    this.baseUrl = 'https://api.github.com';
    this.repo = this._normalizeRepo(config.repo);
    this.token = typeof config.token === 'string' ? config.token : undefined;
    this.state = typeof config.state === 'string' ? config.state : 'open';
    this.labels = Array.isArray(config.labels) ? config.labels.filter((label): label is string => typeof label === 'string') : undefined;
  }

  _normalizeRepo(repo: unknown): string {
    if (typeof repo !== 'string' || !repo) return '';
    const match = repo.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return repo;
  }

  _getHeaders(): Headers {
    const headers: Headers = {
      'User-Agent': 'DevOps-Kanban-App',
      Accept: 'application/vnd.github.v3+json',
    };

    if (this.token) {
      headers.Authorization = `token ${this.token}`;
    }

    return headers;
  }

  _request(pathValue: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(pathValue, this.baseUrl);
      url.searchParams.set('state', this.state);
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
            reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  override async fetch(options?: { limit?: number; offset?: number }): Promise<ImportedTask[]> {
    if (!this.repo) {
      throw new Error('GitHub repository not configured. Please set the repo in task source settings.');
    }
    const issues = await this._request(`/repos/${this.repo}/issues`);
    if (!Array.isArray(issues)) {
      throw new Error(`Unexpected GitHub API response: expected array, got ${typeof issues}`);
    }
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? issues.length;
    return issues.slice(offset, offset + limit).map((issue) => this.convertToTask(issue));
  }

  override async testConnection(): Promise<boolean> {
    try {
      await this._request(`/repos/${this.repo}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('GitHub connection test failed:', message);
      return false;
    }
  }

  override convertToTask(issue: unknown): ImportedTask {
    const item = issue as GitHubIssue;
    return {
      title: item.title,
      description: item.body || '',
      external_id: item.id.toString(),
      external_url: item.html_url,
      status: item.state === 'open' ? 'TODO' : 'DONE',
      labels: (item.labels || []).map((label) => typeof label === 'string' ? label : (label.name || '')).filter(Boolean),
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  }
}

export { GitHubAdapter };
