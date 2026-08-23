/**
 * TLL Commerce - Analytics Module (数据分析)
 * 销售分析、商品分析、用户分析、趋势报表
 */
import { CommerceDatabase } from '../data/database.js';
import { ok, parseQuery } from '../utils.js';

export function registerAnalyticsModule(app) {
  const module = app.modules.create({
    name: 'commerce-analytics',
    version: '0.1.0',
    namespace: 'analytics',
    description: '数据分析模块：销售报表、商品分析、用户分析、趋势',
  });
  const db = CommerceDatabase.getInstance();

  // ===== 辅助函数 =====
  function getDateRange(days) {
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  function filterByDate(items, start, end, dateField = 'createdAt') {
    return items.filter(i => {
      const d = String(i[dateField] || '').slice(0, 10);
      return d >= start && d <= end;
    });
  }

  function groupByDate(items, dateField = 'createdAt') {
    const map = {};
    for (const item of items) {
      const d = String(item[dateField] || '').slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(item);
    }
    return map;
  }

  // ===== APIs =====

  // 销售概览
  module.apis.create({
    method: 'GET', path: '/api/analytics/sales/overview', name: 'sales_overview',
    description: '销售概览（GMV、订单数、客单价、转化率）',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const days = parseInt(q.days) || 30;
      const { start, end } = getDateRange(days);
      const merchantId = q.merchantId;

      let orders = await db.find('orders');
      if (merchantId) orders = orders.filter(o => o.merchantId === merchantId);
      const validOrders = orders.filter(o => ['paid', 'shipped', 'completed'].includes(o.status));
      const periodOrders = filterByDate(validOrders, start, end);
      const today = new Date().toISOString().slice(0, 10);
      const todayOrders = validOrders.filter(o => String(o.createdAt || '').slice(0, 10) === today);

      const gmv = periodOrders.reduce((s, o) => s + o.totalAmount, 0);
      const orderCount = periodOrders.length;
      const avgOrderValue = orderCount > 0 ? gmv / orderCount : 0;
      const totalUsers = (await db.find('users')).length;
      const conversionRate = totalUsers > 0 ? (orderCount / totalUsers * 100) : 0;

      // 环比
      const prevStart = new Date(new Date(start).getTime() - days * 86400000).toISOString().slice(0, 10);
      const prevOrders = filterByDate(validOrders, prevStart, start);
      const prevGmv = prevOrders.reduce((s, o) => s + o.totalAmount, 0);
      const gmvGrowth = prevGmv > 0 ? ((gmv - prevGmv) / prevGmv * 100) : (gmv > 0 ? 100 : 0);

      return ok({
        period: { start, end, days },
        gmv: Math.round(gmv * 100) / 100,
        orderCount,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
        today: { orders: todayOrders.length, revenue: Math.round(todayOrders.reduce((s, o) => s + o.totalAmount, 0) * 100) / 100 },
        growth: { gmv: Math.round(gmvGrowth * 100) / 100, orders: prevOrders.length > 0 ? Math.round((orderCount - prevOrders.length) / prevOrders.length * 100) : 100 },
        totalUsers,
        totalProducts: (await db.find('products')).filter(p => p.status === 'active').length,
      });
    },
  });

  // 销售趋势
  module.apis.create({
    method: 'GET', path: '/api/analytics/sales/trend', name: 'sales_trend',
    description: '销售趋势（按日/周/月）',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const days = parseInt(q.days) || 30;
      const { start, end } = getDateRange(days);
      const merchantId = q.merchantId;

      let orders = (await db.find('orders')).filter(o => ['paid', 'shipped', 'completed'].includes(o.status));
      if (merchantId) orders = orders.filter(o => o.merchantId === merchantId);
      const periodOrders = filterByDate(orders, start, end);
      const grouped = groupByDate(periodOrders);

      const trend = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
        const dayOrders = grouped[d] || [];
        trend.push({
          date: d,
          orders: dayOrders.length,
          revenue: Math.round(dayOrders.reduce((s, o) => s + o.totalAmount, 0) * 100) / 100,
          items: dayOrders.reduce((s, o) => s + (o.items?.length || 0), 0),
        });
      }
      return ok({ period: { start, end, days }, trend });
    },
  });

  // 商品分析
  module.apis.create({
    method: 'GET', path: '/api/analytics/products', name: 'product_analytics',
    description: '商品分析（热销、滞销、库存周转）',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const limit = parseInt(q.limit) || 10;
      const merchantId = q.merchantId;

      let orders = (await db.find('orders')).filter(o => ['paid', 'shipped', 'completed'].includes(o.status));
      if (merchantId) orders = orders.filter(o => o.merchantId === merchantId);

      // 统计商品销量
      const productSales = {};
      for (const order of orders) {
        for (const item of order.items || []) {
          const pid = item.productId;
          if (!productSales[pid]) productSales[pid] = { productId: pid, productName: item.productName, quantity: 0, revenue: 0 };
          productSales[pid].quantity += item.quantity;
          productSales[pid].revenue += item.price * item.quantity;
        }
      }

      const salesList = Object.values(productSales).sort((a, b) => b.quantity - a.quantity);
      const topProducts = salesList.slice(0, limit);

      // 滞销商品（有库存但无销量）
      const allProducts = (await db.find('products')).filter(p => p.status === 'active');
      const slowProducts = allProducts.filter(p => !productSales[p.id] && (p.skuCount || 0) > 0).slice(0, limit);

      // 库存预警
      const lowStockSkus = (await db.find('skus')).filter(s => s.stock <= 10);

      // 分类销售占比
      const categorySales = {};
      for (const ps of salesList) {
        const product = await db.findById('products', ps.productId);
        const cat = product?.categoryId || 'unknown';
        if (!categorySales[cat]) categorySales[cat] = { categoryId: cat, revenue: 0, quantity: 0 };
        categorySales[cat].revenue += ps.revenue;
        categorySales[cat].quantity += ps.quantity;
      }

      return ok({
        topProducts,
        slowProducts: slowProducts.map(p => ({ id: p.id, name: p.name, price: p.price, skuCount: p.skuCount })),
        lowStockSkus: lowStockSkus.map(s => ({ id: s.id, skuCode: s.skuCode, stock: s.stock, productId: s.productId })),
        categoryBreakdown: Object.values(categorySales).sort((a, b) => b.revenue - a.revenue),
        totalSold: salesList.reduce((s, x) => s + x.quantity, 0),
        totalProductRevenue: Math.round(salesList.reduce((s, x) => s + x.revenue, 0) * 100) / 100,
      });
    },
  });

  // 用户分析
  module.apis.create({
    method: 'GET', path: '/api/analytics/users', name: 'user_analytics',
    description: '用户分析（新增、留存、复购、会员分布）',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const days = parseInt(q.days) || 30;
      const { start, end } = getDateRange(days);

      const users = await db.find('users');
      const newUsers = filterByDate(users, start, end);
      const today = new Date().toISOString().slice(0, 10);
      const todayNew = users.filter(u => String(u.createdAt || '').slice(0, 10) === today);

      // 会员分布
      const membershipDist = {};
      for (const user of users) {
        const level = user.membershipLevelId || 'none';
        membershipDist[level] = (membershipDist[level] || 0) + 1;
      }

      // 复购率（有多个订单的用户占比）
      const orders = (await db.find('orders')).filter(o => ['paid', 'shipped', 'completed'].includes(o.status));
      const userOrderCount = {};
      for (const o of orders) {
        userOrderCount[o.userId] = (userOrderCount[o.userId] || 0) + 1;
      }
      const repeatUsers = Object.values(userOrderCount).filter(c => c >= 2).length;
      const totalBuyers = Object.keys(userOrderCount).length;
      const repeatRate = totalBuyers > 0 ? (repeatUsers / totalBuyers * 100) : 0;

      // 消费分布
      const totalSpentValues = users.map(u => u.totalSpent || 0);
      const highValueUsers = users.filter(u => (u.totalSpent || 0) >= 1000).length;
      const avgSpent = totalSpentValues.length > 0 ? totalSpentValues.reduce((a, b) => a + b, 0) / totalSpentValues.length : 0;

      return ok({
        period: { start, end, days },
        totalUsers: users.length,
        newUsers: newUsers.length,
        todayNew: todayNew.length,
        membershipDistribution: membershipDist,
        buyerStats: {
          totalBuyers,
          repeatUsers,
          repeatRate: Math.round(repeatRate * 100) / 100,
          avgOrdersPerBuyer: totalBuyers > 0 ? Math.round(orders.length / totalBuyers * 100) / 100 : 0,
        },
        spending: {
          highValueUsers,
          avgSpentPerUser: Math.round(avgSpent * 100) / 100,
          totalRevenue: Math.round(totalSpentValues.reduce((a, b) => a + b, 0) * 100) / 100,
        },
      });
    },
  });

  // 订单状态分布
  module.apis.create({
    method: 'GET', path: '/api/analytics/orders/status', name: 'order_status_analytics',
    description: '订单状态分布',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const merchantId = q.merchantId;
      let orders = await db.find('orders');
      if (merchantId) orders = orders.filter(o => o.merchantId === merchantId);

      const statusMap = { pending: 0, paid: 0, shipped: 0, completed: 0, cancelled: 0, refunded: 0 };
      const statusAmount = { pending: 0, paid: 0, shipped: 0, completed: 0, cancelled: 0, refunded: 0 };
      for (const o of orders) {
        const s = o.status || 'pending';
        statusMap[s] = (statusMap[s] || 0) + 1;
        statusAmount[s] = (statusAmount[s] || 0) + (o.totalAmount || 0);
      }
      return ok({
        total: orders.length,
        byStatus: statusMap,
        amountByStatus: Object.fromEntries(Object.entries(statusAmount).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      });
    },
  });

  // 综合报表（导出用）
  module.apis.create({
    method: 'GET', path: '/api/analytics/report', name: 'full_report',
    description: '综合数据分析报表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const days = parseInt(q.days) || 30;
      const merchantId = q.merchantId;

      const [sales, trend, products, users, status] = await Promise.all([
        module._app.apis.request('GET', `/analytics/sales/overview?days=${days}${merchantId ? '&merchantId=' + merchantId : ''}`),
        module._app.apis.request('GET', `/analytics/sales/trend?days=${days}${merchantId ? '&merchantId=' + merchantId : ''}`),
        module._app.apis.request('GET', `/analytics/products?limit=5${merchantId ? '&merchantId=' + merchantId : ''}`),
        module._app.apis.request('GET', `/analytics/users?days=${days}`),
        module._app.apis.request('GET', `/analytics/orders/status${merchantId ? '?merchantId=' + merchantId : ''}`),
      ]);

      return ok({
        generatedAt: new Date().toISOString(),
        period: { days },
        sales: sales.body,
        trend: trend.body,
        products: products.body,
        users: users.body,
        orderStatus: status.body,
      });
    },
  });

  // ===== Tools =====

  module.tools.create({
    name: 'analytics_sales_overview',
    description: '获取销售概览数据',
    category: 'analytics',
    parameters: { type: 'object', properties: { days: { type: 'number' }, merchantId: { type: 'string' } } },
    handler: async (params) => {
      const qs = new URLSearchParams(params).toString();
      const resp = await module._app.apis.request('GET', '/analytics/sales/overview' + (qs ? '?' + qs : ''));
      return resp.body;
    },
  });

  module.tools.create({
    name: 'analytics_full_report',
    description: '获取综合数据分析报表',
    category: 'analytics',
    parameters: { type: 'object', properties: { days: { type: 'number' }, merchantId: { type: 'string' } } },
    handler: async (params) => {
      const qs = new URLSearchParams(params).toString();
      const resp = await module._app.apis.request('GET', '/analytics/report' + (qs ? '?' + qs : ''));
      return resp.body;
    },
  });

  // ===== Tests =====

  module.tests.create({
    name: 'analytics - 销售概览和趋势',
    moduleName: 'commerce-analytics',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const overviewResp = await api('GET', '/api/analytics/sales/overview?days=30');
      assert.equal(overviewResp.status, 200, 'should get sales overview');
      assert.true(overviewResp.data.gmv !== undefined, 'should have gmv');
      assert.true(overviewResp.data.orderCount !== undefined, 'should have order count');

      const trendResp = await api('GET', '/api/analytics/sales/trend?days=7');
      assert.equal(trendResp.status, 200, 'should get sales trend');
      assert.true(Array.isArray(trendResp.data.trend), 'should have trend array');
      assert.true(trendResp.data.trend.length > 0, 'should have trend data');
    },
  });

  module.tests.create({
    name: 'analytics - 商品和用户分析',
    moduleName: 'commerce-analytics',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const productResp = await api('GET', '/api/analytics/products?limit=5');
      assert.equal(productResp.status, 200, 'should get product analytics');
      assert.true(Array.isArray(productResp.data.topProducts), 'should have top products');

      const userResp = await api('GET', '/api/analytics/users?days=30');
      assert.equal(userResp.status, 200, 'should get user analytics');
      assert.true(userResp.data.totalUsers > 0, 'should have users');
      assert.true(userResp.data.buyerStats, 'should have buyer stats');
    },
  });

  return module;
}
