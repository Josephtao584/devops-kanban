import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { STORAGE_PATH } from '../config/index.js';

interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
  external_id?: string | null;
}

type StoredEntity<TCreate extends object> = TCreate & BaseEntity;

class BaseRepository<T extends BaseEntity, TCreate extends object, TUpdate extends object = Partial<TCreate>> {
  fileName: string;
  filepath: string;
  initializationPromise: Promise<void>;

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
    await this.initializationPromise;
    try {
      const data = await fs.readFile(this.filepath, 'utf-8');
      return JSON.parse(data) as T[];
    } catch {
      return [];
    }
  }

  async _saveAll(data: T[]) {
    await this.initializationPromise;
    await fs.mkdir(path.dirname(this.filepath), { recursive: true });
    await fs.writeFile(this.filepath, JSON.stringify(data, null, 2), 'utf-8');
  }

  _getNextId(data: T[]) {
    if (!data.length) {
      return 1;
    }
    return Math.max(...data.map((item) => item.id || 0)) + 1;
  }

  async findAll(): Promise<T[]> {
    return await this._loadAll();
  }

  async findById(entityId: number): Promise<T | null> {
    const data = await this._loadAll();
    return data.find((item) => item.id === entityId) || null;
  }

  async create(entityData: TCreate): Promise<T> {
    const data = await this._loadAll();
    const newId = this._getNextId(data);
    const now = new Date().toISOString();

    const entity: StoredEntity<TCreate> = {
      ...entityData,
      id: newId,
      created_at: now,
      updated_at: now,
    };

    data.push(entity as unknown as T);
    await this._saveAll(data);
    return entity as unknown as T;
  }

  async update(entityId: number, entityData: TUpdate): Promise<T | null> {
    const data = await this._loadAll();
    const index = data.findIndex((item) => item.id === entityId);

    if (index === -1) {
      return null;
    }

    const definedEntries = Object.entries(entityData).filter(([, value]) => value !== undefined);
    const updateData = {
      ...Object.fromEntries(definedEntries),
      updated_at: new Date().toISOString(),
    } as Partial<TUpdate> & Pick<BaseEntity, 'updated_at'>;

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

  async findByExternalId(externalId: string): Promise<T | null> {
    const data = await this._loadAll();
    return data.find((item) => item.external_id === externalId) || null;
  }
}

export { BaseRepository };
export type { BaseEntity };
