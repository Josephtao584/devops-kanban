/**
 * Application configuration
 */
require('dotenv').config();

const path = require('path');

// Base directory (backend-nodejs root)
const BASE_DIR = __dirname;

// Storage path for JSON data files (located at project root)
const STORAGE_PATH = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.join(BASE_DIR, '..', 'data');

// Server configuration
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_PORT = parseInt(process.env.SERVER_PORT, 10) || 8000;

// CORS configuration
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');

module.exports = {
  BASE_DIR,
  STORAGE_PATH,
  SERVER_HOST,
  SERVER_PORT,
  CORS_ORIGINS,
};
