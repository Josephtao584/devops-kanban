import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import * as https from 'node:https';
import * as yaml from 'yaml';
import { logger } from '../utils/logger.js';

interface NotificationEvents {
  workflowSuspended: boolean;
  workflowCompleted: boolean;
  workflowFailed: boolean;
}

interface NotificationConfig {
  url: string;
  receiver: string;
  auth: string;
  events?: NotificationEvents | undefined;
}

interface HttpResponse {
  ok: boolean;
  status: number;
}

const DEFAULT_EVENTS: NotificationEvents = {
  workflowSuspended: true,
  workflowCompleted: false,
  workflowFailed: false,
};

class NotificationService {
  private filePath: string;
  private defaultYamlPath: string;

  constructor(options: { filePath: string; defaultYamlPath?: string }) {
    this.filePath = path.resolve(options.filePath);
    this.defaultYamlPath = options.defaultYamlPath
      ? path.resolve(options.defaultYamlPath)
      : path.resolve(options.filePath, '..', 'notification-config.yaml');
  }

  async getConfig(): Promise<NotificationConfig | null> {
    // 优先读取用户配置的 JSON 文件
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const config = JSON.parse(raw);
      if (typeof config.url === 'string' && config.url) {
        return { ...config, events: { ...DEFAULT_EVENTS, ...config.events } } as NotificationConfig;
      }
    } catch {
      // JSON 不存在或无效，继续尝试 YAML 默认配置
    }

    // 回退到 YAML 默认配置
    try {
      const raw = await fs.readFile(this.defaultYamlPath, 'utf-8');
      const config = yaml.parse(raw) as NotificationConfig;
      if (config && typeof config.url === 'string' && config.url) {
        return { ...config, events: { ...DEFAULT_EVENTS, ...config.events } };
      }
      return null;
    } catch {
      return null;
    }
  }

  async saveConfig(config: NotificationConfig): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async _httpPost(url: string, body: Record<string, unknown>): Promise<HttpResponse> {
    const urlObj = new URL(url);
    const requestFactory = urlObj.protocol === 'https:' ? https.request : http.request;
    const bodyStr = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || undefined,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      };

      const req = requestFactory(options, (res) => {
        resolve({
          ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode || 0,
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(bodyStr);
      req.end();
    });
  }

  async shouldNotify(eventType: string): Promise<boolean> {
    const config = await this.getConfig();
    if (!config) return false;
    const events = config.events || DEFAULT_EVENTS;
    const key = `workflow${eventType.charAt(0) + eventType.slice(1).toLowerCase()}` as keyof NotificationEvents;
    return events[key] !== false;
  }

  async sendNotification(content: string): Promise<boolean> {
    const config = await this.getConfig();
    if (!config) {
      logger.info('NotificationService', 'No notification config found, skipping');
      return false;
    }

    const payload = {
      content,
      receiver: config.receiver,
      auth: config.auth,
    };

    try {
      const response = await this._httpPost(config.url, payload);
      if (!response.ok) {
        logger.warn('NotificationService', `HTTP notification failed with status ${response.status}`);
        return false;
      }
      logger.info('NotificationService', `Notification sent successfully to ${config.url}`);
      return true;
    } catch (error) {
      logger.warn('NotificationService', `Failed to send notification: ${(error as Error).message}`);
      return false;
    }
  }
}

export { NotificationService };
export default NotificationService;
