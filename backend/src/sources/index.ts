import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadAdapterTypes, type AdapterTypeDefinition } from '../config/taskSources.js';
import { TaskSourceAdapter, UniversalAdapter, type TaskSourceLike } from './base.js';
import type { SourceDefinition } from '../types/sources.ts';

type AdapterConstructor = (new (source: TaskSourceLike) => TaskSourceAdapter) & typeof TaskSourceAdapter;

const adapters: Record<string, AdapterConstructor> = {};
const DISCOVERY_DIR = path.dirname(fileURLToPath(import.meta.url));
const IGNORED_FILES = new Set(['base.js', 'index.js', 'base.ts', 'index.ts']);
let loadPromise: Promise<void> | null = null;
let adapterTypeConfigs: AdapterTypeDefinition[] | null = null;

function isTaskSourceAdapterSubclass(value: unknown): value is AdapterConstructor {
  return typeof value === 'function' && value.prototype instanceof TaskSourceAdapter;
}

function normalizeMetadata(AdapterClass: AdapterConstructor): SourceDefinition {
  return {
    type: AdapterClass.type ?? '',
    ...((AdapterClass.metadata ?? {}) as Record<string, unknown>),
  };
}

function registerAdapter(AdapterClass: AdapterConstructor) {
  if (!isTaskSourceAdapterSubclass(AdapterClass)) {
    throw new Error('Adapter must extend TaskSourceAdapter');
  }

  AdapterClass.validateDefinition();
  adapters[AdapterClass.type as string] = AdapterClass;
}

async function importAdapterFile(filePath: string) {
  const module = await import(pathToFileURL(filePath).href);
  const exportedValues = [module.default, ...Object.values(module)].filter(Boolean);

  for (const value of exportedValues) {
    if (!isTaskSourceAdapterSubclass(value)) {
      continue;
    }

    registerAdapter(value);
  }
}

async function loadLegacyAdapters() {
  if (!loadPromise) {
    loadPromise = (async () => {
      const files = await fs.readdir(DISCOVERY_DIR);
      const adapterFiles = files
        .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
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

async function loadAdapterTypeConfigs(): Promise<AdapterTypeDefinition[]> {
  if (!adapterTypeConfigs) {
    adapterTypeConfigs = await loadAdapterTypes();
  }
  return adapterTypeConfigs;
}

function getAdapterTypeConfig(type: string): AdapterTypeDefinition | null {
  if (!adapterTypeConfigs) return null;
  return adapterTypeConfigs.find((config) => config.key === type) || null;
}

function hasConfigBasedAdapter(type: string): boolean {
  const config = getAdapterTypeConfig(type);
  return Boolean(config && config.request && config.mapping);
}

function getAdapter(type: string, source: TaskSourceLike): TaskSourceAdapter {
  if (hasConfigBasedAdapter(type)) {
    const adapterConfig = getAdapterTypeConfig(type);
    return new UniversalAdapter(source, adapterConfig ?? {});
  }

  const AdapterClass = adapters[type];
  if (!AdapterClass) {
    throw new Error(`Unsupported source type: ${type}`);
  }

  return new AdapterClass(source);
}

function toConfigMetadata(config: AdapterTypeDefinition): SourceDefinition {
  return {
    type: config.key,
    key: config.key,
    name: config.name,
    description: config.description,
    ...(config.configFields ? { configFields: config.configFields } : {}),
    ...(config.request ? { request: config.request } : {}),
    ...(config.response ? { response: config.response } : {}),
    ...(config.mapping ? { mapping: config.mapping } : {}),
    ...(config.transforms ? { transforms: config.transforms } : {}),
  };
}

function getAdapterMetadata(type: string): SourceDefinition | null {
  const config = getAdapterTypeConfig(type);
  if (config) {
    return toConfigMetadata(config);
  }

  const AdapterClass = adapters[type];
  if (!AdapterClass) {
    return null;
  }
  return normalizeMetadata(AdapterClass);
}

function getAvailableTypes(): Record<string, SourceDefinition> {
  const types: Record<string, SourceDefinition> = {};

  if (adapterTypeConfigs) {
    for (const config of adapterTypeConfigs) {
      types[config.key] = toConfigMetadata(config);
    }
  }

  for (const [type, AdapterClass] of Object.entries(adapters)) {
    if (!types[type]) {
      types[type] = normalizeMetadata(AdapterClass);
    }
  }

  return types;
}

function hasAdapter(type: string): boolean {
  if (getAdapterTypeConfig(type)) {
    return true;
  }
  return Boolean(adapters[type]);
}

async function initializeAdapters() {
  await loadLegacyAdapters();
  await loadAdapterTypeConfigs();
}

await initializeAdapters();

export {
  adapters,
  getAdapter,
  getAdapterMetadata,
  getAdapterTypeConfig,
  getAvailableTypes,
  hasAdapter,
  initializeAdapters,
  registerAdapter,
};
