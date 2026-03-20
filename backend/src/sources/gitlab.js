/**
 * GitLab Issues Adapter
 */
import https from 'https';
import { TaskSourceAdapter } from './base.js';

class GitLabAdapter extends TaskSourceAdapter {
  static type = 'GITLAB';

  static metadata = {
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

  constructor(source) {
    super(source);
    this.baseUrl = this._normalizeBaseUrl(source.config?.baseUrl);
    this.repo = this._normalizeRepo(source.config?.repo);
    this.token = source.config?.token;
    this.labels = source.config?.labels;
  }

  _normalizeBaseUrl(baseUrl) {
    if (!baseUrl) {
      return 'https://gitlab.com/api/v4';
    }

    return baseUrl.replace(/\/$/, '');
  }

  _normalizeRepo(repo) {
    if (!repo) return '';

    const match = repo.match(/gitlab\.com[/:](.+?)(?:\.git)?$/);
    if (match) {
      return match[1].replace(/^\/+/, '');
    }

    return repo.replace(/^\/+/, '').replace(/\.git$/, '');
  }

  _getHeaders() {
    const headers = {
      'User-Agent': 'DevOps-Kanban-App',
      'Accept': 'application/json',
    };

    if (this.token) {
      headers['PRIVATE-TOKEN'] = this.token;
    }

    return headers;
  }

  _request(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, `${this.baseUrl}/`);
      if (this.labels && this.labels.length > 0) {
        url.searchParams.set('labels', this.labels.join(','));
      }

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: this._getHeaders(),
        method: 'GET',
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
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

  async fetch() {
    if (!this.repo) {
      throw new Error('GitLab project not configured. Please set the repo in task source settings.');
    }

    const issues = await this._request(`/projects/${encodeURIComponent(this.repo)}/issues`);
    if (!Array.isArray(issues)) {
      throw new Error(`Unexpected GitLab API response: expected array, got ${typeof issues}`);
    }

    return issues.map((issue) => this.convertToTask(issue));
  }

  async testConnection() {
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

  convertToTask(issue) {
    return {
      title: issue.title,
      description: issue.description || '',
      external_id: issue.id.toString(),
      external_url: issue.web_url,
      status: issue.state === 'opened' ? 'TODO' : 'DONE',
      labels: issue.labels || [],
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    };
  }
}

export default GitLabAdapter;
export { GitLabAdapter };
