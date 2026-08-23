/**
 * TLL OS - SQLite Persistence Adapter (P0-7)
 *
 * 真实数据库持久化，基于 better-sqlite3。
 * 每个 collection 对应一个表，data 字段存储 JSON。
 * 支持事务、迁移、查询过滤、排序、分页。
 */

import Database from 'better-sqlite3';
import type {
  PersistenceAdapter, Repository, Query, PaginationResult, PaginationParams,
  Transaction, Migration, PersistenceMigrationResult,
} from '../public/types.js';

let sqliteIdCounter = 0;
function generateSqliteId(prefix: string): string {
  sqliteIdCounter++;
  return `${prefix}_${Date.now().toString(36)}_${sqliteIdCounter}`;
}

// ============================================================
// SQLite Repository
// ============================================================

class SqliteRepository<T extends Record<string, unknown>> implements Repository<T> {
  readonly collection: string;
  private db: Database.Database;

  constructor(collection: string, db: Database.Database) {
    this.collection = collection;
    this.db = db;
    this.ensureTable();
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${this.collection}" (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  async create(data: Partial<T>): Promise<T> {
    const id = (data.id as string) ?? generateSqliteId('rec');
    const now = Date.now();
    const record = { ...data, id, createdAt: now, updatedAt: now } as unknown as T;
    const stmt = this.db.prepare(
      `INSERT INTO "${this.collection}" (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`
    );
    stmt.run(id, JSON.stringify(record), now, now);
    return record;
  }

  async createMany(data: Array<Partial<T>>): Promise<T[]> {
    const results: T[] = [];
    const insert = this.db.prepare(
      `INSERT INTO "${this.collection}" (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`
    );
    const transaction = this.db.transaction((items: Array<Partial<T>>) => {
      for (const item of items) {
        const id = (item.id as string) ?? generateSqliteId('rec');
        const now = Date.now();
        const record = { ...item, id, createdAt: now, updatedAt: now } as unknown as T;
        insert.run(id, JSON.stringify(record), now, now);
        results.push(record);
      }
    });
    transaction(data);
    return results;
  }

  async findById(id: string): Promise<T | null> {
    const row = this.db.prepare(`SELECT data FROM "${this.collection}" WHERE id = ?`).get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) as T : null;
  }

  async findOne(query: Query): Promise<T | null> {
    const results = await this.find({ ...query, limit: 1 });
    return results[0] ?? null;
  }

  async find(query?: Query): Promise<T[]> {
    let sql = `SELECT data FROM "${this.collection}"`;
    const params: unknown[] = [];

    if (query?.filter && Object.keys(query.filter).length > 0) {
      const { whereSql, whereParams } = this.buildWhere(query.filter);
      sql += ` WHERE ${whereSql}`;
      params.push(...whereParams);
    }

    if (query?.sort && query.sort.length > 0) {
      const orderParts = query.sort.map(s => `json_extract(data, '$.${s.field}') ${s.order === 'asc' ? 'ASC' : 'DESC'}`);
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    } else {
      sql += ` ORDER BY created_at DESC`;
    }

    if (query?.limit) sql += ` LIMIT ${query.limit}`;
    if (query?.offset) sql += ` OFFSET ${query.offset}`;

    const rows = this.db.prepare(sql).all(...params) as Array<{ data: string }>;
    let results = rows.map(r => JSON.parse(r.data) as T);

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

    // 先算总数
    let countSql = `SELECT COUNT(*) as cnt FROM "${this.collection}"`;
    const countParams: unknown[] = [];
    if (query?.filter && Object.keys(query.filter).length > 0) {
      const { whereSql, whereParams } = this.buildWhere(query.filter);
      countSql += ` WHERE ${whereSql}`;
      countParams.push(...whereParams);
    }
    const total = (this.db.prepare(countSql).get(...countParams) as { cnt: number }).cnt;

    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = await this.find({ ...query, limit: pageSize, offset: start });

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
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, id, updatedAt: Date.now() } as T;
    this.db.prepare(`UPDATE "${this.collection}" SET data = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(updated), Date.now(), id);
    return updated;
  }

  async updateMany(query: Query, data: Partial<T>): Promise<number> {
    const items = await this.find(query);
    let count = 0;
    const update = this.db.prepare(`UPDATE "${this.collection}" SET data = ?, updated_at = ? WHERE id = ?`);
    const transaction = this.db.transaction((records: T[]) => {
      for (const item of records) {
        const id = item.id as string;
        const updated = { ...item, ...data, id, updatedAt: Date.now() } as T;
        update.run(JSON.stringify(updated), Date.now(), id);
        count++;
      }
    });
    transaction(items);
    return count;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare(`DELETE FROM "${this.collection}" WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  async deleteMany(query: Query): Promise<number> {
    const items = await this.find(query);
    let count = 0;
    const del = this.db.prepare(`DELETE FROM "${this.collection}" WHERE id = ?`);
    const transaction = this.db.transaction((records: T[]) => {
      for (const item of records) {
        del.run(item.id as string);
        count++;
      }
    });
    transaction(items);
    return count;
  }

  async count(query?: Query): Promise<number> {
    if (!query?.filter || Object.keys(query.filter).length === 0) {
      return (this.db.prepare(`SELECT COUNT(*) as cnt FROM "${this.collection}"`).get() as { cnt: number }).cnt;
    }
    const { whereSql, whereParams } = this.buildWhere(query.filter);
    return (this.db.prepare(`SELECT COUNT(*) as cnt FROM "${this.collection}" WHERE ${whereSql}`).get(...whereParams) as { cnt: number }).cnt;
  }

  async exists(query: Query): Promise<boolean> {
    const c = await this.count(query);
    return c > 0;
  }

  private buildWhere(filter: Record<string, unknown>): { whereSql: string; whereParams: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const ops = value as Record<string, unknown>;
        for (const [op, opValue] of Object.entries(ops)) {
          const fieldPath = `json_extract(data, '$.${key}')`;
          switch (op) {
            case '$eq':
              conditions.push(`${fieldPath} = ?`);
              params.push(opValue);
              break;
            case '$ne':
              conditions.push(`${fieldPath} != ?`);
              params.push(opValue);
              break;
            case '$gt':
              conditions.push(`${fieldPath} > ?`);
              params.push(opValue);
              break;
            case '$gte':
              conditions.push(`${fieldPath} >= ?`);
              params.push(opValue);
              break;
            case '$lt':
              conditions.push(`${fieldPath} < ?`);
              params.push(opValue);
              break;
            case '$lte':
              conditions.push(`${fieldPath} <= ?`);
              params.push(opValue);
              break;
            case '$in':
              if (Array.isArray(opValue) && opValue.length > 0) {
                const placeholders = opValue.map(() => '?').join(', ');
                conditions.push(`${fieldPath} IN (${placeholders})`);
                params.push(...opValue);
              } else {
                conditions.push(`1 = 0`);
              }
              break;
            case '$contains':
              conditions.push(`${fieldPath} LIKE ?`);
              params.push(`%${opValue}%`);
              break;
          }
        }
      } else {
        conditions.push(`json_extract(data, '$.${key}') = ?`);
        params.push(value);
      }
    }

    return { whereSql: conditions.join(' AND '), whereParams: params };
  }
}

// ============================================================
// SQLite Transaction
// ============================================================

class SqliteTransaction implements Transaction {
  readonly id: string;
  private db: Database.Database;
  private repositories: Map<string, SqliteRepository<Record<string, unknown>>> = new Map();
  private committed = false;
  private rolledBack = false;

  constructor(db: Database.Database) {
    this.id = generateSqliteId('tx');
    this.db = db;
    this.db.exec('BEGIN');
  }

  getRepository<T extends Record<string, unknown>>(collection: string): Repository<T> {
    if (!this.repositories.has(collection)) {
      this.repositories.set(collection, new SqliteRepository(collection, this.db));
    }
    return this.repositories.get(collection) as Repository<T>;
  }

  async commit(): Promise<void> {
    if (!this.committed && !this.rolledBack) {
      this.db.exec('COMMIT');
      this.committed = true;
    }
  }

  async rollback(): Promise<void> {
    if (!this.committed && !this.rolledBack) {
      this.db.exec('ROLLBACK');
      this.rolledBack = true;
    }
  }
}

// ============================================================
// SQLite Persistence Adapter
// ============================================================

export class SqlitePersistenceAdapter implements PersistenceAdapter {
  readonly name = 'sqlite';
  readonly type = 'sqlite';
  private db: Database.Database | null = null;
  private dbPath: string;
  private repositories: Map<string, SqliteRepository<Record<string, unknown>>> = new Map();

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath;
  }

  async connect(): Promise<void> {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    // 迁移记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _tll_migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `);
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  getRepository<T extends Record<string, unknown>>(collection: string): Repository<T> {
    if (!this.db) throw new Error('Database not connected');
    if (!this.repositories.has(collection)) {
      this.repositories.set(collection, new SqliteRepository(collection, this.db));
    }
    return this.repositories.get(collection) as Repository<T>;
  }

  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not connected');
    const tx = new SqliteTransaction(this.db);
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
    if (!this.db) throw new Error('Database not connected');

    const applied: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const checkStmt = this.db.prepare('SELECT id FROM _tll_migrations WHERE id = ?');
    const insertStmt = this.db.prepare('INSERT INTO _tll_migrations (id, name, applied_at) VALUES (?, ?, ?)');

    for (const migration of migrations) {
      const existing = checkStmt.get(migration.id);
      if (existing) {
        skipped.push(migration.id);
        continue;
      }
      try {
        await migration.up(this);
        insertStmt.run(migration.id, migration.name, Date.now());
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

export function createSqlitePersistence(dbPath?: string): PersistenceAdapter {
  return new SqlitePersistenceAdapter(dbPath);
}
