/**
 * Base Task Source Adapter
 */
class TaskSourceAdapter {
  constructor(source) {
    this.source = source;
  }

  /**
   * Fetch items from external source
   * @returns {Promise<Array>} Fetched items
   */
  async fetch() {
    throw new Error('fetch() must be implemented by subclass');
  }

  /**
   * Test connection to external source
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    throw new Error('testConnection() must be implemented by subclass');
  }

  /**
   * Convert external item to task format
   * @param {object} item - External item
   * @returns {object} Task data
   */
  convertToTask(item) {
    throw new Error('convertToTask() must be implemented by subclass');
  }
}

export { TaskSourceAdapter };
