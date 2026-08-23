/**
 * TLL Commerce - Order Module
 * Order creation, listing, details, status management, cancellation.
 * Integrates with cart, inventory, coupons, and payment.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, parseQuery, paginate, toolSuccess, toolError } from '../utils.js';

export function registerOrderModule(app) {
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-order',
    version: '0.1.0',
    namespace: 'order',
    description: '订单管理：创建、列表、详情、状态流转、取消',
  });

  // ==================== APIs ====================
  mod.apis.create({
    method: 'POST', path: '/api/orders', name: 'createOrder',
    description: '从购物车创建订单',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      const userId = body.userId || 'guest';
      if (!body.addressId) return badRequest('addressId必填');

      const address = await db.findById('addresses', body.addressId);
      if (!address) return notFound('地址不存在');

      // Get cart items
      const cart = await db.findOne('carts', c => c.userId === userId);
      if (!cart) return badRequest('购物车不存在');
      const cartItems = await db.find('cart_items', i => i.cartId === cart.id);
      if (cartItems.length === 0) return badRequest('购物车为空');

      // Calculate amounts
      let subtotal = 0;
      const orderItems = [];
      for (const ci of cartItems) {
        const sku = await db.findById('skus', ci.skuId);
        if (!sku || sku.status !== 'active') return badRequest(`SKU ${ci.skuId} 不可用`);
        if (ci.quantity > sku.stock) return badRequest(`SKU ${sku.skuCode} 库存不足`);
        const product = await db.findById('products', sku.productId);
        const itemSubtotal = ci.quantity * sku.price;
        subtotal += itemSubtotal;
        orderItems.push({
          skuId: sku.id, productId: sku.productId, productName: product?.name || sku.name,
          skuCode: sku.skuCode, attributes: sku.attributes, price: sku.price,
          quantity: ci.quantity, subtotal: itemSubtotal, image: product?.images?.[0] || '',
        });
      }

      // Coupon discount
      let discount = 0;
      let couponId = null;
      if (body.couponCode) {
        const coupon = await db.findOne('coupons', c => c.code === body.couponCode && c.status === 'active');
        if (!coupon) return badRequest('优惠券无效');
        if (subtotal < coupon.minOrderAmount) return badRequest(`订单金额需满 ${coupon.minOrderAmount}`);
        if (coupon.type === 'fixed') discount = coupon.value;
        else if (coupon.type === 'percent') discount = Math.round(subtotal * coupon.value / 100);
        discount = Math.min(discount, coupon.maxDiscount || discount);
        discount = Math.min(discount, subtotal);
        couponId = coupon.id;
      }

      // Shipping
      const shipping = subtotal >= 99 || subtotal === 0 ? 0 : 10;
      const totalAmount = subtotal - discount + shipping;

      // Membership discount
      let membershipDiscount = 0;
      const user = await db.findById('users', userId);
      if (user) {
        const level = await db.findById('membership_levels', user.membershipLevelId);
        if (level && level.discount < 1.0) {
          membershipDiscount = Math.round(subtotal * (1 - level.discount));
        }
      }
      const finalAmount = totalAmount - membershipDiscount;

      // Create order
      const orderNo = 'ORD' + Date.now() + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      const order = await db.insert('orders', {
        orderNo, userId, status: 'pending', subtotal, discount, membershipDiscount,
        shipping, totalAmount: finalAmount, couponId, addressId: body.addressId,
        addressSnapshot: { ...address }, remark: body.remark || '',
        paymentMethod: body.paymentMethod || 'mock', currency: body.currency || 'CNY',
      });

      // Create order items
      for (const item of orderItems) {
        await db.insert('order_items', { orderId: order.id, ...item });
      }

      // Reserve inventory
      for (const ci of cartItems) {
        const sku = await db.findById('skus', ci.skuId);
        const inv = await db.findOne('inventory', i => i.skuId === ci.skuId);
        if (inv) await db.update('inventory', inv.id, { reserved: inv.reserved + ci.quantity });
        if (sku) await db.update('skus', sku.id, { stock: sku.stock - ci.quantity });
      }

      // Clear cart
      for (const ci of cartItems) await db.remove('cart_items', ci.id);

      // Mark coupon used
      if (couponId) {
        await db.insert('user_coupons', { userId, couponId, orderId: order.id, status: 'used', usedAt: new Date().toISOString() });
        const coupon = await db.findById('coupons', couponId);
        if (coupon) await db.update('coupons', couponId, { usedCount: coupon.usedCount + 1 });
      }

      return created({ ...order, items: orderItems });
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/orders', name: 'listOrders',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let orders = await db.find('orders');
      if (q.userId) orders = orders.filter(o => o.userId === q.userId);
      if (q.status) orders = orders.filter(o => o.status === q.status);
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const result = paginate(orders, q.page, q.pageSize);
      return ok(result);
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/orders/:id', name: 'getOrder',
    handler: async (ctx) => {
      const order = await db.findById('orders', ctx.params.id);
      if (!order) return notFound('订单不存在');
      const items = await db.find('order_items', i => i.orderId === order.id);
      const address = await db.findById('addresses', order.addressId);
      return ok({ ...order, items, address });
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/orders/:id/cancel', name: 'cancelOrder',
    handler: async (ctx) => {
      const order = await db.findById('orders', ctx.params.id);
      if (!order) return notFound('订单不存在');
      if (order.status !== 'pending') return badRequest('只有待支付订单可以取消');
      await db.update('orders', order.id, { status: 'cancelled', cancelledAt: new Date().toISOString() });
      // Release inventory
      const items = await db.find('order_items', i => i.orderId === order.id);
      for (const item of items) {
        const sku = await db.findById('skus', item.skuId);
        const inv = await db.findOne('inventory', i => i.skuId === item.skuId);
        if (inv) await db.update('inventory', inv.id, { reserved: Math.max(0, inv.reserved - item.quantity) });
        if (sku) await db.update('skus', sku.id, { stock: sku.stock + item.quantity });
      }
      return ok({ success: true });
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/orders/:id/ship', name: 'shipOrder',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      const order = await db.findById('orders', ctx.params.id);
      if (!order) return notFound('订单不存在');
      if (order.status !== 'paid') return badRequest('只有已支付订单可以发货');
      await db.update('orders', order.id, {
        status: 'shipped', shippedAt: new Date().toISOString(),
        trackingNumber: body.trackingNumber || '', shippingCarrier: body.shippingCarrier || '',
      });
      return ok({ success: true });
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/orders/:id/complete', name: 'completeOrder',
    handler: async (ctx) => {
      const order = await db.findById('orders', ctx.params.id);
      if (!order) return notFound('订单不存在');
      if (order.status !== 'shipped') return badRequest('只有已发货订单可以完成');
      await db.update('orders', order.id, { status: 'completed', completedAt: new Date().toISOString() });
      // Update user total spent and membership
      const user = await db.findById('users', order.userId);
      if (user) {
        const newTotal = user.totalSpent + order.totalAmount;
        await db.update('users', user.id, { totalSpent: newTotal });
        // Check membership upgrade
        const levels = await db.find('membership_levels', null, { sort: ['level', 'desc'] });
        for (const level of levels) {
          if (newTotal >= level.minSpent) {
            await db.update('users', user.id, { membershipLevelId: level.id });
            break;
          }
        }
      }
      return ok({ success: true });
    },
  });

  // ==================== Tools ====================
  mod.tools.create({
    name: 'order_create',
    description: '从购物车创建订单',
    category: 'order',
    parameters: { userId: 'string', addressId: 'string (required)', couponCode: 'string', remark: 'string' },
    handler: async (params) => {
      if (!params.addressId) return toolError('addressId必填');
      const result = await app.apis.request('POST', '/api/orders', JSON.stringify(params));
      if (result.status !== 201) return toolError(JSON.parse(result.body).message || '创建订单失败');
      return toolSuccess(JSON.parse(result.body));
    },
  });

  mod.tools.create({
    name: 'order_get',
    description: '获取订单详情',
    category: 'order',
    parameters: { orderId: 'string (required)' },
    handler: async (params) => {
      if (!params.orderId) return toolError('orderId必填');
      const result = await app.apis.request('GET', `/api/orders/${params.orderId}`);
      if (result.status !== 200) return toolError('订单不存在');
      return toolSuccess(JSON.parse(result.body));
    },
  });

  mod.tools.create({
    name: 'order_list',
    description: '获取订单列表',
    category: 'order',
    parameters: { userId: 'string', status: 'string', page: 'number', pageSize: 'number' },
    handler: async (params) => {
      const qs = new URLSearchParams(params).toString();
      const result = await app.apis.request('GET', `/api/orders?${qs}`);
      return toolSuccess(JSON.parse(result.body));
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'order - 创建订单完整流程',
    test: async (ctx) => {
      const userId = 'test_order_' + Date.now();
      const sku = (await db.find('skus', s => s.status === 'active'))[0];
      const originalStock = sku.stock;

      // Add to cart
      await ctx.application.apis.request('POST', '/api/cart/items',
        JSON.stringify({ userId, skuId: sku.id, quantity: 1 }));

      // Create address
      const addr = await db.insert('addresses', {
        userId, label: '测试', recipient: '测试人', phone: '13800000000',
        country: 'CN', province: '广东', city: '惠州', district: '大亚湾',
        detail: '测试地址', zipCode: '516000', isDefault: true,
      });

      // Create order
      const orderResp = await ctx.application.apis.request('POST', '/api/orders',
        JSON.stringify({ userId, addressId: addr.id }));
      ctx.assert.true(orderResp.status === 201, '创建订单应返回201, got ' + orderResp.status + ' ' + orderResp.body);
      const order = JSON.parse(orderResp.body);
      ctx.assert.true(order.status === 'pending', '订单状态应为pending');
      ctx.assert.true(order.items.length === 1, '订单项应为1');
      ctx.assert.true(order.totalAmount > 0, '订单金额应大于0');

      // Check stock decreased
      const updatedSku = await db.findById('skus', sku.id);
      ctx.assert.true(updatedSku.stock === originalStock - 1, '库存应减少1');

      // Get order detail
      const detailResp = await ctx.application.apis.request('GET', `/api/orders/${order.id}`);
      ctx.assert.true(detailResp.status === 200);
      const detail = JSON.parse(detailResp.body);
      ctx.assert.true(detail.id === order.id);
    },
  });

  mod.tests.create({
    name: 'order - 取消订单释放库存',
    test: async (ctx) => {
      const userId = 'test_order_cancel_' + Date.now();
      const sku = (await db.find('skus', s => s.status === 'active'))[0];
      const originalStock = sku.stock;

      await ctx.application.apis.request('POST', '/api/cart/items',
        JSON.stringify({ userId, skuId: sku.id, quantity: 2 }));
      const addr = await db.insert('addresses', {
        userId, label: '测试', recipient: '测试', phone: '13800000000',
        country: 'CN', province: '广东', city: '惠州', district: '大亚湾', detail: '测试', isDefault: true,
      });
      const orderResp = await ctx.application.apis.request('POST', '/api/orders',
        JSON.stringify({ userId, addressId: addr.id }));
      const order = JSON.parse(orderResp.body);

      const cancelResp = await ctx.application.apis.request('POST', `/api/orders/${order.id}/cancel`);
      ctx.assert.true(cancelResp.status === 200, '取消应成功');
      const afterCancel = await db.findById('skus', sku.id);
      ctx.assert.true(afterCancel.stock === originalStock, '取消后库存应恢复');
    },
  });

  return mod;
}
