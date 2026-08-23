/**
 * TLL Commerce - Promotion Module (促销活动)
 * 满减、限时折扣、组合套餐、活动管理
 * 与 marketing(优惠券) 区分：promotion 是平台级活动，marketing 是用户级优惠券
 */
import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, parseQuery } from '../utils.js';

export function registerPromotionModule(app) {
  const module = app.modules.create({
    name: 'commerce-promotion',
    version: '0.1.0',
    namespace: 'promotion',
    description: '促销活动模块：满减、限时折扣、组合套餐',
  });
  const db = CommerceDatabase.getInstance();

  // ===== APIs =====

  // 活动列表
  module.apis.create({
    method: 'GET', path: '/api/promotion/promotions', name: 'list_promotions',
    description: '获取促销活动列表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let items = await db.find('promotions');
      if (q.type) items = items.filter(i => i.type === q.type);
      if (q.status) items = items.filter(i => i.status === q.status);
      if (q.active === 'true') {
        const now = new Date().toISOString();
        items = items.filter(i => i.status === 'active' && i.startAt <= now && i.endAt >= now);
      }
      return ok({ items, total: items.length });
    },
  });

  // 活动详情
  module.apis.create({
    method: 'GET', path: '/api/promotion/promotions/:id', name: 'get_promotion',
    description: '获取促销活动详情（含商品）',
    handler: async (ctx) => {
      const item = await db.findById('promotions', ctx.params.id);
      if (!item) return notFound('Promotion not found');
      const promoItems = (await db.find('promotion_items')).filter(pi => pi.promotionId === item.id);
      return ok({ ...item, items: promoItems });
    },
  });

  // 创建活动
  module.apis.create({
    method: 'POST', path: '/api/promotion/promotions', name: 'create_promotion',
    description: '创建促销活动',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name || !body.type) return badRequest('name and type are required');
      const validTypes = ['full_reduction', 'flash_sale', 'bundle', 'discount', 'new_user'];
      if (!validTypes.includes(body.type)) return badRequest(`Invalid type. Must be one of: ${validTypes.join(', ')}`);

      const now = new Date().toISOString();
      const item = await db.insert('promotions', {
        name: body.name,
        type: body.type,
        description: body.description || '',
        banner: body.banner || '',
        status: body.status || 'draft', // draft/active/paused/ended
        startAt: body.startAt || now,
        endAt: body.endAt || new Date(Date.now() + 7 * 86400000).toISOString(),
        // 满减规则
        fullReductionRules: body.fullReductionRules || [], // [{threshold: 100, discount: 10}, ...]
        // 限时折扣规则
        discountRate: body.discountRate || 0, // 0-100, 如 80 表示 8 折
        maxDiscountPerOrder: body.maxDiscountPerOrder || 0,
        // 组合套餐
        bundlePrice: body.bundlePrice || 0,
        // 通用
        minOrderAmount: body.minOrderAmount || 0,
        maxUsagePerUser: body.maxUsagePerUser || 0,
        totalUsageLimit: body.totalUsageLimit || 0,
        usedCount: 0,
        stackable: body.stackable !== false, // 是否可与优惠券叠加
        merchantId: body.merchantId || null,
        priority: body.priority || 0,
        createdAt: now,
      });
      return created(item);
    },
  });

  // 更新活动
  module.apis.create({
    method: 'PUT', path: '/api/promotion/promotions/:id', name: 'update_promotion',
    description: '更新促销活动',
    handler: async (ctx) => {
      const item = await db.findById('promotions', ctx.params.id);
      if (!item) return notFound('Promotion not found');
      const body = parseBody(ctx);
      const updated = await db.update('promotions', ctx.params.id, body);
      return ok(updated);
    },
  });

  // 活动上下架
  module.apis.create({
    method: 'PUT', path: '/api/promotion/promotions/:id/status', name: 'update_promotion_status',
    description: '更新活动状态（上线/下线/暂停）',
    handler: async (ctx) => {
      const item = await db.findById('promotions', ctx.params.id);
      if (!item) return notFound('Promotion not found');
      const body = parseBody(ctx);
      if (!['draft', 'active', 'paused', 'ended'].includes(body.status)) return badRequest('Invalid status');
      const updated = await db.update('promotions', ctx.params.id, { status: body.status });
      return ok(updated);
    },
  });

  // 添加活动商品
  module.apis.create({
    method: 'POST', path: '/api/promotion/promotion-items', name: 'add_promotion_item',
    description: '添加活动商品',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.promotionId || !body.productId) return badRequest('promotionId and productId are required');
      const promo = await db.findById('promotions', body.promotionId);
      if (!promo) return notFound('Promotion not found');
      const product = await db.findById('products', body.productId);
      if (!product) return notFound('Product not found');

      const item = await db.insert('promotion_items', {
        promotionId: body.promotionId,
        productId: body.productId,
        productName: product.name,
        originalPrice: body.originalPrice || product.price,
        promoPrice: body.promoPrice || 0, // 限时折扣价
        discountRate: body.discountRate || promo.discountRate || 0,
        stock: body.stock || 0, // 活动库存
        sold: 0,
        limitPerUser: body.limitPerUser || 0,
        sort: body.sort || 0,
        status: body.status || 'active',
      });
      return created(item);
    },
  });

  // 计算促销优惠（核心）
  module.apis.create({
    method: 'POST', path: '/api/promotion/promotions/calculate', name: 'calculate_promotion',
    description: '计算订单可享受的促销优惠',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      const { items = [], orderAmount = 0, userId = '', merchantId = '' } = body;
      if (orderAmount <= 0 && items.length === 0) return badRequest('items or orderAmount is required');

      const now = new Date().toISOString();
      const activePromotions = (await db.find('promotions')).filter(p =>
        p.status === 'active' &&
        p.startAt <= now &&
        p.endAt >= now &&
        (!p.merchantId || p.merchantId === merchantId)
      );

      const results = [];
      let bestDiscount = 0;
      let bestPromotion = null;

      for (const promo of activePromotions) {
        let discount = 0;
        let applicable = false;
        let detail = '';

        if (promo.type === 'full_reduction') {
          // 满减：按最高档位计算
          const rules = (promo.fullReductionRules || []).sort((a, b) => b.threshold - a.threshold);
          for (const rule of rules) {
            if (orderAmount >= rule.threshold) {
              discount = rule.discount;
              applicable = true;
              detail = `满${rule.threshold}减${rule.discount}`;
              break;
            }
          }
        } else if (promo.type === 'discount') {
          // 整单折扣
          if (orderAmount >= promo.minOrderAmount) {
            discount = Math.round(orderAmount * (100 - promo.discountRate) / 100 * 100) / 100;
            if (promo.maxDiscountPerOrder > 0 && discount > promo.maxDiscountPerOrder) {
              discount = promo.maxDiscountPerOrder;
            }
            applicable = true;
            detail = `${promo.discountRate / 10}折优惠`;
          }
        } else if (promo.type === 'flash_sale') {
          // 限时折扣：按活动商品计算
          const promoItems = (await db.find('promotion_items')).filter(pi => pi.promotionId === promo.id && pi.status === 'active');
          const promoProductIds = new Set(promoItems.map(pi => pi.productId));
          for (const item of items) {
            if (promoProductIds.has(item.productId)) {
              const pi = promoItems.find(x => x.productId === item.productId);
              const itemDiscount = (item.price - (pi?.promoPrice || item.price * (promo.discountRate / 100))) * item.quantity;
              discount += Math.max(0, itemDiscount);
              applicable = true;
            }
          }
          detail = '限时折扣';
        } else if (promo.type === 'bundle') {
          // 组合套餐
          const promoItems = (await db.find('promotion_items')).filter(pi => pi.promotionId === promo.id);
          const bundleProductIds = new Set(promoItems.map(pi => pi.productId));
          const hasAll = items.every(it => bundleProductIds.has(it.productId));
          if (hasAll && items.length >= promoItems.length) {
            const originalTotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
            discount = originalTotal - promo.bundlePrice;
            applicable = true;
            detail = `组合套餐价 ¥${promo.bundlePrice}`;
          }
        }

        if (applicable && discount > 0) {
          results.push({
            promotionId: promo.id,
            name: promo.name,
            type: promo.type,
            discount: Math.round(discount * 100) / 100,
            detail,
            stackable: promo.stackable,
          });
          if (discount > bestDiscount) {
            bestDiscount = discount;
            bestPromotion = promo.id;
          }
        }
      }

      // 按优惠金额排序
      results.sort((a, b) => b.discount - a.discount);

      return ok({
        orderAmount,
        applicablePromotions: results,
        bestPromotion: results[0] || null,
        maxDiscount: results[0]?.discount || 0,
        finalAmount: Math.round((orderAmount - (results[0]?.discount || 0)) * 100) / 100,
      });
    },
  });

  // 活动商品列表（前台用）
  module.apis.create({
    method: 'GET', path: '/api/promotion/promotions/active/items', name: 'active_promotion_items',
    description: '获取当前活跃活动的商品列表（前台展示）',
    handler: async (ctx) => {
      const now = new Date().toISOString();
      const activePromos = (await db.find('promotions')).filter(p => p.status === 'active' && p.startAt <= now && p.endAt >= now);
      const allItems = [];
      for (const promo of activePromos) {
        const items = (await db.find('promotion_items')).filter(pi => pi.promotionId === promo.id && pi.status === 'active');
        for (const item of items) {
          const product = await db.findById('products', item.productId);
          allItems.push({
            ...item,
            promotionName: promo.name,
            promotionType: promo.type,
            endAt: promo.endAt,
            productImage: product?.image,
            productStatus: product?.status,
          });
        }
      }
      allItems.sort((a, b) => (b.promoPrice || 0) - (a.promoPrice || 0));
      return ok({ items: allItems, total: allItems.length, activePromotionCount: activePromos.length });
    },
  });

  // ===== Tools =====

  module.tools.create({
    name: 'promotion_calculate',
    description: '计算订单可享受的促销优惠',
    category: 'promotion',
    parameters: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        orderAmount: { type: 'number' },
        userId: { type: 'string' },
        merchantId: { type: 'string' },
      },
    },
    handler: async (params) => {
      const resp = await module._app.apis.request('POST', '/promotions/calculate', params);
      return resp.body;
    },
  });

  module.tools.create({
    name: 'promotion_list_active',
    description: '获取当前活跃的促销活动',
    category: 'promotion',
    parameters: { type: 'object', properties: { type: { type: 'string' } } },
    handler: async (params) => {
      const qs = new URLSearchParams({ active: 'true', ...params }).toString();
      const resp = await module._app.apis.request('GET', '/promotions?' + qs);
      return resp.body;
    },
  });

  // ===== Tests =====

  module.tests.create({
    name: 'promotion - 满减活动',
    moduleName: 'commerce-promotion',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const promoResp = await api('POST', '/api/promotion/promotions', {
        name: '满100减10 满200减30', type: 'full_reduction', status: 'active',
        fullReductionRules: [{ threshold: 100, discount: 10 }, { threshold: 200, discount: 30 }],
      });
      assert.equal(promoResp.status, 201, 'should create promotion');

      const calc1 = await api('POST', '/api/promotion/promotions/calculate', { orderAmount: 150 });
      assert.equal(calc1.data.maxDiscount, 10, '150 should get 10 discount');

      const calc2 = await api('POST', '/api/promotion/promotions/calculate', { orderAmount: 250 });
      assert.equal(calc2.data.maxDiscount, 30, '250 should get 30 discount');

      const calc3 = await api('POST', '/api/promotion/promotions/calculate', { orderAmount: 50 });
      assert.equal(calc3.data.maxDiscount, 0, '50 should get no discount');
    },
  });

  module.tests.create({
    name: 'promotion - 限时折扣和活动商品',
    moduleName: 'commerce-promotion',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const promoResp = await api('POST', '/api/promotion/promotions', {
        name: '限时8折', type: 'flash_sale', status: 'active', discountRate: 80,
      });
      const promoId = promoResp.data.id;

      await api('POST', '/api/promotion/promotion-items', {
        promotionId: promoId, productId: 'prod_000001', promoPrice: 3199, stock: 50,
      });

      const calc = await api('POST', '/api/promotion/promotions/calculate', {
        items: [{ productId: 'prod_000001', price: 3999, quantity: 1 }], orderAmount: 3999,
      });
      assert.true(calc.data.maxDiscount > 0, 'flash sale should give discount');

      const activeResp = await api('GET', '/api/promotion/promotions/active/items');
      assert.true(activeResp.data.items && activeResp.data.items.length > 0, 'should have active promotion items');

      await api('PUT', `/api/promotion/promotions/${promoId}/status`, { status: 'ended' });
      const endedResp = await api('GET', `/api/promotion/promotions/${promoId}`);
      assert.equal(endedResp.data.status, 'ended', 'promotion should be ended');
    },
  });

  return module;
}
