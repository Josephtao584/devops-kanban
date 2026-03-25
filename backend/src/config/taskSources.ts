import * as fs from 'node:fs/promises';
import { parseDocument } from 'yaml';
import { TASK_SOURCE_CONFIG_PATH } from './index.js';

type StringRecord = Record<string, string>;
type UnknownRecord = Record<string, unknown>;

type AdapterRequestConfig = {
  baseUrl: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
};

type AdapterResponseConfig = {
  type: 'array' | 'object';
  path?: string;
};

type AdapterTypeDefinition = {
  key: string;
  name: string;
  description: string;
  configFields?: UnknownRecord;
  request?: AdapterRequestConfig;
  response?: AdapterResponseConfig;
  mapping?: Record<string, string>;
  transforms?: Record<string, string | UnknownRecord>;
  [key: string]: unknown;
};

function substituteEnv(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, key: string) => process.env[key] ?? '');
}

function substituteConfigPlaceholders(value: unknown, config: UnknownRecord): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\{([^}]+)\}/g, (_, fieldPath: string) => {
    const keys = fieldPath.split('.');
    let val: unknown = config;
    for (const key of keys) {
      if (val == null || typeof val !== 'object') {
        return `{${fieldPath}}`;
      }
      val = (val as UnknownRecord)[key];
    }
    return val != null ? String(val) : '';
  });
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as UnknownRecord).map(([key, nestedValue]) => [key, normalizeValue(nestedValue)])
    );
  }

  return substituteEnv(value);
}

function validateRequestConfig(request: unknown, index: number): asserts request is AdapterRequestConfig {
  if (!request || typeof request !== 'object') {
    throw new Error(`adapterTypes[${index}].request must be an object`);
  }

  const requestRecord = request as UnknownRecord;
  const baseUrl = requestRecord.baseUrl;
  const pathValue = requestRecord.path;
  const method = typeof requestRecord.method === 'string' ? requestRecord.method : 'GET';

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error(`adapterTypes[${index}].request.baseUrl must be a non-empty string`);
  }

  if (!pathValue || typeof pathValue !== 'string') {
    throw new Error(`adapterTypes[${index}].request.path must be a non-empty string`);
  }

  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    throw new Error(`adapterTypes[${index}].request.method must be a valid HTTP method`);
  }

  if (requestRecord.headers && (typeof requestRecord.headers !== 'object' || Array.isArray(requestRecord.headers))) {
    throw new Error(`adapterTypes[${index}].request.headers must be an object`);
  }

  if (requestRecord.params && (typeof requestRecord.params !== 'object' || Array.isArray(requestRecord.params))) {
    throw new Error(`adapterTypes[${index}].request.params must be an object`);
  }
}

function validateResponseConfig(response: unknown, index: number): asserts response is AdapterResponseConfig {
  if (!response || typeof response !== 'object') {
    throw new Error(`adapterTypes[${index}].response must be an object`);
  }

  const responseRecord = response as UnknownRecord;
  const type = responseRecord.type;
  const responsePath = responseRecord.path ?? '';

  if (type !== 'array' && type !== 'object') {
    throw new Error(`adapterTypes[${index}].response.type must be 'array' or 'object'`);
  }

  if (typeof responsePath !== 'string') {
    throw new Error(`adapterTypes[${index}].response.path must be a string`);
  }
}

function validateMappingConfig(mapping: unknown, index: number): asserts mapping is StringRecord {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new Error(`adapterTypes[${index}].mapping must be an object`);
  }

  const mappingRecord = mapping as UnknownRecord;
  const requiredFields = ['title', 'external_id'];
  for (const field of requiredFields) {
    if (!mappingRecord[field]) {
      throw new Error(`adapterTypes[${index}].mapping must include '${field}'`);
    }
  }

  for (const [key, value] of Object.entries(mappingRecord)) {
    if (typeof value !== 'string') {
      throw new Error(`adapterTypes[${index}].mapping.${key} must be a string (JSONPath expression)`);
    }
  }
}

function validateTransformsConfig(transforms: unknown, index: number): asserts transforms is Record<string, string | UnknownRecord> {
  if (transforms && (typeof transforms !== 'object' || Array.isArray(transforms))) {
    throw new Error(`adapterTypes[${index}].transforms must be an object`);
  }

  if (transforms) {
    for (const [field, transform] of Object.entries(transforms as UnknownRecord)) {
      if (typeof transform !== 'string' && (typeof transform !== 'object' || Array.isArray(transform))) {
        throw new Error(`adapterTypes[${index}].transforms.${field} must be a string or object`);
      }
    }
  }
}

function normalizeAdapterType(typeDefinition: unknown, index: number): AdapterTypeDefinition {
  if (!typeDefinition || typeof typeDefinition !== 'object' || Array.isArray(typeDefinition)) {
    throw new Error(`adapterTypes[${index}] must be an object`);
  }

  const normalized = normalizeValue(typeDefinition) as UnknownRecord;
  const {
    key,
    name,
    description,
    configFields = {},
    request,
    response,
    mapping,
    transforms,
    ...rest
  } = normalized;

  if (!key || typeof key !== 'string') {
    throw new Error(`adapterTypes[${index}].key must be a non-empty string`);
  }

  if (!name || typeof name !== 'string') {
    throw new Error(`adapterTypes[${index}].name must be a non-empty string`);
  }

  if (!description || typeof description !== 'string') {
    throw new Error(`adapterTypes[${index}].description must be a non-empty string`);
  }

  if (configFields === null || typeof configFields !== 'object' || Array.isArray(configFields)) {
    throw new Error(`adapterTypes[${index}].configFields must be an object`);
  }

  if (request) {
    validateRequestConfig(request, index);
  }
  if (response) {
    validateResponseConfig(response, index);
  }
  if (mapping) {
    validateMappingConfig(mapping, index);
  }
  if (transforms !== undefined) {
    validateTransformsConfig(transforms, index);
  }

  return {
    key,
    name,
    description,
    configFields: configFields as UnknownRecord,
    ...(request ? { request: request as AdapterRequestConfig } : {}),
    ...(response ? { response: response as AdapterResponseConfig } : {}),
    ...(mapping ? { mapping: mapping as StringRecord } : {}),
    ...(transforms !== undefined ? { transforms: transforms as Record<string, string | UnknownRecord> } : {}),
    ...rest,
  };
}

async function loadAdapterTypeConfig(configPath: string = TASK_SOURCE_CONFIG_PATH as string): Promise<AdapterTypeDefinition[]> {
  const raw = await fs.readFile(configPath, 'utf-8');
  const document = parseDocument(raw);

  if (document.errors.length > 0) {
    throw new Error(document.errors[0]!.message);
  }

  const parsed = (document.toJSON() || {}) as { adapterTypes?: unknown[] };
  const rawTypes = parsed.adapterTypes;

  if (rawTypes !== undefined && !Array.isArray(rawTypes)) {
    throw new Error('adapterTypes must be an array');
  }

  const adapterTypes = (rawTypes || []).map((typeDefinition, index) => normalizeAdapterType(typeDefinition, index));
  const typeKeys = new Set<string>();
  for (const typeDefinition of adapterTypes) {
    if (typeKeys.has(typeDefinition.key)) {
      throw new Error(`Duplicate adapter type key: ${typeDefinition.key}`);
    }
    typeKeys.add(typeDefinition.key);
  }

  return adapterTypes;
}

async function loadAdapterTypes(): Promise<AdapterTypeDefinition[]> {
  return loadAdapterTypeConfig();
}

export {
  loadAdapterTypeConfig,
  loadAdapterTypes,
  substituteConfigPlaceholders,
};
export type { AdapterRequestConfig, AdapterResponseConfig, AdapterTypeDefinition };
