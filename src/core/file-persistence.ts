/**
 * TLL OS - File-based Persistence Adapter
 *
 * 真实持久化：数据写入 JSON 文件，进程重启后数据仍然存在。
 * 这是 Memory Adapter 之外的第一个"真实"持久化实现。
 * 生产环境建议使用 SQLite / PostgreSQL Adapter。
 */

import type {
  PersistenceAdapter, Repository, Query, PaginationResult, PaginationParams,
  Transaction, Migration, PersistenceMigrationResult,
} from '../public/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

let filePersistIdCounter = 0;
function generateFilePersistId(prefix: string): string {
  filePersistIdCounter++;
  return `${prefix}_${Date.now().toString(36)}_${filePersistIdCounter}`;
}

// ============================================================
// File-based Repository
// ============================================================

class FileRepository<T extends Record<string, unknown>> implements Repository<T> {
  readonly collection: string;
  private filePath: string;
  private data: Map<string, T> = new Map();
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(collection: string, baseDir: string) {
    this.collection = collection;
    this.filePath = path.join(baseDir, `${collection}.json`);
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const arr = JSON.parse(raw) as T[];
      this.data.clear();
      for (const item of arr) {
        const id = (item as Record<string, unknown>).id as string;
        if (id) this.data.set(id, item);
      }
    } catch {
      // File doesn't exist yet, start empty
    }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.flush(); }, 100);
  }

  async flush(): Promise<void> {
    if (!this.dirty) return;
    const arr = Array.from(this.data.values());
    await fs.writeFile(this.filePath, JSON.stringify(arr, null, 2), 'utf-8');
    this.dirty = false;
    this.saveTimer = null;
  }

  async create(data: Partial<T>): Promise<T> {
    const id = (data.id as string) ?? generateFilePersistId('rec');
    const record = { ...data, id, createdAt: Date.now(), updatedAt: Date.now() } as unknown as T;
    this.data.set(id, record);
    this.scheduleSave();
    return record;
  }

  async createMany(data: Array<Partial<T>>): Promise<T[]> {
    const results: T[] = [];
    for (const item of data) results.push(await this.create(item));
    return results;
  }

  async findById(id: string): Promise<T | null> {
    return this.data.get(id) ?? null;
  }

  async findOne(query: Query): Promise<T | null> {
    const results = await this.find({ ...query, limit: 1 });
    return results[0] ?? null;
  }

  async find(query?: Query): Promise<T[]> {
    let results = Array.from(this.data.values());
    if (query?.filter) results = results.filter(item => this.matchesFilter(item, query.filter!));
    if (query?.sort) {
      results.sort((a, b) => {
        for (const sort of query.sort!) {
          const aVal = a[sort.field] as unknown as number | string;
          const bVal = b[sort.field] as unknown as number | string;
          if (aVal < bVal) return sort.order === 'asc' ? -1 : 1;
          if (aVal > bVal) return sort.order === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    if (query?.offset) results = results.slice(query.offset);
    if (query?.limit) results = results.slice(0, query.limit);
    if (query?.select) {
      results = results.map(item => {
        const selected: Record<string, unknown> = {};
        for (const field of query.select!) selected[field] = item[field];
        return selected as T;
      });
    }
    return results;
  }

  async findPaginated(query?: Query, pagination?: PaginationParams): Promise<PaginationResult<T>> {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const allResults = await this.find(query);
    const total = allResults.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = allResults.slice(start, start + pageSize);
    return { items, total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const existing = this.data.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, id, updatedAt: Date.now() } as T;
    this.data.set(id, updated);
    this.scheduleSave();
    return updated;
  }

  async updateMany(query: Query, data: Partial<T>): Promise<number> {
    const items = await this.find(query);
    let count = 0;
    for (const item of items) { if (await this.update(item.id as string, data)) count++; }
    return count;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.data.delete(id);
    if (result) this.scheduleSave();
    return result;
  }

  async deleteMany(query: Query): Promise<number> {
    const items = await this.find(query);
    let count = 0;
    for (const item of items) { if (await this.delete(item.id as string)) count++; }
    return count;
  }

  async count(query?: Query): Promise<number> {
    if (!query?.filter) return this.data.size;
    return (await this.find(query)).length;
  }

  async exists(query: Query): Promise<boolean> {
    return (await this.count(query)) > 0;
  }

  private matchesFilter(item: T, filter: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const itemValue = item[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const ops = value as Record<string, unknown>;
        if ('$eq' in ops && itemValue !== ops.$eq) return false;
        if ('$ne' in ops && itemValue === ops.$ne) return false;
        if ('$gt' in ops && !(itemValue as number > (ops.$gt as number))) return false;
        if ('$gte' in ops && !(itemValue as number >= (ops.$gte as number))) return false;
        if ('$lt' in ops && !(itemValue as number < (ops.$lt as number))) return false;
        if ('$lte' in ops && !(itemValue as number <= (ops.$lte as number))) return false;
        if ('$in' in ops) { if (!Array.isArray(ops.$in) || !(ops.$in as unknown[]).includes(itemValue)) return false; }
        if ('$contains' in ops && typeof itemValue === 'string' && !itemValue.includes(ops.$contains as string)) return false;
      } else if (itemValue !== value) return false;
    }
    return true;
  }
}

// ============================================================
// File-based Transaction
// ============================================================

class FileTransaction implements Transaction {
  readonly id: string;
  private baseDir: string;
  private repositories: Map<string, FileRepository<Record<string, unknown>>> = new Map();

  constructor(baseDir: string) {
    this.id = generateFilePersistId('tx');
    this.baseDir = baseDir;
  }

  getRepository<T extends Record<string, unknown>>(collection: string): Repository<T> {
    if (!this.repositories.has(collection)) {
      const repo = new FileRepository<Record<string, unknown>>(collection, this.baseDir);
      this.repositories.set(collection, repo);
    }
    return this.repositories.get(collection) as Repository<T>;
  }

  async commit(): Promise<void> {
    for (const repo of this.repositories.values()) await repo.flush();
  }

  async rollback(): Promise<void> {
    // File-based: discard in-memory changes (they haven't been flushed)
    this.repositories.clear();
  }
}

// ============================================================
// File-based Persistence Adapter
// ============================================================

export class FilePersistenceAdapter implements PersistenceAdapter {
  readonly name = 'file';
  readonly type = 'file';
  private connected = false;
  private baseDir: string;
  private repositories: Map<string, FileRepository<Record<string, unknown>>> = new Map();
  private appliedMigrations: Set<string> = new Set();

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async connect(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    this.connected = true;
    // Load all existing collection files
    try {
      const files = await fs.readdir(this.baseDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const collection = file.replace('.json', '');
          const repo = new FileRepository<Record<string, unknown>>(collection, this.baseDir);
          await repo.load();
          this.repositories.set(collection, repo);
        }
      }
    } catch { /* ignore */ }
  }

  async disconnect(): Promise<void> {
    // Flush all pending writes
    for (const repo of this.repositories.values()) await repo.flush();
    this.connected = false;
  }

  isConnected(): boolean { return this.connected; }

  getRepository<T extends Record<string, unknown>>(collection: string): Repository<T> {
    if (!this.repositories.has(collection)) {
      const repo = new FileRepository<Record<string, unknown>>(collection, this.baseDir);
      this.repositories.set(collection, repo);
    }
    return this.repositories.get(collection) as Repository<T>;
  }

  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = new FileTransaction(this.baseDir);
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async migrate(migrations: Migration[]): Promise<PersistenceMigrationResult> {
    const applied: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    for (const migration of migrations) {
      if (this.appliedMigrations.has(migration.id)) { skipped.push(migration.id); continue; }
      try {
        await migration.up(this);
        this.appliedMigrations.add(migration.id);
        applied.push(migration.id);
      } catch (error) {
        failed.push({ id: migration.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { applied, skipped, failed };
  }
}

export function createFilePersistence(baseDir: string): PersistenceAdapter {
  return new FilePersistenceAdapter(baseDir);
}
