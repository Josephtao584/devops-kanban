import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import * as https from 'node:https';
import { logger } from '../utils/logger.js';

interface NotificationConfig {
  url: string;
  receiver: string;
  auth: string;
}

interface HttpResponse {
  ok: boolean;
  status: number;
}

class NotificationService {
  private filePath: string;

  constructor(options: { filePath: string }) {
    this.filePath = path.resolve(options.filePath);
  }

  async getConfig(): Promise<NotificationConfig | null> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const config = JSON.parse(raw);
      if (typeof config.url === 'string' && config.url) {
        return config as NotificationConfig;
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
      req.write(bodyStr);
      req.end();
    });
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
