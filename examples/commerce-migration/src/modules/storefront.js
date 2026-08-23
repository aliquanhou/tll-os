/**
 * TLL Commerce - Storefront Module
 * BFF (Backend for Frontend) APIs optimized for the H5 storefront.
 * Aggregates data from multiple modules for efficient frontend rendering.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, notFound, parseQuery } from '../utils.js';

export function registerStorefrontModule(app) {
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-storefront',
    version: '0.1.0',
    namespace: 'storefront',
    description: '前台BFF接口：首页数据、商品聚合、购物流程优化',
  });

  // ==================== Home Page ====================
  mod.apis.create({
    method: 'GET', path: '/api/storefront/home', name: 'getHomeData',
    description: '首页聚合数据：轮播、分类、热门商品、新品',
    handler: async () => {
      const banners = [
        { id: 1, image: '/images/banners/banner1.jpg', title: '新品上市', link: '/products?tag=new' },
        { id: 2, image: '/images/banners/banner2.jpg', title: '限时特惠', link: '/products?tag=sale' },
        { id: 3, image: '/images/banners/banner3.jpg', title: '会员专享', link: '/membership' },
      ];

      const categories = await db.find('categories', c => c.status === 'active' && c.level === 1, { sort: ['sort', 'asc'] });

      const hotProducts = (await db.find('products', p => p.status === 'active', { sort: ['createdAt', 'desc'], limit: 8 }))
        .map(p => ({ id: p.id, name: p.name, price: p.price, image: p.images?.[0] || '', slug: p.slug }));

      const newProducts = (await db.find('products', p => p.status === 'active', { sort: ['createdAt', 'desc'], limit: 4 }))
        .map(p => ({ id: p.id, name: p.name, price: p.price, image: p.images?.[0] || '', slug: p.slug }));

      return ok({ banners, categories, hotProducts, newProducts });
    },
  });

  // ==================== Product List (aggregated) ====================
  mod.apis.create({
    method: 'GET', path: '/api/storefront/products', name: 'getProductList',
    description: '前台商品列表（聚合分类、品牌、筛选条件）',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const result = await app.apis.request('GET', `/api/catalog/products?${new URLSearchParams(q).toString()}`);
      const body = JSON.parse(result.body);

      // Add filter options
      const brands = (await db.find('brands', b => b.status === 'active')).map(b => ({ id: b.id, name: b.name }));
      const categories = (await db.find('categories', c => c.status === 'active' && c.level === 1)).map(c => ({ id: c.id, name: c.name }));
      const priceRanges = [
        { label: '全部', min: 0, max: null },
        { label: '0-100', min: 0, max: 100 },
        { label: '100-500', min: 100, max: 500 },
        { label: '500-2000', min: 500, max: 2000 },
        { label: '2000以上', min: 2000, max: null },
      ];

      return ok({ ...body, filters: { brands, categories, priceRanges } });
    },
  });

  // ==================== Product Detail (aggregated) ====================
  mod.apis.create({
    method: 'GET', path: '/api/storefront/products/:id', name: 'getProductDetail',
    description: '前台商品详情（聚合商品、SKU、品牌、分类、相关商品）',
    handler: async (ctx) => {
      const result = await app.apis.request('GET', `/api/catalog/products/${ctx.params.id}`);
      if (result.status !== 200) return notFound('商品不存在');
      const product = JSON.parse(result.body);

      // Related products (same category)
      const related = (await db.find('products', p => p.status === 'active' && p.categoryId === product.categoryId && p.id !== product.id, { limit: 4 }))
        .map(p => ({ id: p.id, name: p.name, price: p.price, image: p.images?.[0] || '' }));

      return ok({ ...product, relatedProducts: related });
    },
  });

  // ==================== Checkout Page ====================
  mod.apis.create({
    method: 'GET', path: '/api/storefront/checkout', name: 'getCheckoutData',
    description: '结算页数据：购物车、地址、支付方式、优惠券',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const userId = q.userId || 'guest';

      const cartResp = await app.apis.request('GET', `/api/cart?userId=${userId}`);
      const cart = JSON.parse(cartResp.body);

      const addresses = await db.find('addresses', a => a.userId === userId);

      const paymentMethodsResp = await app.apis.request('GET', '/api/payment/methods');
      const paymentMethods = JSON.parse(paymentMethodsResp.body).methods;

      const coupons = await db.find('coupons', c => c.status === 'active' && c.usedCount < c.totalCount);

      return ok({ cart, addresses, paymentMethods, coupons });
    },
  });

  // ==================== User Center ====================
  mod.apis.create({
    method: 'GET', path: '/api/storefront/user-center', name: 'getUserCenter',
    description: '个人中心聚合数据：用户信息、订单统计、会员信息',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const userId = q.userId;
      if (!userId) return ok({ error: 'userId required' });

      const user = await db.findById('users', userId);
      if (!user) return notFound('用户不存在');

      const orders = await db.find('orders', o => o.userId === userId);
      const orderStats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        paid: orders.filter(o => o.status === 'paid').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        completed: orders.filter(o => o.status === 'completed').length,
      };

      const membership = await db.findById('membership_levels', user.membershipLevelId);
      const addresses = await db.find('addresses', a => a.userId === userId);

      const { passwordHash, ...safeUser } = user;
      return ok({ user: safeUser, orderStats, membership, addresses });
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'storefront - 首页数据',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('GET', '/api/storefront/home');
      ctx.assert.true(resp.status === 200);
      const body = JSON.parse(resp.body);
      ctx.assert.true(Array.isArray(body.banners), '应有轮播图');
      ctx.assert.true(body.banners.length >= 3, '应有至少3张轮播图');
      ctx.assert.true(Array.isArray(body.categories), '应有分类');
      ctx.assert.true(body.hotProducts.length > 0, '应有热门商品');
    },
  });

  mod.tests.create({
    name: 'storefront - 商品列表聚合',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('GET', '/api/storefront/products');
      ctx.assert.true(resp.status === 200);
      const body = JSON.parse(resp.body);
      ctx.assert.true(body.items.length > 0, '应有商品');
      ctx.assert.true(body.filters, '应有筛选条件');
      ctx.assert.true(body.filters.brands.length > 0, '应有品牌筛选');
      ctx.assert.true(body.filters.priceRanges.length >= 5, '应有价格区间');
    },
  });

  mod.tests.create({
    name: 'storefront - 结算页数据',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('GET', '/api/storefront/checkout?userId=user_000002');
      ctx.assert.true(resp.status === 200);
      const body = JSON.parse(resp.body);
      ctx.assert.true(body.cart, '应有购物车数据');
      ctx.assert.true(Array.isArray(body.paymentMethods), '应有支付方式');
      ctx.assert.true(body.paymentMethods.length >= 4, '应有至少4种支付方式');
      ctx.assert.true(Array.isArray(body.coupons), '应有优惠券');
    },
  });

  return mod;
}
