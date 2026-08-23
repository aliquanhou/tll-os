/**
 * TLL Commerce - B2B Module
 * Business-to-business features: company accounts, bulk pricing, credit limits, payment terms.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, parseQuery, toolSuccess, toolError } from '../utils.js';

export function registerB2BModule(app) {
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-b2b',
    version: '0.1.0',
    namespace: 'b2b',
    description: 'B2B企业采购：公司账户、批量定价、信用额度、账期',
  });

  // ==================== Companies ====================
  mod.apis.create({
    method: 'GET', path: '/api/b2b/companies', name: 'listCompanies',
    handler: async () => ok({ companies: await db.find('companies') }),
  });

  mod.apis.create({
    method: 'GET', path: '/api/b2b/companies/:id', name: 'getCompany',
    handler: async (ctx) => {
      const company = await db.findById('companies', ctx.params.id);
      if (!company) return notFound('企业不存在');
      const members = await db.find('company_members', m => m.companyId === company.id);
      return ok({ ...company, members });
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/b2b/companies', name: 'createCompany',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name || !body.taxNumber) return badRequest('name和taxNumber必填');
      const company = await db.insert('companies', {
        name: body.name, taxNumber: body.taxNumber, contactName: body.contactName || '',
        contactPhone: body.contactPhone || '', address: body.address || '',
        creditLimit: Number(body.creditLimit) || 0, currentCredit: 0,
        status: body.status || 'active', discountRate: Number(body.discountRate) || 1.0,
        paymentTerms: body.paymentTerms || 'prepaid',
      });
      return created(company);
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/b2b/companies/:id/members', name: 'addCompanyMember',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.userId) return badRequest('userId必填');
      const company = await db.findById('companies', ctx.params.id);
      if (!company) return notFound('企业不存在');
      const member = await db.insert('company_members', {
        companyId: company.id, userId: body.userId, role: body.role || 'buyer',
        status: 'active',
      });
      // Update user role
      await db.update('users', body.userId, { role: 'b2b', companyId: company.id });
      return created(member);
    },
  });

  // ==================== B2B Pricing ====================
  mod.apis.create({
    method: 'POST', path: '/api/b2b/quote', name: 'getB2BQuote',
    description: '获取B2B批量报价（基于数量阶梯和企业折扣）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.companyId || !body.items) return badRequest('companyId和items必填');
      const company = await db.findById('companies', body.companyId);
      if (!company) return notFound('企业不存在');

      let subtotal = 0;
      const quotedItems = [];
      for (const item of body.items) {
        const sku = await db.findById('skus', item.skuId);
        if (!sku) continue;
        const qty = Number(item.quantity) || 1;
        // Tiered pricing: bulk discount
        let unitPrice = sku.price;
        if (qty >= 100) unitPrice = Math.round(sku.price * 0.85 * 100) / 100;
        else if (qty >= 50) unitPrice = Math.round(sku.price * 0.90 * 100) / 100;
        else if (qty >= 10) unitPrice = Math.round(sku.price * 0.95 * 100) / 100;
        // Company discount
        unitPrice = Math.round(unitPrice * company.discountRate * 100) / 100;
        const itemTotal = unitPrice * qty;
        subtotal += itemTotal;
        quotedItems.push({ skuId: sku.id, skuCode: sku.skuCode, quantity: qty, unitPrice, itemTotal });
      }

      const shipping = subtotal >= 500 ? 0 : 20;
      const total = subtotal + shipping;

      return ok({
        companyId: company.id, companyName: company.name,
        items: quotedItems, subtotal, shipping, total,
        paymentTerms: company.paymentTerms,
        creditAvailable: company.creditLimit - company.currentCredit,
        expiresIn: 86400,
      });
    },
  });

  // ==================== Tools ====================
  mod.tools.create({
    name: 'b2b_get_quote',
    description: '获取B2B批量报价',
    category: 'b2b',
    parameters: { companyId: 'string (required)', items: 'array (required)' },
    handler: async (params) => {
      if (!params.companyId || !params.items) return toolError('companyId和items必填');
      const resp = await app.apis.request('POST', '/api/b2b/quote', JSON.stringify(params));
      if (resp.status !== 200) return toolError(JSON.parse(resp.body).message || '报价失败');
      return toolSuccess(JSON.parse(resp.body));
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'b2b - 企业列表和详情',
    test: async (ctx) => {
      const listResp = await ctx.application.apis.request('GET', '/api/b2b/companies');
      ctx.assert.true(listResp.status === 200);
      const companies = JSON.parse(listResp.body).companies;
      ctx.assert.true(companies.length >= 1, '应有至少1个企业');

      const detailResp = await ctx.application.apis.request('GET', `/api/b2b/companies/${companies[0].id}`);
      ctx.assert.true(detailResp.status === 200);
      const detail = JSON.parse(detailResp.body);
      ctx.assert.true(detail.name, '应有企业名称');
    },
  });

  mod.tests.create({
    name: 'b2b - 批量报价',
    test: async (ctx) => {
      const company = (await db.find('companies'))[0];
      const sku = (await db.find('skus', s => s.status === 'active'))[0];
      const resp = await ctx.application.apis.request('POST', '/api/b2b/quote',
        JSON.stringify({ companyId: company.id, items: [{ skuId: sku.id, quantity: 50 }] }));
      ctx.assert.true(resp.status === 200, '报价应成功');
      const quote = JSON.parse(resp.body);
      ctx.assert.true(quote.items.length === 1, '应有1个报价项');
      ctx.assert.true(quote.total > 0, '报价总额应大于0');
      ctx.assert.true(quote.items[0].unitPrice < sku.price, '批量单价应低于零售价');
    },
  });

  return mod;
}
