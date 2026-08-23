/**
 * TLL Commerce - Database Layer (TLL OS Persistence-backed)
 *
 * MIGRATION: Replaces original in-memory CommerceDatabase with TLL OS File Persistence.
 * Maintains the EXACT SAME API. getInstance() is synchronous (returns wrapper).
 * All data methods are async (use TLL OS Persistence). Modules must use await.
 *
 * This is Commerce's own compatibility layer — does NOT modify TLL OS core.
 */

import { createFilePersistence } from '../../../../src/public/index.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data-store');

let _instance = null;

const COLLECTION_PREFIXES = {
  products: 'prod', skus: 'sku', categories: 'cat', brands: 'brand', inventory: 'inv',
  users: 'user', addresses: 'addr', membership_levels: 'mlevel',
  carts: 'cart', cart_items: 'citem',
  orders: 'ord', order_items: 'oitem',
  payments: 'pay',
  coupons: 'cpn', user_coupons: 'ucpn',
  companies: 'comp', company_members: 'cmem',
  files: 'file',
  audit_logs: 'log',
  sessions: 'sess',
  shipping_methods: 'sm', shipping_zones: 'sz', shipping_rates: 'sr', shipments: 'ship',
  suppliers: 'sup', supplier_products: 'sp', purchase_orders: 'po',
  merchants: 'mer', merchant_users: 'mu', merchant_products: 'mp',
  settlements: 'set', settlement_items: 'si', transactions: 'tx',
  promotions: 'prom', promotion_items: 'pi',
};

const ALL_COLLECTIONS = Object.keys(COLLECTION_PREFIXES);

export class CommerceDatabase {
  constructor() {
    this._persistence = null;
    this._initPromise = null;
    this._repos = new Map();
    this._counters = {};
    for (const name of ALL_COLLECTIONS) this._counters[name] = 0;
  }

  // SYNCHRONOUS — returns wrapper immediately. Persistence initializes lazily.
  static getInstance() {
    if (!_instance) _instance = new CommerceDatabase();
    return _instance;
  }

  static async reset() {
    _instance = null;
    try {
      const fs = await import('node:fs/promises');
      await fs.rm(DATA_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
    return CommerceDatabase.getInstance();
  }

  async _ensureInit() {
    if (this._persistence) return;
    if (this._initPromise) { await this._initPromise; return; }
    this._initPromise = this._doInit();
    await this._initPromise;
  }

  async _doInit() {
    const persistence = createFilePersistence(DATA_DIR);
    await persistence.connect();
    this._persistence = persistence;
    for (const name of ALL_COLLECTIONS) {
      this._repos.set(name, persistence.getRepository(name));
    }
  }

  _getRepo(collection) {
    let repo = this._repos.get(collection);
    if (!repo) {
      repo = this._persistence.getRepository(collection);
      this._repos.set(collection, repo);
    }
    return repo;
  }

  nextId(collection) {
    this._counters[collection] = (this._counters[collection] || 0) + 1;
    const prefix = COLLECTION_PREFIXES[collection] || 'id';
    return `${prefix}_${String(this._counters[collection]).padStart(6, '0')}`;
  }

  async insert(collection, data) {
    await this._ensureInit();
    const repo = this._getRepo(collection);
    const id = data.id || this.nextId(collection);
    const now = new Date().toISOString();
    const record = { ...data, id, createdAt: data.createdAt || now, updatedAt: now };
    await repo.create(record);
    return record;
  }

  async findById(collection, id) {
    await this._ensureInit();
    const repo = this._getRepo(collection);
    return repo.findById(id);
  }

  async findOne(collection, predicate) {
    await this._ensureInit();
    const repo = this._getRepo(collection);
    const all = await repo.find();
    for (const record of all) {
      if (predicate(record)) return record;
    }
    return null;
  }

  async find(collection, predicate = null, options = {}) {
    await this._ensureInit();
    const repo = this._getRepo(collection);
    let results = await repo.find();
    if (predicate) results = results.filter(predicate);
    if (options.sort) {
      const [field, dir] = options.sort;
      results.sort((a, b) => {
        const av = a[field], bv = b[field];
        if (av < bv) return dir === 'desc' ? 1 : -1;
        if (av > bv) return dir === 'desc' ? -1 : 1;
        return 0;
      });
    }
    if (options.limit) results = results.slice(0, options.limit);
    if (options.offset) results = results.slice(options.offset);
    return results;
  }

  async update(collection, id, updates) {
    await this._ensureInit();
    const repo = this._getRepo(collection);
    const existing = await repo.findById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
    await repo.update(id, updated);
    return updated;
  }

  async remove(collection, id) {
    await this._ensureInit();
    const repo = this._getRepo(collection);
    return repo.delete(id);
  }

  async count(collection, predicate = null) {
    await this._ensureInit();
    const repo = this._getRepo(collection);
    if (!predicate) return repo.count();
    const all = await repo.find();
    return all.filter(predicate).length;
  }

  async clear(collection) {
    await this._ensureInit();
    const repo = this._getRepo(collection);
    const all = await repo.find();
    for (const item of all) await repo.delete(item.id);
    this._counters[collection] = 0;
  }

  async clearAll() {
    for (const name of ALL_COLLECTIONS) await this.clear(name);
  }

  async stats() {
    await this._ensureInit();
    const result = {};
    for (const name of ALL_COLLECTIONS) {
      const repo = this._getRepo(name);
      result[name] = await repo.count();
    }
    return result;
  }

  async disconnect() {
    if (this._persistence) await this._persistence.disconnect();
  }
}
