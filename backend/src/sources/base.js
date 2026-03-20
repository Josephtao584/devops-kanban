/**
 * Base Task Source Adapter
 */
class TaskSourceAdapter {
  static type = null;

  static metadata = null;

  constructor(source) {
    this.source = source;
  }

  /**
   * Fetch items from external source
   * @returns {Promise<Array>} Fetched items
   */
  async fetch() {
    throw new Error('fetch() must be implemented by subclass');
  }

  /**
   * Test connection to external source
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    throw new Error('testConnection() must be implemented by subclass');
  }

  /**
   * Convert external item to task format
   * @param {object} item - External item
   * @returns {object} Task data
   */
  convertToTask(item) {
    throw new Error('convertToTask() must be implemented by subclass');
  }

  static validateDefinition() {
    if (!this.type || typeof this.type !== 'string') {
      throw new Error(`${this.name || 'Adapter'} must define static type`);
    }
  }
}

/**
 * Universal Adapter - Executes requests based on config.yaml definition
 */
class UniversalAdapter extends TaskSourceAdapter {
  constructor(source, adapterConfig) {
    super(source);
    this.adapterConfig = adapterConfig;
    this.request = adapterConfig.request || {};
    this.response = adapterConfig.response || {};
    this.mapping = adapterConfig.mapping || {};
    this.transforms = adapterConfig.transforms || {};
  }

  /**
   * Normalize repo string to owner/repo format
   * Handles full URLs like https://github.com/owner/repo.git
   */
  _normalizeRepo(repo) {
    if (!repo) return '';

    // GitHub URLs: https://github.com/owner/repo or https://github.com/owner/repo.git
    const githubMatch = repo.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (githubMatch) {
      return `${githubMatch[1]}/${githubMatch[2]}`;
    }

    // GitLab URLs: https://gitlab.com/owner/repo or https://gitlab.com/owner/repo.git
    const gitlabMatch = repo.match(/gitlab\.com[/:]([^/]+)\/([^/.]+)/);
    if (gitlabMatch) {
      return `${gitlabMatch[1]}/${gitlabMatch[2]}`;
    }

    return repo;
  }

  /**
   * Substitute config placeholders in a string, with normalization support
   */
  _substituteWithNormalization(value, config) {
    if (typeof value !== 'string') {
      return value;
    }
    return value.replace(/\{([^}]+)\}/g, (_, key) => {
      const keys = key.split('.');
      let val = config;
      for (const k of keys) {
        if (val == null || typeof val !== 'object') {
          return '';
        }
        val = val[k];
      }
      if (val != null) {
        // Normalize repo URLs
        if (key === 'repo') {
          val = this._normalizeRepo(val);
        }
        return typeof val === 'string' ? val : String(val);
      }
      return '';
    });
  }

  /**
   * Build the full URL with path placeholders resolved
   */
  _buildUrl(path, params) {
    const baseUrl = this._substitutePlaceholders(this.request.baseUrl);
    const resolvedPath = this._substituteWithNormalization(path, this.source.config);

    const url = new URL(resolvedPath, baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl);

    // Add query params
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        const resolvedValue = this._substituteWithNormalization(value, this.source.config);
        if (resolvedValue) {
          url.searchParams.set(key, resolvedValue);
        }
      }
    }

    return url;
  }

  /**
   * Substitute config placeholders in a string
   */
  _substitutePlaceholders(value) {
    if (typeof value !== 'string') {
      return value;
    }
    return value.replace(/\{([^}]+)\}/g, (_, key) => {
      const keys = key.split('.');
      let val = this.source.config;
      for (const k of keys) {
        if (val == null || typeof val !== 'object') {
          return '';
        }
        val = val[k];
      }
      return val != null ? val : '';
    });
  }

  /**
   * Build headers object with placeholders resolved
   * Filters out headers with empty values or broken tokens
   */
  _buildHeaders(headers) {
    if (!headers) return {};
    const resolved = {};
    for (const [key, value] of Object.entries(headers)) {
      let resolvedValue = this._substitutePlaceholders(value);
      // Skip headers with empty/whitespace-only values
      if (!resolvedValue || !resolvedValue.trim()) {
        continue;
      }
      // Fix broken Authorization header like "token " (when token is empty)
      if (key === 'Authorization' && resolvedValue === 'token ') {
        continue;
      }
      resolved[key] = resolvedValue;
    }
    return resolved;
  }

  /**
   * Execute HTTP request using native https
   */
  async _httpRequest(url, method, headers) {
    const https = await import('https');

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers,
        method: method.toUpperCase(),
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
            reject(new Error(`HTTP error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Parse response using JSONPath-like expressions
   */
  _getNestedValue(obj, path) {
    if (!path || path === '') {
      return obj;
    }

    // Handle root path
    if (path.startsWith('$.')) {
      const parts = path.slice(2).split('.');
      let current = obj;

      for (const part of parts) {
        if (current == null) return undefined;

        // Handle array wildcard like labels[*].name
        if (part.includes('[*]')) {
          const [arrayKey, prop] = part.split('[*].');
          const arr = current[arrayKey];
          if (!Array.isArray(arr)) return undefined;
          if (prop) {
            return arr.map((item) => item?.[prop]).filter((v) => v != null);
          }
          return arr;
        }

        current = current[part];
      }

      return current;
    }

    return undefined;
  }

  /**
   * Apply transform to a value
   */
  _applyTransform(value, transform, field) {
    if (value == null) return value;

    // Handle status mapping: { open: TODO, closed: DONE }
    if (transform && typeof transform === 'object' && !Array.isArray(transform)) {
      return transform[value] ?? value;
    }

    // Handle string transforms like "toString"
    if (typeof transform === 'string') {
      switch (transform) {
        case 'toString':
          return String(value);
        case 'toInt':
          return parseInt(value, 10);
        case 'toFloat':
          return parseFloat(value);
        case 'toBoolean':
          return Boolean(value);
        case 'arrayMap(name)':
          // For arrays of objects, extract 'name' field
          if (Array.isArray(value)) {
            return value.map((item) => (item?.name ?? item)).filter((v) => v != null);
          }
          return value;
        case 'arrayMap(id)':
          if (Array.isArray(value)) {
            return value.map((item) => (item?.id ?? item)).filter((v) => v != null);
          }
          return value;
        default:
          return value;
      }
    }

    return value;
  }

  /**
   * Apply mapping and transforms to a raw item
   */
  _mapItem(item) {
    const result = {};

    for (const [field, jsonPath] of Object.entries(this.mapping)) {
      let value = this._getNestedValue(item, jsonPath);
      const transform = this.transforms[field];

      if (transform) {
        value = this._applyTransform(value, transform, field);
      }

      result[field] = value;
    }

    return result;
  }

  /**
   * Fetch items from external source using config
   */
  async fetch() {
    const { method = 'GET', params = {} } = this.request;
    const headers = this._buildHeaders(this.request.headers);
    const url = this._buildUrl(this.request.path, params);

    console.log(`[TaskSource] Fetch request URL: ${url.toString()}`);
    const response = await this._httpRequest(url.toString(), method, headers);

    // Extract array from response
    let items;
    if (this.response.path) {
      items = this._getNestedValue(response, this.response.path);
    } else {
      items = response;
    }

    if (!Array.isArray(items)) {
      throw new Error(`Expected array in response, got ${typeof items}`);
    }

    // Map items to task format
    return items.map((item) => this.convertToTask(this._mapItem(item)));
  }

  /**
   * Test connection using config
   */
  async testConnection() {
    try {
      const url = this._buildUrl(this.request.path, {});
      console.log(`[TaskSource] Test connection URL: ${url.toString()}`);
      await this._httpRequest(url.toString(), 'GET', this._buildHeaders(this.request.headers));
      return true;
    } catch (error) {
      console.error('Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Convert mapped item to task format
   */
  convertToTask(item) {
    // item is already mapped from _mapItem
    return {
      title: item.title || 'Untitled',
      description: item.description || '',
      external_id: item.external_id?.toString() || '',
      external_url: item.external_url || '',
      status: item.status || 'TODO',
      labels: Array.isArray(item.labels) ? item.labels : [],
      created_at: item.created_at || null,
      updated_at: item.updated_at || null,
    };
  }
}

export { TaskSourceAdapter, UniversalAdapter };
