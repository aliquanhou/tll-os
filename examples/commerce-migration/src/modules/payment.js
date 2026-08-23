/**
 * TLL Commerce - Payment Module
 * Mock payment gateway integration. Supports multiple payment methods.
 * In production, this would be replaced with real payment adapters.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, toolSuccess, toolError } from '../utils.js';

export function registerPaymentModule(app) {
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-payment',
    version: '0.1.0',
    namespace: 'payment',
    description: '支付管理：Mock支付网关、支付记录、退款',
  });

  const PAYMENT_METHODS = [
    { id: 'alipay', name: '支付宝', icon: '💳', supported: true },
    { id: 'wechat', name: '微信支付', icon: '💚', supported: true },
    { id: 'card', name: '银行卡', icon: '🏦', supported: true },
    { id: 'cod', name: '货到付款', icon: '📦', supported: true },
    { id: 'balance', name: '余额支付', icon: '💰', supported: true },
  ];

  // ==================== APIs ====================
  mod.apis.create({
    method: 'GET', path: '/api/payment/methods', name: 'listPaymentMethods',
    handler: async () => ok({ methods: PAYMENT_METHODS }),
  });

  mod.apis.create({
    method: 'POST', path: '/api/payment/create', name: 'createPayment',
    description: '创建支付订单（Mock）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.orderId || !body.method) return badRequest('orderId和method必填');
      const order = await db.findById('orders', body.orderId);
      if (!order) return notFound('订单不存在');
      if (order.status !== 'pending') return badRequest('订单状态不允许支付');

      const method = PAYMENT_METHODS.find(m => m.id === body.method);
      if (!method || !method.supported) return badRequest('不支持的支付方式');

      const payment = await db.insert('payments', {
        orderId: order.id, userId: order.userId, amount: order.totalAmount,
        method: body.method, status: 'pending', currency: order.currency || 'CNY',
        transactionId: 'MOCK_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      });

      return created({
        ...payment,
        payUrl: `mock://pay/${payment.transactionId}?amount=${order.totalAmount}&method=${body.method}`,
        qrCode: `data:image/svg+xml,mock-qr-${payment.transactionId}`,
        expiresIn: 900,
      });
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/payment/notify', name: 'paymentNotify',
    description: '支付回调（Mock，模拟支付成功）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.transactionId) return badRequest('transactionId必填');
      const payment = await db.findOne('payments', p => p.transactionId === body.transactionId);
      if (!payment) return notFound('支付记录不存在');
      if (payment.status !== 'pending') return ok({ success: true, message: '已处理' });

      // Mock: always success
      await db.update('payments', payment.id, {
        status: 'success', paidAt: new Date().toISOString(),
        rawResponse: { mock: true, paid: true },
      });

      // Update order status
      const order = await db.findById('orders', payment.orderId);
      if (order && order.status === 'pending') {
        await db.update('orders', order.id, {
          status: 'paid', paidAt: new Date().toISOString(),
          paymentMethod: payment.method, transactionId: payment.transactionId,
        });
        // Deduct reserved inventory
        const items = await db.find('order_items', i => i.orderId === order.id);
        for (const item of items) {
          const inv = await db.findOne('inventory', inv => inv.skuId === item.skuId);
          if (inv) await db.update('inventory', inv.id, { reserved: Math.max(0, inv.reserved - item.quantity) });
        }
      }

      return ok({ success: true, paymentStatus: 'success' });
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/payment/refund', name: 'refundPayment',
    description: '退款（Mock）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.orderId) return badRequest('orderId必填');
      const order = await db.findById('orders', body.orderId);
      if (!order) return notFound('订单不存在');
      const payment = await db.findOne('payments', p => p.orderId === order.id && p.status === 'success');
      if (!payment) return badRequest('没有可退款的支付记录');

      const refundAmount = body.amount ? Math.min(Number(body.amount), payment.amount) : payment.amount;
      await db.update('payments', payment.id, {
        status: 'refunded', refundAmount, refundedAt: new Date().toISOString(),
        refundTransactionId: 'REFUND_' + Date.now(),
      });
      await db.update('orders', order.id, { status: 'refunded', refundedAt: new Date().toISOString() });

      return ok({ success: true, refundAmount, refundTransactionId: 'REFUND_' + Date.now() });
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/payment/:orderId', name: 'getPaymentStatus',
    handler: async (ctx) => {
      const payments = await db.find('payments', p => p.orderId === ctx.params.orderId);
      if (payments.length === 0) return notFound('支付记录不存在');
      return ok({ payments });
    },
  });

  // ==================== Tools ====================
  mod.tools.create({
    name: 'payment_pay',
    description: '模拟支付订单（创建支付并自动回调成功）',
    category: 'payment',
    parameters: { orderId: 'string (required)', method: 'string (default: mock)' },
    handler: async (params) => {
      if (!params.orderId) return toolError('orderId必填');
      const createResp = await app.apis.request('POST', '/api/payment/create',
        JSON.stringify({ orderId: params.orderId, method: params.method || 'alipay' }));
      if (createResp.status !== 201) return toolError(JSON.parse(createResp.body).message || '创建支付失败');
      const payment = JSON.parse(createResp.body);
      // Auto notify success
      await app.apis.request('POST', '/api/payment/notify', JSON.stringify({ transactionId: payment.transactionId }));
      return toolSuccess({ ...payment, status: 'success' });
    },
  });

  mod.tools.create({
    name: 'payment_status',
    description: '查询支付状态',
    category: 'payment',
    parameters: { orderId: 'string (required)' },
    handler: async (params) => {
      if (!params.orderId) return toolError('orderId必填');
      const resp = await app.apis.request('GET', `/api/payment/${params.orderId}`);
      if (resp.status !== 200) return toolError('支付记录不存在');
      return toolSuccess(JSON.parse(resp.body));
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'payment - 支付流程',
    test: async (ctx) => {
      // Create a pending order first
      const userId = 'test_pay_' + Date.now();
      const sku = (await db.find('skus', s => s.status === 'active'))[0];
      await ctx.application.apis.request('POST', '/api/cart/items',
        JSON.stringify({ userId, skuId: sku.id, quantity: 1 }));
      const addr = await db.insert('addresses', {
        userId, label: '测试', recipient: '测试', phone: '13800000000',
        country: 'CN', province: '广东', city: '惠州', district: '大亚湾', detail: '测试', isDefault: true,
      });
      const orderResp = await ctx.application.apis.request('POST', '/api/orders',
        JSON.stringify({ userId, addressId: addr.id }));
      const order = JSON.parse(orderResp.body);

      // Create payment
      const payResp = await ctx.application.apis.request('POST', '/api/payment/create',
        JSON.stringify({ orderId: order.id, method: 'alipay' }));
      ctx.assert.true(payResp.status === 201, '创建支付应返回201');
      const payment = JSON.parse(payResp.body);
      ctx.assert.true(payment.status === 'pending', '支付状态应为pending');
      ctx.assert.true(payment.payUrl, '应返回支付链接');

      // Notify success
      const notifyResp = await ctx.application.apis.request('POST', '/api/payment/notify',
        JSON.stringify({ transactionId: payment.transactionId }));
      ctx.assert.true(notifyResp.status === 200);

      // Check order paid
      const orderDetail = await ctx.application.apis.request('GET', `/api/orders/${order.id}`);
      const updatedOrder = JSON.parse(orderDetail.body);
      ctx.assert.true(updatedOrder.status === 'paid', '订单状态应为paid');
    },
  });

  return mod;
}
