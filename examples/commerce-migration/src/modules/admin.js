/**
 * TLL Commerce - Admin Module
 * Backend management APIs: dashboard stats, order management, product management,
 * user management, sales reports, and system configuration.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, parseQuery, toolSuccess } from '../utils.js';

export function registerAdminModule(app) {
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-admin',
    version: '0.1.0',
    namespace: 'admin',
    description: '后台管理：仪表盘、订单管理、商品管理、用户管理、销售报表',
  });

  // ==================== Dashboard ====================
  mod.apis.create({
    method: 'GET', path: '/api/admin/dashboard', name: 'getDashboard',
    description: '后台仪表盘统计数据',
    handler: async () => {
      const orders = await db.find('orders');
      const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'shipped' || o.status === 'completed');
      const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const today = new Date().toISOString().split('T')[0];
      const todayOrders = orders.filter(o => String(o.createdAt).startsWith(today));
      const todayRevenue = todayOrders.filter(o => o.status !== 'pending' && o.status !== 'cancelled').reduce((sum, o) => sum + o.totalAmount, 0);

      const stats = {
        totalProducts: await db.count('products'),
        totalSkus: await db.count('skus'),
        totalUsers: await db.count('users'),
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        paidOrders: paidOrders.length,
        totalRevenue,
        todayOrders: todayOrders.length,
        todayRevenue,
        totalCategories: await db.count('categories'),
        totalBrands: await db.count('brands'),
        totalCoupons: await db.count('coupons'),
        lowStockSkus: (await db.find('skus', s => s.stock < 20 && s.status === 'active')).length,
      };

      // Sales by status
      const orderStatusCounts = {};
      for (const o of orders) orderStatusCounts[o.status] = (orderStatusCounts[o.status] || 0) + 1;

      // Top products
      const orderItems = await db.find('order_items');
      const productSales = {};
      for (const item of orderItems) {
        productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
      }
      const topProducts = await Promise.all(Object.entries(productSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(async ([pid, qty]) => {
          const p = await db.findById('products', pid);
          return { productId: pid, name: p?.name || 'Unknown', quantity: qty };
        }));

      return ok({ stats, orderStatusCounts, topProducts });
    },
  });

  // ==================== Order Management ====================
  mod.apis.create({
    method: 'GET', path: '/api/admin/orders', name: 'adminListOrders',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let orders = await db.find('orders');
      if (q.status) orders = orders.filter(o => o.status === q.status);
      if (q.keyword) {
        const kw = q.keyword.toLowerCase();
        orders = orders.filter(o => o.orderNo.toLowerCase().includes(kw));
      }
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const page = Math.max(1, parseInt(q.page) || 1);
      const pageSize = Math.max(1, Math.min(100, parseInt(q.pageSize) || 20));
      const total = orders.length;
      const items = orders.slice((page - 1) * pageSize, page * pageSize);
      return ok({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
    },
  });

  // ==================== Product Management ====================
  mod.apis.create({
    method: 'GET', path: '/api/admin/products', name: 'adminListProducts',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let products = await db.find('products');
      if (q.status) products = products.filter(p => p.status === q.status);
      if (q.keyword) {
        const kw = q.keyword.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(kw));
      }
      const page = Math.max(1, parseInt(q.page) || 1);
      const pageSize = Math.max(1, Math.min(100, parseInt(q.pageSize) || 20));
      const total = products.length;
      const items = products.slice((page - 1) * pageSize, page * pageSize);
      return ok({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
    },
  });

  // ==================== User Management ====================
  mod.apis.create({
    method: 'GET', path: '/api/admin/users', name: 'adminListUsers',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let users = await db.find('users');
      if (q.role) users = users.filter(u => u.role === q.role);
      const page = Math.max(1, parseInt(q.page) || 1);
      const pageSize = Math.max(1, Math.min(100, parseInt(q.pageSize) || 20));
      const total = users.length;
      const items = users.slice((page - 1) * pageSize, page * pageSize).map(({ passwordHash, ...u }) => u);
      return ok({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
    },
  });

  // ==================== System Info ====================
  mod.apis.create({
    method: 'GET', path: '/api/admin/system', name: 'getSystemInfo',
    handler: async () => {
      return ok({
        appName: 'TLL Commerce',
        version: '0.1.0',
        runtime: 'TLL OS Runtime 0.1',
        protocol: 'TLL OS Protocol 2.0',
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: { type: 'in-memory', collections: await db.stats() },
        modules: app.modules.list().map(m => ({ name: m.name, version: m.version, namespace: m.namespace, apis: m.apis.list().length, tools: m.tools.list().length, tests: m.tests.list().length })),
        graph: (() => { const g = app.graph.toJSON(); const byType = {}; for (const n of g.nodes) byType[n.type] = (byType[n.type] || 0) + 1; return { totalNodes: g.nodes.length, totalEdges: g.edges.length, byType }; })(),
      });
    },
  });

  // ==================== Tools ====================
  mod.tools.create({
    name: 'admin_dashboard',
    description: '获取后台仪表盘统计',
    category: 'admin',
    parameters: {},
    handler: async () => {
      const resp = await app.apis.request('GET', '/api/admin/dashboard');
      return toolSuccess(JSON.parse(resp.body));
    },
  });

  mod.tools.create({
    name: 'admin_system_info',
    description: '获取系统信息',
    category: 'admin',
    parameters: {},
    handler: async () => {
      const resp = await app.apis.request('GET', '/api/admin/system');
      return toolSuccess(JSON.parse(resp.body));
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'admin - 仪表盘数据',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('GET', '/api/admin/dashboard');
      ctx.assert.true(resp.status === 200);
      const body = JSON.parse(resp.body);
      ctx.assert.true(body.stats.totalProducts > 0, '应有商品统计');
      ctx.assert.true(body.stats.totalUsers > 0, '应有用户统计');
      ctx.assert.true(body.stats.totalOrders >= 0, '应有订单统计');
    },
  });

  mod.tests.create({
    name: 'admin - 系统信息',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('GET', '/api/admin/system');
      ctx.assert.true(resp.status === 200);
      const body = JSON.parse(resp.body);
      ctx.assert.true(body.appName === 'TLL Commerce');
      ctx.assert.true(body.version === '0.1.0');
      ctx.assert.true(Array.isArray(body.modules), '应有模块列表');
      ctx.assert.true(body.modules.length >= 5, '应有至少5个模块');
    },
  });

  return mod;
}
