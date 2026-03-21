import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_DIR = import.meta.dirname;
const STORAGE_PATH = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.join(BASE_DIR, '..', 'data');
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_PORT = parseInt(process.env.SERVER_PORT, 10) || 8000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');

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
};
