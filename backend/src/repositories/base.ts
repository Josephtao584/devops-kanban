import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { STORAGE_PATH } from '../config/index.js';

interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
}

class BaseRepository<T extends BaseEntity> {
  fileName: string;
  filepath: string;
  initializationPromise: Promise<void>;

  // Global write queue shared by all repository instances to prevent concurrent file corruption
  private static globalWriteQueue: Promise<void> = Promise.resolve();

  constructor(fileName: string, { storagePath = STORAGE_PATH as string }: { storagePath?: string } = {}) {
    this.fileName = fileName;
    this.filepath = path.join(storagePath, fileName);
    this.initializationPromise = this._ensureFileExists();
  }

  async _ensureFileExists() {
    await fs.mkdir(path.dirname(this.filepath), { recursive: true });
    try {
      await fs.writeFile(this.filepath, '[]', { encoding: 'utf-8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async _loadAll(): Promise<T[]> {
    return await this._serializeMutation(async () => {
      await this.initializationPromise;
      try {
        const data = await fs.readFile(this.filepath, 'utf-8');
        try {
          return JSON.parse(data) as T[];
        } catch (parseError) {
          console.error(`[BaseRepo._loadAll] JSON parse error for ${this.fileName}:`, parseError);
          console.error(`[BaseRepo._loadAll] File content:`);
          console.error(data);
          return [];
        }
      } catch (readError) {
        console.error(`[BaseRepo._loadAll] ERROR reading ${this.fileName}:`, readError);
        return [];
      }
    });
  }

  async _saveAll(data: T[]) {
    await this._serializeMutation(async () => {
      await this.initializationPromise;
      await fs.mkdir(path.dirname(this.filepath), { recursive: true });
      await fs.writeFile(this.filepath, JSON.stringify(data, null, 2), 'utf-8');
    });
  }

  _getNextId(data: T[]) {
    if (!data.length) {
      return 1;
    }
    return Math.max(...data.map((item) => item.id || 0)) + 1;
  }

  /**
   * Serialize a mutation operation through the global write queue.
   * This ensures all write operations across all repositories are sequential,
   * preventing JSON file corruption from concurrent writes.
   */
  protected async _serializeMutation<R>(mutation: () => Promise<R>): Promise<R> {
    const pendingMutation = BaseRepository.globalWriteQueue.then(async () => {
      return await mutation();
    });
    BaseRepository.globalWriteQueue = pendingMutation.then(() => undefined, () => undefined);
    return await pendingMutation;
  }

  async findAll(): Promise<T[]> {
    return await this._loadAll();
  }

  async findById(entityId: number): Promise<T | null> {
    const data = await this._loadAll();
    return data.find((item) => item.id === entityId) || null;
  }

  async create(entityData: Omit<T, keyof BaseEntity>): Promise<T> {
    const data = await this._loadAll();
    const newId = this._getNextId(data);
    const now = new Date().toISOString();

    const entity = {
      ...entityData,
      id: newId,
      created_at: now,
      updated_at: now,
    } as T;

    data.push(entity);
    await this._saveAll(data);
    return entity;
  }

  async update(entityId: number, entityData: Partial<Omit<T, keyof BaseEntity>>): Promise<T | null> {
    const data = await this._loadAll();
    const index = data.findIndex((item) => item.id === entityId);

    if (index === -1) {
      return null;
    }

    const definedEntries = Object.entries(entityData).filter(([, value]) => value !== undefined);
    const updateData = {
      ...Object.fromEntries(definedEntries),
      updated_at: new Date().toISOString(),
    };

    data[index] = { ...data[index], ...updateData } as T;
    await this._saveAll(data);
    return data[index];
  }

  async delete(entityId: number): Promise<boolean> {
    const data = await this._loadAll();
    const initialLength = data.length;
    const filtered = data.filter((item) => item.id !== entityId);

    if (filtered.length < initialLength) {
      await this._saveAll(filtered);
      return true;
    }
    return false;
  }

  async count(): Promise<number> {
    const data = await this._loadAll();
    return data.length;
  }
}

export { BaseRepository };
export type { BaseEntity };