/**
 * Adapter Registry - SPI for task source adapters
 */
import { GitHubAdapter } from './github.js'

// Adapter registry
const adapters = {}

/**
 * Register an adapter
 * @param {string} type - Adapter type (e.g., 'GITHUB', 'GITLAB')
 * @param {class} AdapterClass - Adapter class
 */
function registerAdapter(type, AdapterClass) {
  adapters[type] = AdapterClass
}

/**
 * Get an adapter instance
 * @param {string} type - Adapter type
 * @param {object} source - Task source configuration
 * @returns {object} Adapter instance
 */
function getAdapter(type, source) {
  const AdapterClass = adapters[type]
  if (!AdapterClass) {
    throw new Error(`Unsupported source type: ${type}`)
  }
  return new AdapterClass(source)
}

/**
 * Get all registered adapter types
 * @returns {object} Available adapter types with metadata
 */
function getAvailableTypes() {
  const types = {}
  for (const [type, AdapterClass] of Object.entries(adapters)) {
    // Try to get static metadata from the adapter class
    if (AdapterClass.metadata) {
      types[type] = AdapterClass.metadata
    } else {
      types[type] = {
        name: type,
        description: `${type} Tasks`
      }
    }
  }
  return types
}

// Register default adapters
registerAdapter('GITHUB', GitHubAdapter)

export {
  registerAdapter,
  getAdapter,
  getAvailableTypes,
  adapters
}