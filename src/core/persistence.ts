/**
 * TLL OS - Persistence Implementation (P0-7)
 *
 * 内存版 Persistence Adapter，零依赖，用于开发和测试。
 * 生产环境应使用 SQLite / PostgreSQL Adapter。
 */

import type {
  PersistenceAdapter, Repository, Query, PaginationResult, PaginationParams,
  Transaction, Migration, PersistenceMigrationResult,
} from '../public/types.js';

let persistIdCounter = 0;
function generatePersistId(prefix: string): string {
  persistIdCounter++;
  return `${prefix}_${Date.now().toString(36)}_${persistIdCounter}`;
}

// ============================================================
// 内存版 Repository
// ============================================================

class MemoryRepository<T extends Record<string, unknown>> implements Repository<T> {
  readonly collection: string;
  private store: Map<string, T> = new Map();

  constructor(collection: string) {
    this.collection = collection;
  }

  async create(data: Partial<T>): Promise<T> {
    const id = (data.id as string) ?? generatePersistId('rec');
    const record = { ...data, id, createdAt: Date.now(), updatedAt: Date.now() } as unknown as T;
    this.store.set(id, record);
    return record;
  }

  async createMany(data: Array<Partial<T>>): Promise<T[]> {
    const results: T[] = [];
    for (const item of data) {
      results.push(await this.create(item));
    }
    return results;
  }

  async findById(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async findOne(query: Query): Promise<T | null> {
    const results = await this.find({ ...query, limit: 1 });
    return results[0] ?? null;
  }

  async find(query?: Query): Promise<T[]> {
    let results = Array.from(this.store.values());

    if (query?.filter) {
      results = results.filter(item => this.matchesFilter(item, query.filter!));
    }

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

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, id, updatedAt: Date.now() } as T;
    this.store.set(id, updated);
    return updated;
  }

  async updateMany(query: Query, data: Partial<T>): Promise<number> {
    const items = await this.find(query);
    let count = 0;
    for (const item of items) {
      const id = item.id as string;
      if (await this.update(id, data)) count++;
    }
    return count;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async deleteMany(query: Query): Promise<number> {
    const items = await this.find(query);
    let count = 0;
    for (const item of items) {
      if (await this.delete(item.id as string)) count++;
    }
    return count;
  }

  async count(query?: Query): Promise<number> {
    if (!query?.filter) return this.store.size;
    const results = await this.find(query);
    return results.length;
  }

  async exists(query: Query): Promise<boolean> {
    const count = await this.count(query);
    return count > 0;
  }

  private matchesFilter(item: T, filter: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const itemValue = item[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // 支持 { $gt, $lt, $in, $ne } 等操作符
        const ops = value as Record<string, unknown>;
        if ('$eq' in ops && itemValue !== ops.$eq) return false;
        if ('$ne' in ops && itemValue === ops.$ne) return false;
        if ('$gt' in ops && !(itemValue as number > (ops.$gt as number))) return false;
        if ('$gte' in ops && !(itemValue as number >= (ops.$gte as number))) return false;
        if ('$lt' in ops && !(itemValue as number < (ops.$lt as number))) return false;
        if ('$lte' in ops && !(itemValue as number <= (ops.$lte as number))) return false;
        if ('$in' in ops) {
          if (!Array.isArray(ops.$in) || !(ops.$in as unknown[]).includes(itemValue)) return false;
        }
        if ('$contains' in ops && typeof itemValue === 'string' && !itemValue.includes(ops.$contains as string)) return false;
      } else if (itemValue !== value) {
        return false;
      }
    }
    return true;
  }
}

// ============================================================
// 内存版 Transaction
// ============================================================

class MemoryTransaction implements Transaction {
  readonly id: string;
  private repositories: Map<string, MemoryRepository<Record<string, unknown>>> = new Map();

  constructor() {
    this.id = generatePersistId('tx');
  }

  getRepository<T extends Record<string, unknown>>(collection: string): Repository<T> {
    if (!this.repositories.has(collection)) {
      this.repositories.set(collection, new MemoryRepository(collection));
    }
    return this.repositories.get(collection) as Repository<T>;
  }

  async commit(): Promise<void> {
    // 内存版事务：提交即完成
  }

  async rollback(): Promise<void> {
    this.repositories.clear();
  }
}

// ============================================================
// 内存版 Persistence Adapter
// ============================================================

export class MemoryPersistenceAdapter implements PersistenceAdapter {
  readonly name = 'memory';
  readonly type = 'memory';
  private connected = false;
  private repositories: Map<string, MemoryRepository<Record<string, unknown>>> = new Map();
  private appliedMigrations: Set<string> = new Set();

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getRepository<T extends Record<string, unknown>>(collection: string): Repository<T> {
    if (!this.repositories.has(collection)) {
      this.repositories.set(collection, new MemoryRepository(collection));
    }
    return this.repositories.get(collection) as Repository<T>;
  }

  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = new MemoryTransaction();
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
      if (this.appliedMigrations.has(migration.id)) {
        skipped.push(migration.id);
        continue;
      }
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

// ============================================================
// 工厂函数
// ============================================================

export function createMemoryPersistence(): PersistenceAdapter {
  return new MemoryPersistenceAdapter();
}
