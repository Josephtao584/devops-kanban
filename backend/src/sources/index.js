/**
 * Source Adapter Registry - Auto-discovery and registration of task source adapters
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { TaskSourceAdapter, UniversalAdapter } from './base.js';
import { loadAdapterTypeConfig, loadAdapterTypes } from '../config/taskSources.js';

const adapters = {};
const DISCOVERY_DIR = path.dirname(fileURLToPath(import.meta.url));
const IGNORED_FILES = new Set(['base.js', 'index.js']);
let loadPromise = null;
let adapterTypeConfigs = null;

function isTaskSourceAdapterSubclass(AdapterClass) {
  return typeof AdapterClass === 'function' && AdapterClass.prototype instanceof TaskSourceAdapter;
}

function normalizeMetadata(AdapterClass) {
  return {
    type: AdapterClass.type,
    ...(AdapterClass.metadata || {}),
  };
}

function registerAdapter(AdapterClass) {
  if (!isTaskSourceAdapterSubclass(AdapterClass)) {
    throw new Error('Adapter must extend TaskSourceAdapter');
  }

  AdapterClass.validateDefinition();
  adapters[AdapterClass.type] = AdapterClass;
}

async function importAdapterFile(filePath) {
  const module = await import(pathToFileURL(filePath).href);
  const exportedValues = [module.default, ...Object.values(module)].filter(Boolean);

  for (const value of exportedValues) {
    if (!isTaskSourceAdapterSubclass(value)) {
      continue;
    }

    registerAdapter(value);
  }
}

async function _loadLegacyAdapters() {
  if (!loadPromise) {
    loadPromise = (async () => {
      const files = await fs.readdir(DISCOVERY_DIR);
      const adapterFiles = files
        .filter((file) => file.endsWith('.js'))
        .filter((file) => !IGNORED_FILES.has(file))
        .sort();

      for (const type of Object.keys(adapters)) {
        delete adapters[type];
      }

      for (const file of adapterFiles) {
        await importAdapterFile(path.join(DISCOVERY_DIR, file));
      }
    })();
  }

  await loadPromise;
}

/**
 * Load adapter type configurations from config.yaml
 * @returns {Promise<Array>} Adapter type configs
 */
async function _loadAdapterTypeConfigs() {
  if (!adapterTypeConfigs) {
    adapterTypeConfigs = await loadAdapterTypes();
  }
  return adapterTypeConfigs;
}

/**
 * Get adapter type config by type key
 * @param {string} type - Adapter type key
 * @returns {object|null} Adapter type config or null
 */
function getAdapterTypeConfig(type) {
  if (!adapterTypeConfigs) return null;
  return adapterTypeConfigs.find((config) => config.key === type) || null;
}

/**
 * Check if a type has config-based (UniversalAdapter) support
 * @param {string} type - Adapter type
 * @returns {boolean} True if config-based
 */
function hasConfigBasedAdapter(type) {
  const config = getAdapterTypeConfig(type);
  return config && config.request && config.mapping;
}

/**
 * Create adapter instance - uses UniversalAdapter for config-based types,
 * falls back to legacy JS adapters
 * @param {string} type - Adapter type
 * @param {object} source - Source configuration
 * @returns {TaskSourceAdapter} Adapter instance
 */
function getAdapter(type, source) {
  // Check if we have config-based adapter support
  if (hasConfigBasedAdapter(type)) {
    const adapterConfig = getAdapterTypeConfig(type);
    return new UniversalAdapter(source, adapterConfig);
  }

  // Fall back to legacy JS adapter
  const AdapterClass = adapters[type];
  if (!AdapterClass) {
    throw new Error(`Unsupported source type: ${type}`);
  }

  return new AdapterClass(source);
}

function getAdapterMetadata(type) {
  // First check config-based adapter
  const config = getAdapterTypeConfig(type);
  if (config) {
    return {
      key: config.key,
      name: config.name,
      description: config.description,
      configFields: config.configFields,
      request: config.request,
      response: config.response,
      mapping: config.mapping,
      transforms: config.transforms,
    };
  }

  // Fall back to legacy JS adapter
  const AdapterClass = adapters[type];
  if (!AdapterClass) {
    return null;
  }
  return normalizeMetadata(AdapterClass);
}

function getAvailableTypes() {
  const types = {};

  // Add config-based adapters
  if (adapterTypeConfigs) {
    for (const config of adapterTypeConfigs) {
      types[config.key] = {
        key: config.key,
        name: config.name,
        description: config.description,
        configFields: config.configFields,
        request: config.request,
        response: config.response,
        mapping: config.mapping,
        transforms: config.transforms,
      };
    }
  }

  // Add legacy JS adapters (only if not already in config)
  for (const [type, AdapterClass] of Object.entries(adapters)) {
    if (!types[type]) {
      types[type] = normalizeMetadata(AdapterClass);
    }
  }

  return types;
}

function hasAdapter(type) {
  // Check config-based adapters first
  if (getAdapterTypeConfig(type)) {
    return true;
  }
  // Fall back to legacy JS adapters
  return Boolean(adapters[type]);
}

async function initializeAdapters() {
  // Load legacy JS adapters
  await _loadLegacyAdapters();
  // Load config-based adapter types
  await _loadAdapterTypeConfigs();
}

await initializeAdapters();

export {
  registerAdapter,
  getAdapter,
  getAdapterMetadata,
  getAvailableTypes,
  hasAdapter,
  initializeAdapters,
  getAdapterTypeConfig,
  adapters,
};
