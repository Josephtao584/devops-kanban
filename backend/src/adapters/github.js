/**
 * GitHub Issues Adapter
 */
import { TaskSourceAdapter } from './base.js';
import https from 'https';

class GitHubAdapter extends TaskSourceAdapter {
  constructor(source) {
    super(source);
    this.baseUrl = 'https://api.github.com';
    this.repo = this._normalizeRepo(source.config?.repo);
    this.token = source.config?.token;
    this.labels = source.config?.labels;
  }

  /**
   * Static metadata for adapter registry
   */
  static metadata = {
    name: 'GitHub Issues',
    description: '从 GitHub Issues 同步任务',
    config: {
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
      labels: {
        type: 'array',
        required: false,
        description: 'Filter by labels',
      },
    },
  };

  /**
   * Normalize repo string (handle both full URL and owner/repo format)
   * @param {string} repo - Repo string
   * @returns {string} Normalized repo
   */
  _normalizeRepo(repo) {
    if (!repo) return '';
    // If it's a full URL like https://github.com/owner/repo.git
    const match = repo.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return repo;
  }

  /**
   * Get headers for GitHub API requests
   * @returns {object} Request headers
   */
  _getHeaders() {
    const headers = {
      'User-Agent': 'DevOps-Kanban-App',
      'Accept': 'application/vnd.github.v3+json',
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    return headers;
  }

  /**
   * Make HTTPS request to GitHub API
   * @param {string} path - API path
   * @returns {Promise<object>} Response data
   */
  _request(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
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
            } catch (e) {
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

  /**
   * Fetch issues from GitHub
   * @returns {Promise<Array>} Issues
   */
  async fetch() {
    if (!this.repo) {
      throw new Error('GitHub repository not configured. Please set the repo in task source settings.');
    }
    const issues = await this._request(`/repos/${this.repo}/issues`);
    if (!Array.isArray(issues)) {
      throw new Error(`Unexpected GitHub API response: expected array, got ${typeof issues}`);
    }
    return issues.map((issue) => this.convertToTask(issue));
  }

  /**
   * Test GitHub connection
   * @returns {Promise<boolean>} True if successful
   */
  async testConnection() {
    try {
      await this._request(`/repos/${this.repo}`);
      return true;
    } catch (error) {
      console.error('GitHub connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Convert GitHub issue to task format
   * @param {object} issue - GitHub issue
   * @returns {object} Task data
   */
  convertToTask(issue) {
    return {
      title: issue.title,
      description: issue.body || '',
      external_id: issue.id.toString(),
      external_url: issue.html_url,
      status: issue.state === 'open' ? 'TODO' : 'DONE',
      labels: (issue.labels || []).map((label) => label.name),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    };
  }
}

export { GitHubAdapter };
