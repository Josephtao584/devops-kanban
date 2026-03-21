import 'dotenv/config';
import path from 'path';

const BASE_DIR = import.meta.dirname;
const STORAGE_PATH = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.join(BASE_DIR, '..', 'data');
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_PORT = parseInt(process.env.SERVER_PORT, 10) || 8000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');
const TASK_SOURCE_CONFIG_PATH = process.env.TASK_SOURCE_CONFIG_PATH
  ? path.resolve(process.env.TASK_SOURCE_CONFIG_PATH)
  : path.join(BASE_DIR, '..', '..', 'task-sources', 'config.yaml');
const TASK_SOURCE_DATA_PATH = process.env.TASK_SOURCE_DATA_PATH
  ? path.resolve(process.env.TASK_SOURCE_DATA_PATH)
  : path.join(STORAGE_PATH);

// Logging configuration
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_FILE_MAX_SIZE = process.env.LOG_FILE_MAX_SIZE || '10m';
const LOG_FILE_KEEP = parseInt(process.env.LOG_FILE_KEEP, 10) || 5;

export {
  BASE_DIR,
  STORAGE_PATH,
  SERVER_HOST,
  SERVER_PORT,
  CORS_ORIGINS,
  LOG_LEVEL,
  LOG_DIR,
  LOG_FILE_MAX_SIZE,
  LOG_FILE_KEEP,
  TASK_SOURCE_CONFIG_PATH, 
  TASK_SOURCE_DATA_PATH, 
};
