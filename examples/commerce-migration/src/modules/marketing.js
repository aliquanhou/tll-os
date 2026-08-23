/**
 * TLL Commerce - Marketing Module
 * Coupons, promotions, and discount management.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, parseQuery, paginate, toolSuccess, toolError } from '../utils.js';

export function registerMarketingModule(app) {
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-marketing',
    version: '0.1.0',
    namespace: 'marketing',
    description: '营销管理：优惠券、促销活动',
  });

  // ==================== Coupons ====================
  mod.apis.create({
    method: 'GET', path: '/api/marketing/coupons', name: 'listCoupons',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let coupons = await db.find('coupons', c => c.status === 'active');
      if (q.type) coupons = coupons.filter(c => c.type === q.type);
      const result = paginate(coupons, q.page, q.pageSize);
      return ok(result);
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/marketing/coupons/:id', name: 'getCoupon',
    handler: async (ctx) => {
      const coupon = await db.findById('coupons', ctx.params.id);
      if (!coupon) return notFound('优惠券不存在');
      return ok(coupon);
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/marketing/coupons', name: 'createCoupon',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.code || !body.name || !body.type || !body.value) return badRequest('code、name、type、value必填');
      if (await db.findOne('coupons', c => c.code === body.code)) return badRequest('优惠券code已存在');
      const coupon = await db.insert('coupons', {
        code: body.code, name: body.name, type: body.type, value: Number(body.value),
        minOrderAmount: Number(body.minOrderAmount) || 0,
        maxDiscount: Number(body.maxDiscount) || 999999,
        totalCount: Number(body.totalCount) || 100, usedCount: 0,
        perUserLimit: Number(body.perUserLimit) || 1,
        validFrom: body.validFrom || new Date().toISOString(),
        validTo: body.validTo || new Date(Date.now() + 86400000 * 365).toISOString(),
        status: body.status || 'active',
        applicableCategories: body.applicableCategories || [],
        applicableProducts: body.applicableProducts || [],
        b2bOnly: body.b2bOnly || false,
      });
      return created(coupon);
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/marketing/coupons/validate', name: 'validateCoupon',
    description: '验证优惠券是否可用并计算优惠金额',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.code || !body.orderAmount) return badRequest('code和orderAmount必填');
      const coupon = await db.findOne('coupons', c => c.code === body.code && c.status === 'active');
      if (!coupon) return badRequest('优惠券无效或已过期');
      const orderAmount = Number(body.orderAmount);
      if (orderAmount < coupon.minOrderAmount) return badRequest(`订单金额需满 ${coupon.minOrderAmount}`);
      if (coupon.usedCount >= coupon.totalCount) return badRequest('优惠券已领完');

      let discount = 0;
      if (coupon.type === 'fixed') discount = coupon.value;
      else if (coupon.type === 'percent') discount = Math.round(orderAmount * coupon.value / 100);
      discount = Math.min(discount, coupon.maxDiscount, orderAmount);

      return ok({ valid: true, coupon, discount, finalAmount: orderAmount - discount });
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/marketing/user-coupons', name: 'listUserCoupons',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      if (!q.userId) return badRequest('userId必填');
      const userCoupons = await db.find('user_coupons', uc => uc.userId === q.userId);
      const enriched = await Promise.all(userCoupons.map(async uc => ({
        ...uc,
        coupon: await db.findById('coupons', uc.couponId),
      })));
      return ok({ userCoupons: enriched });
    },
  });

  // ==================== Tools ====================
  mod.tools.create({
    name: 'marketing_validate_coupon',
    description: '验证优惠券并计算优惠',
    category: 'marketing',
    parameters: { code: 'string (required)', orderAmount: 'number (required)' },
    handler: async (params) => {
      if (!params.code || !params.orderAmount) return toolError('code和orderAmount必填');
      const resp = await app.apis.request('POST', '/api/marketing/coupons/validate', JSON.stringify(params));
      if (resp.status !== 200) return toolError(JSON.parse(resp.body).message || '优惠券无效');
      return toolSuccess(JSON.parse(resp.body));
    },
  });

  mod.tools.create({
    name: 'marketing_list_coupons',
    description: '获取可用优惠券列表',
    category: 'marketing',
    parameters: { type: 'string' },
    handler: async (params) => {
      const qs = new URLSearchParams(params).toString();
      const resp = await app.apis.request('GET', `/api/marketing/coupons?${qs}`);
      return toolSuccess(JSON.parse(resp.body));
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'marketing - 优惠券验证',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('POST', '/api/marketing/coupons/validate',
        JSON.stringify({ code: 'WELCOME10', orderAmount: 50 }));
      ctx.assert.true(resp.status === 200, '优惠券验证应通过');
      const body = JSON.parse(resp.body);
      ctx.assert.true(body.valid === true, '应有效');
      ctx.assert.true(body.discount === 10, '优惠应为10元');
      ctx.assert.true(body.finalAmount === 40, '实付应为40元');
    },
  });

  mod.tests.create({
    name: 'marketing - 优惠券列表',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('GET', '/api/marketing/coupons');
      ctx.assert.true(resp.status === 200);
      const body = JSON.parse(resp.body);
      ctx.assert.true(body.items.length >= 4, '应有至少4张优惠券');
    },
  });

  return mod;
}
