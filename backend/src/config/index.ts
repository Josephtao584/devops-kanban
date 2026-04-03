import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(FILE_DIR, '..', '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');
const STORAGE_PATH = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.join(PROJECT_ROOT, 'data');
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '8000', 10) || 8000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');

function resolveTaskSourceConfigPath() {
  if (process.env.TASK_SOURCE_CONFIG_PATH) {
    return path.resolve(process.env.TASK_SOURCE_CONFIG_PATH);
  }

  const backendTaskSourceConfig = path.join(BACKEND_ROOT, 'task-sources', 'config.yaml');
  if (fs.existsSync(backendTaskSourceConfig)) {
    return backendTaskSourceConfig;
  }

  return path.join(PROJECT_ROOT, 'backend', 'task-sources', 'config.yaml');
}

const TASK_SOURCE_CONFIG_PATH = resolveTaskSourceConfigPath();
const TASK_SOURCE_DATA_PATH = process.env.TASK_SOURCE_DATA_PATH
  ? path.resolve(process.env.TASK_SOURCE_DATA_PATH)
  : path.join(STORAGE_PATH);

export {
  BACKEND_ROOT,
  PROJECT_ROOT,
  STORAGE_PATH,
  SERVER_HOST,
  SERVER_PORT,
  CORS_ORIGINS,
  TASK_SOURCE_CONFIG_PATH,
  TASK_SOURCE_DATA_PATH,
};
