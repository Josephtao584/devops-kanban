import fs from 'fs/promises';
import path from 'path';
import { parseDocument } from 'yaml';
import { TASK_SOURCE_CONFIG_PATH } from './index.js';

function substituteEnv(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, key) => process.env[key] ?? '');
}

function substituteConfigPlaceholders(value, config) {
  if (typeof value !== 'string') {
    return value;
  }

  // Replace {field} placeholders with config values
  return value.replace(/\{([^}]+)\}/g, (_, fieldPath) => {
    const keys = fieldPath.split('.');
    let val = config;
    for (const key of keys) {
      if (val == null || typeof val !== 'object') {
        return `{${fieldPath}}`; // Keep placeholder if not found
      }
      val = val[key];
    }
    return val != null ? val : '';
  });
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeValue(nestedValue)])
    );
  }

  return substituteEnv(value);
}

function validateRequestConfig(request, index) {
  if (!request || typeof request !== 'object') {
    throw new Error(`adapterTypes[${index}].request must be an object`);
  }

  const { baseUrl, path, method = 'GET' } = request;

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error(`adapterTypes[${index}].request.baseUrl must be a non-empty string`);
  }

  if (!path || typeof path !== 'string') {
    throw new Error(`adapterTypes[${index}].request.path must be a non-empty string`);
  }

  if (typeof method !== 'string' || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    throw new Error(`adapterTypes[${index}].request.method must be a valid HTTP method`);
  }

  // headers and params are optional
  if (request.headers && (typeof request.headers !== 'object' || Array.isArray(request.headers))) {
    throw new Error(`adapterTypes[${index}].request.headers must be an object`);
  }

  if (request.params && (typeof request.params !== 'object' || Array.isArray(request.params))) {
    throw new Error(`adapterTypes[${index}].request.params must be an object`);
  }
}

function validateResponseConfig(response, index) {
  if (!response || typeof response !== 'object') {
    throw new Error(`adapterTypes[${index}].response must be an object`);
  }

  const { type, path: responsePath = '' } = response;

  if (!type || !['array', 'object'].includes(type)) {
    throw new Error(`adapterTypes[${index}].response.type must be 'array' or 'object'`);
  }

  if (typeof responsePath !== 'string') {
    throw new Error(`adapterTypes[${index}].response.path must be a string`);
  }
}

function validateMappingConfig(mapping, index) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new Error(`adapterTypes[${index}].mapping must be an object`);
  }

  const requiredFields = ['title', 'external_id'];
  for (const field of requiredFields) {
    if (!mapping[field]) {
      throw new Error(`adapterTypes[${index}].mapping must include '${field}'`);
    }
  }

  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value !== 'string') {
      throw new Error(`adapterTypes[${index}].mapping.${key} must be a string (JSONPath expression)`);
    }
  }
}

function validateTransformsConfig(transforms, index) {
  if (transforms && (typeof transforms !== 'object' || Array.isArray(transforms))) {
    throw new Error(`adapterTypes[${index}].transforms must be an object`);
  }

  if (transforms) {
    for (const [field, transform] of Object.entries(transforms)) {
      // Transform can be a string (like "toString") or an object (like status mapping)
      if (typeof transform !== 'string' && (typeof transform !== 'object' || Array.isArray(transform))) {
        throw new Error(`adapterTypes[${index}].transforms.${field} must be a string or object`);
      }
    }
  }
}

function normalizeAdapterType(typeDefinition, index) {
  if (!typeDefinition || typeof typeDefinition !== 'object' || Array.isArray(typeDefinition)) {
    throw new Error(`adapterTypes[${index}] must be an object`);
  }

  const normalized = normalizeValue(typeDefinition);
  const { key, name, description, configFields = {}, request, response, mapping, transforms, ...rest } = normalized;

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

  // Validate request/response/mapping if present (for UniversalAdapter support)
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
    configFields,
    request,
    response,
    mapping,
    transforms,
    ...rest,
  };
}

async function loadAdapterTypeConfig(configPath = TASK_SOURCE_CONFIG_PATH) {
  const raw = await fs.readFile(configPath, 'utf-8');
  const document = parseDocument(raw);

  if (document.errors.length > 0) {
    throw new Error(document.errors[0].message);
  }

  const parsed = document.toJSON() || {};
  const rawTypes = parsed.adapterTypes;

  if (rawTypes !== undefined && !Array.isArray(rawTypes)) {
    throw new Error('adapterTypes must be an array');
  }

  const adapterTypes = (rawTypes || []).map((typeDefinition, index) => normalizeAdapterType(typeDefinition, index));
  const typeKeys = new Set();
  for (const typeDefinition of adapterTypes) {
    if (typeKeys.has(typeDefinition.key)) {
      throw new Error(`Duplicate adapter type key: ${typeDefinition.key}`);
    }
    typeKeys.add(typeDefinition.key);
  }

  return adapterTypes;
}

async function loadAdapterTypes() {
  return loadAdapterTypeConfig();
}

export {
  loadAdapterTypeConfig,
  loadAdapterTypes,
  substituteConfigPlaceholders,
};
