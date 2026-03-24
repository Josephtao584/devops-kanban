import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { TASK_SOURCE_DATA_PATH } from '../config/index.js';
import type { TaskSourceEntity } from '../types/entities.ts';
import type { BaseEntity } from './base.js';

interface StoredTaskSourceEntity extends TaskSourceEntity, BaseEntity {}

class TaskSourceRepository {
  fileName: string;
  filepath: string;
  storagePath: string;
  initPromise: Promise<void>;

  constructor(storagePath: string = TASK_SOURCE_DATA_PATH as string) {
    this.fileName = 'task_sources.json';
    this.storagePath = storagePath;
    this.filepath = path.join(this.storagePath, this.fileName);
    this.initPromise = this._ensureFileExists();
  }


  async _ensureFileExists() {
    try {
      await fs.access(this.filepath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
      await this._saveAll([]);
    }
  }

  async _loadAll(): Promise<StoredTaskSourceEntity[]> {
    await this.initPromise;
    try {
      const data = await fs.readFile(this.filepath, 'utf-8');
      return JSON.parse(data) as StoredTaskSourceEntity[];
    } catch {
      return [];
    }
  }

  async _saveAll(data: StoredTaskSourceEntity[]) {
    await fs.mkdir(path.dirname(this.filepath), { recursive: true });
    await fs.writeFile(this.filepath, JSON.stringify(data, null, 2), 'utf-8');
  }

  _getNextId(data: StoredTaskSourceEntity[]) {
    if (!data.length) {
      return 1;
    }
    return Math.max(...data.map((item) => item.id || 0)) + 1;
  }

  async findAll(): Promise<StoredTaskSourceEntity[]> {
    return await this._loadAll();
  }

  async findById(entityId: number): Promise<StoredTaskSourceEntity | null> {
    const data = await this._loadAll();
    return data.find((item) => item.id === entityId) || null;
  }

  async create(entityData: Omit<TaskSourceEntity, 'id'>): Promise<StoredTaskSourceEntity> {
    const data = await this._loadAll();
    const newId = this._getNextId(data);
    const now = new Date().toISOString();
    const entity = {
      ...entityData,
      id: newId,
      created_at: now,
      updated_at: now,
    } as StoredTaskSourceEntity;
    data.push(entity);
    await this._saveAll(data);
    return entity;
  }

  async update(entityId: number, entityData: Partial<TaskSourceEntity>): Promise<StoredTaskSourceEntity | null> {
    const data = await this._loadAll();
    const index = data.findIndex((item) => item.id === entityId);
    if (index === -1) {
      return null;
    }

    const updateData: Record<string, unknown> = {};
    for (const key of Object.keys(entityData)) {
      const typedKey = key as keyof TaskSourceEntity;
      const value = entityData[typedKey];
      if (value !== undefined) {
        updateData[key] = value;
      }
    }
    updateData.updated_at = new Date().toISOString();

    data[index] = { ...data[index], ...updateData } as StoredTaskSourceEntity;
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

  async getByProject(projectId: number): Promise<StoredTaskSourceEntity[]> {
    const data = await this._loadAll();
    return data.filter((item) => item.project_id === projectId);
  }

  async exists(sourceId: number): Promise<boolean> {
    const source = await this.findById(sourceId);
    return source !== null;
  }

  async deleteByProject(projectId: number): Promise<number> {
    const data = await this._loadAll();
    const initialLength = data.length;
    const filtered = data.filter((item) => item.project_id !== projectId);
    await this._saveAll(filtered);
    return initialLength - filtered.length;
  }
}

export { TaskSourceRepository };
export type { StoredTaskSourceEntity };
