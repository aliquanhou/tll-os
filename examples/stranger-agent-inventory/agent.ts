/**
 * TLL OS — Stranger Agent Inventory Management Example
 *
 * Simulates an AI Agent that has NEVER seen TLL OS source code.
 * Only read https://ts.knitoem.com/agent/index.json + TypeScript types.
 *
 * Documentation gaps discovered by this experiment:
 *   1. createTllOS() → tll.createApplication() two-step not clear in docs
 *   2. Need await app.start() before use
 *   3. API: app.modules.create() not registerModule()
 *   4. app.graph is property not getGraph()
 *   5. API handlers return { status, headers, body }
 *   6. app.apis.request() not app.request()
 *   7. module.tests.create() not module.registerTest()
 *   8. Tools use tool.invoke() not tool.execute()
 */

import { createTllOS } from '../../src/public/index.js';

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   Stranger Agent — Inventory Management App               ║');
console.log('║   (Agent has never seen TLL OS source code)              ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('Agent knowledge: agent JSON docs + TypeScript type definitions');
console.log('Agent constraint: ONLY @tll/os/public contract');
console.log('');

// Step 1: Create TLL OS + Application
console.log('━━━ Step 1: Create Application ━━━');
const tll = createTllOS();
const app = tll.createApplication({
  name: 'inventory-manager', version: '1.0.0',
  description: 'Inventory app by stranger agent',
  environment: 'test', runtime: 'node',
});
await app.start();
console.log('  ✅ Application created: inventory-manager v1.0.0');
const graph = app.graph;
console.log(`  📊 Graph nodes: ${graph.listNodes().length}`);

// Step 2: Create Module
console.log('');
console.log('━━━ Step 2: Create Inventory Module ━━━');
const inventoryModule = app.modules.create({
  name: 'inventory', version: '1.0.0', namespace: 'Inventory',
  description: 'Inventory management — items, stock, restocking',
});
console.log('  ✅ Module created: inventory');

// Data store
interface Item { id: string; sku: string; name: string; quantity: number; price: number; createdAt: number; updatedAt: number; }
const items = new Map<string, Item>();
let nextId = 1;
const genId = () => `item_${String(nextId++).padStart(4, '0')}`;

// Step 3: Create APIs
console.log('');
console.log('━━━ Step 3: Create REST APIs ━━━');
const jsonHeader = { 'content-type': 'application/json' };

inventoryModule.apis.create({
  method: 'GET', path: '/api/items', name: 'inventory.list',
  handler: (req: any) => {
    let r = Array.from(items.values());
    if (req.query?.lowStock === 'true') r = r.filter((i) => i.quantity < 10);
    return { status: 200, headers: jsonHeader, body: { items: r, total: r.length } };
  },
});

inventoryModule.apis.create({
  method: 'GET', path: '/api/items/:id', name: 'inventory.get',
  handler: (req: any) => {
    const item = items.get(req.params.id);
    if (!item) return { status: 404, headers: jsonHeader, body: { error: 'Not found' } };
    return { status: 200, headers: jsonHeader, body: item };
  },
});

inventoryModule.apis.create({
  method: 'POST', path: '/api/items', name: 'inventory.create',
  handler: (req: any) => {
    const b = req.body || {};
    if (!b.sku || !b.name) return { status: 400, headers: jsonHeader, body: { error: 'sku and name required' } };
    const now = Date.now();
    const item: Item = { id: genId(), sku: b.sku, name: b.name, quantity: b.quantity ?? 0, price: b.price ?? 0, createdAt: now, updatedAt: now };
    items.set(item.id, item);
    return { status: 201, headers: jsonHeader, body: item };
  },
});

inventoryModule.apis.create({
  method: 'PUT', path: '/api/items/:id', name: 'inventory.update',
  handler: (req: any) => {
    const item = items.get(req.params.id);
    if (!item) return { status: 404, headers: jsonHeader, body: { error: 'Not found' } };
    const b = req.body || {};
    if (b.name !== undefined) item.name = b.name;
    if (b.quantity !== undefined) item.quantity = b.quantity;
    if (b.price !== undefined) item.price = b.price;
    item.updatedAt = Date.now();
    return { status: 200, headers: jsonHeader, body: item };
  },
});

inventoryModule.apis.create({
  method: 'DELETE', path: '/api/items/:id', name: 'inventory.delete',
  handler: (req: any) => {
    const ok = items.delete(req.params.id);
    if (!ok) return { status: 404, headers: jsonHeader, body: { error: 'Not found' } };
    return { status: 200, headers: jsonHeader, body: { message: 'Deleted' } };
  },
});

inventoryModule.apis.create({
  method: 'POST', path: '/api/items/:id/restock', name: 'inventory.restock',
  handler: (req: any) => {
    const item = items.get(req.params.id);
    if (!item) return { status: 404, headers: jsonHeader, body: { error: 'Not found' } };
    const amount = req.body?.amount ?? 0;
    if (amount <= 0) return { status: 400, headers: jsonHeader, body: { error: 'amount must be positive' } };
    item.quantity += amount;
    item.updatedAt = Date.now();
    return { status: 200, headers: jsonHeader, body: { item, added: amount, newQuantity: item.quantity } };
  },
});

console.log('  ✅ 6 API endpoints created');

// Step 4: Create Tool
console.log('');
console.log('━━━ Step 4: Create Inventory Tool ━━━');
inventoryModule.tools.create({
  name: 'manage_inventory',
  description: 'Manage inventory: create, list, get, update, delete, restock',
  category: 'inventory',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', description: 'create|list|get|update|delete|restock' },
      id: { type: 'string' }, sku: { type: 'string' }, name: { type: 'string' },
      quantity: { type: 'number' }, price: { type: 'number' }, amount: { type: 'number' },
      lowStock: { type: 'boolean' },
    },
    required: ['operation'],
  },
  handler: async (params: any) => {
    switch (params.operation) {
      case 'create': {
        if (!params.sku || !params.name) return { success: false, error: { code: 'INVALID_PARAMS', message: 'sku and name required' } };
        const now = Date.now();
        const item = { id: genId(), sku: params.sku, name: params.name, quantity: params.quantity ?? 0, price: params.price ?? 0, createdAt: now, updatedAt: now };
        items.set(item.id, item);
        return { success: true, data: { item } };
      }
      case 'list': {
        let r = Array.from(items.values());
        if (params.lowStock) r = r.filter((i) => i.quantity < 10);
        return { success: true, data: { items: r, total: r.length } };
      }
      case 'get': {
        const item = items.get(params.id);
        if (!item) return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
        return { success: true, data: { item } };
      }
      case 'update': {
        const item = items.get(params.id);
        if (!item) return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
        if (params.name !== undefined) item.name = params.name;
        if (params.quantity !== undefined) item.quantity = params.quantity;
        if (params.price !== undefined) item.price = params.price;
        item.updatedAt = Date.now();
        return { success: true, data: { item } };
      }
      case 'delete': {
        const ok = items.delete(params.id);
        if (!ok) return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
        return { success: true, data: { message: 'Deleted' } };
      }
      case 'restock': {
        const item = items.get(params.id);
        if (!item) return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
        const amount = params.amount ?? 0;
        if (amount <= 0) return { success: false, error: { code: 'INVALID_PARAMS', message: 'amount must be positive' } };
        item.quantity += amount;
        item.updatedAt = Date.now();
        return { success: true, data: { item, added: amount, newQuantity: item.quantity } };
      }
      default: return { success: false, error: { code: 'UNKNOWN_OPERATION', message: `Unknown operation: ${params.operation}` } };
    }
  },
});
console.log('  ✅ Tool created: manage_inventory (6 operations)');

// Step 5: Create Tests
console.log('');
console.log('━━━ Step 5: Create Tests ━━━');

inventoryModule.tests.create({
  name: 'api.create_item', moduleName: 'inventory', test: async (ctx: any) => {
    const r = await ctx.application.apis.request('POST', '/api/items', { sku: 'S1', name: 'Widget', quantity: 100, price: 9.99 });
    ctx.assert.equal(r.status, 201, `Expected 201 got ${r.status}`);
    ctx.assert.true(r.body.id !== undefined, 'Should have id');
  },
});

inventoryModule.tests.create({
  name: 'api.list_items', moduleName: 'inventory', test: async (ctx: any) => {
    const r = await ctx.application.apis.request('GET', '/api/items');
    ctx.assert.equal(r.status, 200);
    ctx.assert.true(Array.isArray(r.body.items), 'Should be array');
    ctx.assert.true(r.body.total >= 1, 'Should have items');
  },
});

inventoryModule.tests.create({
  name: 'api.get_item', moduleName: 'inventory', test: async (ctx: any) => {
    const c = await ctx.application.apis.request('POST', '/api/items', { sku: 'S2', name: 'GetMe', quantity: 50, price: 1 });
    const id = c.body.id;
    const r = await ctx.application.apis.request('GET', `/api/items/${id}`);
    ctx.assert.equal(r.status, 200);
    ctx.assert.equal(r.body.id, id, 'Should return same id');
  },
});

inventoryModule.tests.create({
  name: 'api.update_item', moduleName: 'inventory', test: async (ctx: any) => {
    const c = await ctx.application.apis.request('POST', '/api/items', { sku: 'S3', name: 'Old', quantity: 10, price: 1 });
    const id = c.body.id;
    const r = await ctx.application.apis.request('PUT', `/api/items/${id}`, { name: 'New', quantity: 20 });
    ctx.assert.equal(r.status, 200);
    ctx.assert.equal(r.body.name, 'New', 'Name should be updated');
    ctx.assert.equal(r.body.quantity, 20, 'Qty should be updated');
  },
});

inventoryModule.tests.create({
  name: 'api.delete_item', moduleName: 'inventory', test: async (ctx: any) => {
    const c = await ctx.application.apis.request('POST', '/api/items', { sku: 'S4', name: 'DeleteMe', quantity: 5, price: 1 });
    const id = c.body.id;
    const d = await ctx.application.apis.request('DELETE', `/api/items/${id}`);
    ctx.assert.equal(d.status, 200, 'Delete should return 200');
    const g = await ctx.application.apis.request('GET', `/api/items/${id}`);
    ctx.assert.equal(g.status, 404, 'Should be 404 after delete');
  },
});

inventoryModule.tests.create({
  name: 'api.restock_item', moduleName: 'inventory', test: async (ctx: any) => {
    const c = await ctx.application.apis.request('POST', '/api/items', { sku: 'S5', name: 'Restock', quantity: 5, price: 1 });
    const id = c.body.id;
    const r = await ctx.application.apis.request('POST', `/api/items/${id}/restock`, { amount: 50 });
    ctx.assert.equal(r.status, 200);
    ctx.assert.equal(r.body.added, 50, 'Added should be 50');
    ctx.assert.equal(r.body.newQuantity, 55, 'New qty should be 55');
  },
});

inventoryModule.tests.create({
  name: 'api.low_stock_filter', moduleName: 'inventory', test: async (ctx: any) => {
    await ctx.application.apis.request('POST', '/api/items', { sku: 'LOWX', name: 'Low', quantity: 3, price: 1 });
    await ctx.application.apis.request('POST', '/api/items', { sku: 'HIGHX', name: 'High', quantity: 200, price: 1 });
    const r = await ctx.application.apis.request('GET', '/api/items?lowStock=true');
    const low = r.body.items.filter((i: any) => i.sku === 'LOWX');
    const high = r.body.items.filter((i: any) => i.sku === 'HIGHX');
    ctx.assert.equal(low.length, 1, 'Low stock should be included');
    ctx.assert.equal(high.length, 0, 'High stock should be excluded');
  },
});

inventoryModule.tests.create({
  name: 'tool.manage_inventory', moduleName: 'inventory', test: async (ctx: any) => {
    const tool = ctx.application.tools.get('manage_inventory');
    ctx.assert.true(tool !== null && tool !== undefined, 'Tool should exist');
    const c = await tool.invoke({ operation: 'create', sku: 'T1', name: 'ToolItem', quantity: 75, price: 25 });
    ctx.assert.true(c.success, 'Tool invoke should succeed');
    ctx.assert.true(c.data?.item !== undefined, 'Tool create should return item in data');
    ctx.assert.true(c.data.item.id !== undefined, 'Item should have id');
    const l = await tool.invoke({ operation: 'list' });
    ctx.assert.true(l.success, 'Tool list should succeed');
    const found = l.data.items.find((i: any) => i.sku === 'T1');
    ctx.assert.true(found !== undefined, 'Created item should be in list');
  },
});

console.log('  ✅ 8 tests created');

// Step 6: Run Tests
console.log('');
console.log('━━━ Step 6: Run Tests ━━━');
const tr = await app.tests.runAll();
console.log(`  ℹ️  结果: ${tr.passed}/${tr.total} 通过, ${tr.failed} 失败, ${tr.errors} 错误 (${tr.duration}ms)`);
for (const t of tr.results) {
  console.log(`  ${t.passed ? '✅' : '❌'} ${t.passed ? 'PASS' : 'FAIL'}: ${t.name}`);
  if (!t.passed && t.error) console.log(`     错误: ${t.error.message || t.error}`);
}

// Step 7: Graph Report
console.log('');
console.log('━━━ Step 7: Application Graph ━━━');
const nodes = graph.listNodes();
const edges = graph.listEdges();
console.log(`  📊 节点: ${nodes.length}, 边: ${edges.length}`);
const types: Record<string, number> = {};
for (const n of nodes) types[n.type] = (types[n.type] || 0) + 1;
for (const [t, c] of Object.entries(types)) console.log(`    ${t}: ${c}`);

// Final
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║              Stranger Agent — Final Report                ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('  Agent knowledge: ONLY agent JSON + TypeScript types');
console.log('  Agent constraint: ONLY @tll/os/public contract');
console.log('');
console.log('  Built: Application + Module + 6 APIs + 1 Tool + 8 tests');
console.log(`  Tests: ${tr.passed}/${tr.total} passed`);
console.log(`  Graph: ${nodes.length} nodes, ${edges.length} edges`);
console.log('');
console.log('  Documentation gaps discovered (should be fixed in agent JSON):');
console.log('    1. createTllOS() → tll.createApplication() two-step');
console.log('    2. Need await app.start() before use');
console.log('    3. app.modules.create() not registerModule()');
console.log('    4. app.graph is property not getGraph()');
console.log('    5. API handlers return { status, headers, body }');
console.log('    6. app.apis.request() not app.request()');
console.log('    7. module.tests.create() not registerTest()');
console.log('    8. Tools use tool.invoke() not tool.execute()');
console.log('');

await app.stop();

if (tr.passed === tr.total && tr.errors === 0) {
  console.log('  ✅ STRANGER AGENT TEST PASSED');
  console.log('  TLL OS Protocol 2.0 is ready for public release.');
  process.exit(0);
} else {
  console.log('  ❌ STRANGER AGENT TEST FAILED');
  process.exit(1);
}
