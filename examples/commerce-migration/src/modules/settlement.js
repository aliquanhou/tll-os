/**
 * TLL Commerce - Settlement Module (结算分账)
 * 结算单、结算明细、资金流水、分账
 */
import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, parseQuery } from '../utils.js';

export function registerSettlementModule(app) {
  const module = app.modules.create({
    name: 'commerce-settlement',
    version: '0.1.0',
    namespace: 'settlement',
    description: '结算分账模块：结算单生成、分账计算、资金流水',
  });
  const db = CommerceDatabase.getInstance();

  // ===== APIs =====

  // 结算单列表
  module.apis.create({
    method: 'GET', path: '/api/settlement/settlements', name: 'list_settlements',
    description: '获取结算单列表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let items = await db.find('settlements');
      if (q.merchantId) items = items.filter(i => i.merchantId === q.merchantId);
      if (q.status) items = items.filter(i => i.status === q.status);
      if (q.cycle) items = items.filter(i => i.cycle === q.cycle);
      return ok({ items, total: items.length });
    },
  });

  // 结算单详情
  module.apis.create({
    method: 'GET', path: '/api/settlement/settlements/:id', name: 'get_settlement',
    description: '获取结算单详情（含明细）',
    handler: async (ctx) => {
      const item = await db.findById('settlements', ctx.params.id);
      if (!item) return notFound('Settlement not found');
      const items = (await db.find('settlement_items')).filter(si => si.settlementId === item.id);
      return ok({ ...item, items });
    },
  });

  // 生成结算单（核心）
  module.apis.create({
    method: 'POST', path: '/api/settlement/settlements/generate', name: 'generate_settlement',
    description: '为商户生成结算单（按周期汇总已完成订单）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.merchantId) return badRequest('merchantId is required');
      const merchant = await db.findById('merchants', body.merchantId);
      if (!merchant) return notFound('Merchant not found');

      const periodStart = body.periodStart || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const periodEnd = body.periodEnd || new Date().toISOString().slice(0, 10);
      const periodStartTs = new Date(periodStart + 'T00:00:00').getTime();
      const periodEndTs = new Date(periodEnd + 'T23:59:59').getTime();

      // 查找该周期内已完成且未结算的订单（createdAt 是数字时间戳）
      const orders = (await db.find('orders')).filter(o =>
        o.merchantId === body.merchantId &&
        o.status === 'completed' &&
        !o.settled &&
        (o.createdAt || 0) >= periodStartTs &&
        (o.createdAt || 0) <= periodEndTs
      );

      if (orders.length === 0) return ok({ message: 'No orders to settle', settlement: null });

      // 计算分账
      let grossAmount = 0;
      let commission = 0;
      let shippingFee = 0;
      let discount = 0;
      const items = orders.map(order => {
        const orderCommission = Math.round(order.totalAmount * merchant.feeRate / 100 * 100) / 100;
        const netAmount = Math.round((order.totalAmount - orderCommission) * 100) / 100;
        grossAmount += order.totalAmount;
        commission += orderCommission;
        shippingFee += order.shipping || 0;
        discount += order.discount || 0;
        return {
          orderId: order.id,
          orderNo: order.orderNo,
          orderAmount: order.totalAmount,
          commissionRate: merchant.feeRate,
          commission: orderCommission,
          netAmount,
          completedAt: order.completedAt || order.createdAt,
        };
      });

      const netAmount = Math.round((grossAmount - commission) * 100) / 100;

      // 创建结算单
      const settlement = await db.insert('settlements', {
        settlementNo: `SET${Date.now()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
        merchantId: body.merchantId,
        merchantName: merchant.name,
        cycle: body.cycle || merchant.settlementCycle || 'monthly',
        periodStart,
        periodEnd,
        orderCount: orders.length,
        grossAmount: Math.round(grossAmount * 100) / 100,
        commissionRate: merchant.feeRate,
        commission: Math.round(commission * 100) / 100,
        shippingFee: Math.round(shippingFee * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        netAmount,
        currency: merchant.currency || 'CNY',
        status: 'pending', // pending/processing/paid/failed
        bankAccount: merchant.bankAccount || {},
        generatedAt: new Date().toISOString(),
        paidAt: null,
        transactionId: null,
        remark: body.remark || '',
      });

      // 创建结算明细
      for (const item of items) {
        await db.insert('settlement_items', { settlementId: settlement.id, ...item });
        // 标记订单已结算
        await db.update('orders', item.orderId, { settled: true, settlementId: settlement.id });
      }

      // 创建资金流水
      await db.insert('transactions', {
        txNo: `TX${Date.now()}`,
        type: 'settlement',
        direction: 'out',
        amount: netAmount,
        currency: settlement.currency,
        merchantId: body.merchantId,
        settlementId: settlement.id,
        status: 'pending',
        description: `结算单 ${settlement.settlementNo}`,
        createdAt: new Date().toISOString(),
      });

      return created(settlement);
    },
  });

  // 结算单打款
  module.apis.create({
    method: 'PUT', path: '/api/settlement/settlements/:id/pay', name: 'pay_settlement',
    description: '结算单打款（标记为已支付）',
    handler: async (ctx) => {
      const settlement = await db.findById('settlements', ctx.params.id);
      if (!settlement) return notFound('Settlement not found');
      if (settlement.status !== 'pending') return badRequest(`Settlement status is ${settlement.status}, cannot pay`);
      const body = parseBody(ctx);
      const updated = await db.update('settlements', ctx.params.id, {
        status: 'paid',
        paidAt: new Date().toISOString(),
        transactionId: body.transactionId || `BANK${Date.now()}`,
        paidBy: body.paidBy || 'system',
        paymentMethod: body.paymentMethod || 'bank_transfer',
      });
      // 更新资金流水
      const txs = (await db.find('transactions')).filter(t => t.settlementId === ctx.params.id);
      for (const tx of txs) {
        await db.update('transactions', tx.id, { status: 'completed', completedAt: new Date().toISOString() });
      }
      return ok(updated);
    },
  });

  // 资金流水列表
  module.apis.create({
    method: 'GET', path: '/api/settlement/transactions', name: 'list_transactions',
    description: '获取资金流水列表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let items = await db.find('transactions');
      if (q.merchantId) items = items.filter(i => i.merchantId === q.merchantId);
      if (q.type) items = items.filter(i => i.type === q.type);
      if (q.direction) items = items.filter(i => i.direction === q.direction);
      if (q.status) items = items.filter(i => i.status === q.status);
      return ok({ items, total: items.length });
    },
  });

  // 创建资金流水
  module.apis.create({
    method: 'POST', path: '/api/settlement/transactions', name: 'create_transaction',
    description: '创建资金流水（充值/提现/调整）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.type || !body.direction || !body.amount) return badRequest('type, direction, amount are required');
      const item = await db.insert('transactions', {
        txNo: `TX${Date.now()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
        type: body.type, // settlement/recharge/withdraw/adjustment/refund/commission
        direction: body.direction, // in/out
        amount: body.amount,
        currency: body.currency || 'CNY',
        merchantId: body.merchantId || null,
        orderId: body.orderId || null,
        settlementId: body.settlementId || null,
        status: body.status || 'pending',
        description: body.description || '',
        reference: body.reference || '',
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
      return created(item);
    },
  });

  // 商户结算概览
  module.apis.create({
    method: 'GET', path: '/api/settlement/settlements/overview/:merchantId', name: 'settlement_overview',
    description: '商户结算概览（可结算/在途/已结算）',
    handler: async (ctx) => {
      const merchant = await db.findById('merchants', ctx.params.merchantId);
      if (!merchant) return notFound('Merchant not found');
      const orders = (await db.find('orders')).filter(o => o.merchantId === ctx.params.merchantId);
      const settlements = (await db.find('settlements')).filter(s => s.merchantId === ctx.params.merchantId);

      const pendingOrders = orders.filter(o => o.status === 'completed' && !o.settled);
      const pendingAmount = pendingOrders.reduce((s, o) => s + o.totalAmount * (1 - merchant.feeRate / 100), 0);
      const processingSettlements = settlements.filter(s => s.status === 'pending');
      const processingAmount = processingSettlements.reduce((s, x) => s + x.netAmount, 0);
      const paidSettlements = settlements.filter(s => s.status === 'paid');
      const paidAmount = paidSettlements.reduce((s, x) => s + x.netAmount, 0);
      const totalCommission = settlements.reduce((s, x) => s + x.commission, 0);

      return ok({
        merchantId: ctx.params.merchantId,
        merchantName: merchant.name,
        feeRate: merchant.feeRate,
        pending: { orderCount: pendingOrders.length, amount: Math.round(pendingAmount * 100) / 100 },
        processing: { count: processingSettlements.length, amount: Math.round(processingAmount * 100) / 100 },
        paid: { count: paidSettlements.length, amount: Math.round(paidAmount * 100) / 100 },
        totalCommission: Math.round(totalCommission * 100) / 100,
      });
    },
  });

  // ===== Tools =====

  module.tools.create({
    name: 'settlement_generate',
    description: '为商户生成结算单',
    category: 'settlement',
    parameters: {
      type: 'object',
      properties: {
        merchantId: { type: 'string' },
        periodStart: { type: 'string' },
        periodEnd: { type: 'string' },
        cycle: { type: 'string' },
      },
      required: ['merchantId'],
    },
    handler: async (params) => {
      const resp = await module._app.apis.request('POST', '/settlements/generate', params);
      return resp.body;
    },
  });

  module.tools.create({
    name: 'settlement_overview',
    description: '获取商户结算概览',
    category: 'settlement',
    parameters: { type: 'object', properties: { merchantId: { type: 'string' } }, required: ['merchantId'] },
    handler: async (params) => {
      const resp = await module._app.apis.request('GET', `/settlements/overview/${params.merchantId}`);
      return resp.body;
    },
  });

  // ===== Tests =====

  module.tests.create({
    name: 'settlement - 结算单生成和打款',
    moduleName: 'commerce-settlement',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      // 创建商户
      const merResp = await api('POST', '/api/merchant/merchants', { name: '结算测试商户', feeRate: 5.0, settlementCycle: 'weekly' });
      const merchantId = merResp.data.id;
      await api('PUT', `/api/merchant/merchants/${merchantId}/audit`, { action: 'approved' });

      // 直接在数据库创建已完成订单（避免跨模块依赖）
      const now = new Date().toISOString();
      await db.insert('orders', {
        id: 'order_settlement_test_001', orderNo: 'ORDSETTLE001', userId: 'test_user',
        status: 'completed', totalAmount: 1000, merchantId,
        items: [{ productId: 'prod_000001', quantity: 1, price: 1000 }],
        completedAt: now, paidAt: now,
      });

      // 生成结算单
      const genResp = await api('POST', '/api/settlement/settlements/generate', { merchantId, cycle: 'weekly' });
      assert.equal(genResp.status, 201, 'should generate settlement');
      assert.true(genResp.data.orderCount >= 1, 'should have orders');
      assert.true(genResp.data.commission > 0, 'should have commission');
      assert.true(genResp.data.netAmount > 0, 'should have net amount');
      const settlementId = genResp.data.id;

      // 打款
      const paySetResp = await api('PUT', `/api/settlement/settlements/${settlementId}/pay`, { transactionId: 'BANKTEST001', paidBy: 'finance' });
      assert.equal(paySetResp.data.status, 'paid', 'settlement should be paid');

      // 概览
      const overviewResp = await api('GET', `/api/settlement/settlements/overview/${merchantId}`);
      assert.true(overviewResp.data.paid && overviewResp.data.paid.amount > 0, 'should have paid amount in overview');
    },
  });

  module.tests.create({
    name: 'settlement - 资金流水',
    moduleName: 'commerce-settlement',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const txResp = await api('POST', '/api/settlement/transactions', { type: 'recharge', direction: 'in', amount: 10000, merchantId: 'mer_test', description: '商户充值' });
      assert.equal(txResp.status, 201, 'should create transaction');
      assert.true(txResp.data.txNo, 'should have txNo');

      const listResp = await api('GET', '/api/settlement/transactions?type=recharge');
      assert.true(listResp.data.items && listResp.data.items.length > 0, 'should list transactions');
    },
  });

  return module;
}
