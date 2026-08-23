/**
 * TLL Commerce - Merchant Module (多商户/SaaS)
 * 商户管理、商户用户、商户商品、商户配置
 */
import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, parseQuery } from '../utils.js';

export function registerMerchantModule(app) {
  const module = app.modules.create({
    name: 'commerce-merchant',
    version: '0.1.0',
    namespace: 'merchant',
    description: '多商户/SaaS模块：商户管理、商户用户、商户商品、费率配置',
  });
  const db = CommerceDatabase.getInstance();

  // ===== APIs =====

  // 商户列表
  module.apis.create({
    method: 'GET', path: '/api/merchant/merchants', name: 'list_merchants',
    description: '获取商户列表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let items = await db.find('merchants');
      if (q.keyword) items = items.filter(i => i.name.includes(q.keyword));
      if (q.status) items = items.filter(i => i.status === q.status);
      if (q.plan) items = items.filter(i => i.plan === q.plan);
      return ok({ items, total: items.length });
    },
  });

  // 商户详情
  module.apis.create({
    method: 'GET', path: '/api/merchant/merchants/:id', name: 'get_merchant',
    description: '获取商户详情',
    handler: async (ctx) => {
      const item = await db.findById('merchants', ctx.params.id);
      if (!item) return notFound('Merchant not found');
      const users = (await db.find('merchant_users')).filter(mu => mu.merchantId === item.id);
      const products = (await db.find('merchant_products')).filter(mp => mp.merchantId === item.id);
      const stats = {
        productCount: products.length,
        userCount: users.length,
        orderCount: (await db.find('orders')).filter(o => o.merchantId === item.id).length,
        totalRevenue: (await db.find('orders')).filter(o => o.merchantId === item.id && o.status === 'completed').reduce((s, o) => s + o.totalAmount, 0),
      };
      return ok({ ...item, users, products, stats });
    },
  });

  // 创建商户
  module.apis.create({
    method: 'POST', path: '/api/merchant/merchants', name: 'create_merchant',
    description: '创建商户（SaaS入驻）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name) return badRequest('name is required');
      const item = await db.insert('merchants', {
        name: body.name,
        code: body.code || `M${Date.now()}`,
        logo: body.logo || '',
        description: body.description || '',
        contact: body.contact || '',
        phone: body.phone || '',
        email: body.email || '',
        address: body.address || {},
        businessLicense: body.businessLicense || '',
        taxNumber: body.taxNumber || '',
        bankAccount: body.bankAccount || {},
        plan: body.plan || 'standard', // free/standard/pro/enterprise
        status: body.status || 'pending', // pending/active/suspended/closed
        feeRate: body.feeRate || 2.5, // 平台手续费率 %
        settlementCycle: body.settlementCycle || 'monthly', // daily/weekly/monthly
        minSettlementAmount: body.minSettlementAmount || 100,
        currency: body.currency || 'CNY',
        supportedCountries: body.supportedCountries || [],
        shippingFrom: body.shippingFrom || 'CN',
        returnPolicy: body.returnPolicy || '',
        shippingPolicy: body.shippingPolicy || '',
        activatedAt: null,
        suspendedReason: '',
      });
      return created(item);
    },
  });

  // 更新商户
  module.apis.create({
    method: 'PUT', path: '/api/merchant/merchants/:id', name: 'update_merchant',
    description: '更新商户信息',
    handler: async (ctx) => {
      const item = await db.findById('merchants', ctx.params.id);
      if (!item) return notFound('Merchant not found');
      const body = parseBody(ctx);
      const updated = await db.update('merchants', ctx.params.id, body);
      return ok(updated);
    },
  });

  // 商户审核（通过/拒绝）
  module.apis.create({
    method: 'PUT', path: '/api/merchant/merchants/:id/audit', name: 'audit_merchant',
    description: '审核商户入驻申请',
    handler: async (ctx) => {
      const item = await db.findById('merchants', ctx.params.id);
      if (!item) return notFound('Merchant not found');
      const body = parseBody(ctx);
      if (!['approved', 'rejected'].includes(body.action)) return badRequest('action must be approved or rejected');
      const status = body.action === 'approved' ? 'active' : 'closed';
      const updated = await db.update('merchants', ctx.params.id, {
        status,
        activatedAt: body.action === 'approved' ? new Date().toISOString() : null,
        auditReason: body.reason || '',
        auditedBy: body.auditedBy || 'system',
        auditedAt: new Date().toISOString(),
      });
      return ok(updated);
    },
  });

  // 商户用户列表
  module.apis.create({
    method: 'GET', path: '/api/merchant/merchants/:id/users', name: 'list_merchant_users',
    description: '获取商户用户列表',
    handler: async (ctx) => {
      const items = (await db.find('merchant_users')).filter(mu => mu.merchantId === ctx.params.id);
      const enriched = await Promise.all(items.map(async mu => {
        const user = await db.findById('users', mu.userId);
        return { ...mu, email: user?.email, nickname: user?.nickname };
      }));
      return ok({ items: enriched, total: enriched.length });
    },
  });

  // 添加商户用户
  module.apis.create({
    method: 'POST', path: '/api/merchant/merchant-users', name: 'add_merchant_user',
    description: '添加商户用户（员工）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.merchantId || !body.userId) return badRequest('merchantId and userId are required');
      const existing = (await db.find('merchant_users')).find(mu => mu.merchantId === body.merchantId && mu.userId === body.userId);
      if (existing) return badRequest('User already in merchant');
      const item = await db.insert('merchant_users', {
        merchantId: body.merchantId,
        userId: body.userId,
        role: body.role || 'staff', // owner/admin/staff/viewer
        permissions: body.permissions || [],
        status: body.status || 'active',
        joinedAt: new Date().toISOString(),
      });
      return created(item);
    },
  });

  // 商户商品列表
  module.apis.create({
    method: 'GET', path: '/api/merchant/merchants/:id/products', name: 'list_merchant_products',
    description: '获取商户商品列表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let items = (await db.find('merchant_products')).filter(mp => mp.merchantId === ctx.params.id);
      if (q.status) items = items.filter(i => i.status === q.status);
      const enriched = await Promise.all(items.map(async mp => {
        const product = await db.findById('products', mp.productId);
        return { ...mp, productName: product?.name, productPrice: product?.price, productStatus: product?.status };
      }));
      return ok({ items: enriched, total: enriched.length });
    },
  });

  // 商户上架商品
  module.apis.create({
    method: 'POST', path: '/api/merchant/merchant-products', name: 'add_merchant_product',
    description: '商户上架商品',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.merchantId || !body.productId) return badRequest('merchantId and productId are required');
      const item = await db.insert('merchant_products', {
        merchantId: body.merchantId,
        productId: body.productId,
        merchantPrice: body.merchantPrice || 0,
        merchantSku: body.merchantSku || '',
        stock: body.stock || 0,
        status: body.status || 'active', // active/inactive/out_of_stock
        commissionRate: body.commissionRate || null, // 单独佣金率，覆盖商户默认
        listedAt: new Date().toISOString(),
      });
      return created(item);
    },
  });

  // 商户仪表盘
  module.apis.create({
    method: 'GET', path: '/api/merchant/merchants/:id/dashboard', name: 'merchant_dashboard',
    description: '商户仪表盘数据',
    handler: async (ctx) => {
      const merchant = await db.findById('merchants', ctx.params.id);
      if (!merchant) return notFound('Merchant not found');
      const orders = (await db.find('orders')).filter(o => o.merchantId === ctx.params.id);
      const products = (await db.find('merchant_products')).filter(mp => mp.merchantId === ctx.params.id);
      const today = new Date().toISOString().slice(0, 10);
      const todayOrders = orders.filter(o => (o.createdAt || '').slice(0, 10) === today);
      const stats = {
        totalProducts: products.length,
        activeProducts: products.filter(p => p.status === 'active').length,
        totalOrders: orders.length,
        todayOrders: todayOrders.length,
        totalRevenue: orders.filter(o => ['paid', 'shipped', 'completed'].includes(o.status)).reduce((s, o) => s + o.totalAmount, 0),
        todayRevenue: todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0),
        pendingSettlement: orders.filter(o => o.status === 'completed' && !o.settled).reduce((s, o) => s + o.totalAmount * (1 - merchant.feeRate / 100), 0),
        totalCommission: orders.filter(o => ['paid', 'shipped', 'completed'].includes(o.status)).reduce((s, o) => s + o.totalAmount * merchant.feeRate / 100, 0),
      };
      return ok({ merchant: { id: merchant.id, name: merchant.name, plan: merchant.plan, status: merchant.status, feeRate: merchant.feeRate }, stats });
    },
  });

  // ===== Tools =====

  module.tools.create({
    name: 'merchant_list',
    description: '获取商户列表',
    category: 'merchant',
    parameters: { type: 'object', properties: { keyword: { type: 'string' }, status: { type: 'string' }, plan: { type: 'string' } } },
    handler: async (params) => {
      const qs = new URLSearchParams(params).toString();
      const resp = await module._app.apis.request('GET', '/merchants' + (qs ? '?' + qs : ''));
      return resp.body;
    },
  });

  module.tools.create({
    name: 'merchant_dashboard',
    description: '获取商户仪表盘数据',
    category: 'merchant',
    parameters: { type: 'object', properties: { merchantId: { type: 'string' } }, required: ['merchantId'] },
    handler: async (params) => {
      const resp = await module._app.apis.request('GET', `/merchants/${params.merchantId}/dashboard`);
      return resp.body;
    },
  });

  // ===== Tests =====

  module.tests.create({
    name: 'merchant - 商户入驻和审核',
    moduleName: 'commerce-merchant',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const createResp = await api('POST', '/api/merchant/merchants', { name: '环球优品跨境电商', contact: '陈总', phone: '13900000003', email: 'merchant@test.com', plan: 'pro', feeRate: 2.0, settlementCycle: 'weekly' });
      assert.equal(createResp.status, 201, 'should create merchant');
      assert.equal(createResp.data.status, 'pending', 'new merchant should be pending');
      const merchantId = createResp.data.id;

      const auditResp = await api('PUT', `/api/merchant/merchants/${merchantId}/audit`, { action: 'approved', reason: '资质齐全', auditedBy: 'admin' });
      assert.equal(auditResp.data.status, 'active', 'merchant should be active after approval');

      const detailResp = await api('GET', `/api/merchant/merchants/${merchantId}`);
      assert.equal(detailResp.data.plan, 'pro', 'merchant plan should be pro');
      assert.true(detailResp.data.stats, 'should have stats');
    },
  });

  module.tests.create({
    name: 'merchant - 商户商品和仪表盘',
    moduleName: 'commerce-merchant',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const merResp = await api('POST', '/api/merchant/merchants', { name: '数码海外专营店', plan: 'standard', feeRate: 3.0 });
      const merchantId = merResp.data.id;
      await api('PUT', `/api/merchant/merchants/${merchantId}/audit`, { action: 'approved' });

      const mpResp = await api('POST', '/api/merchant/merchant-products', { merchantId, productId: 'prod_000001', merchantPrice: 3999, stock: 100 });
      assert.equal(mpResp.status, 201, 'should list product');

      const dashResp = await api('GET', `/api/merchant/merchants/${merchantId}/dashboard`);
      assert.equal(dashResp.status, 200, 'should get dashboard');
      assert.true(dashResp.data.stats, 'should have stats');
      assert.true(dashResp.data.stats.pendingSettlement !== undefined, 'should have pending settlement');
    },
  });

  return module;
}
